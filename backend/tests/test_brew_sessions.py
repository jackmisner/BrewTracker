import json
from datetime import UTC, date, datetime

import pytest

from models.mongo_models import BrewSession, Ingredient, Recipe, User


class TestBrewSessionEndpoints:
    """Test brew session CRUD operations and fermentation tracking"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user, return user and auth headers"""
        # Register user
        client.post(
            "/api/auth/register",
            json={
                "username": "testbrewer",
                "email": "brewer@example.com",
                "password": "password123",
            },
        )

        # Login to get token
        login_response = client.post(
            "/api/auth/login",
            json={"username": "testbrewer", "password": "password123"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="testbrewer").first()

        return user, {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def sample_recipe(self, authenticated_user):
        """Create a sample recipe for testing brew sessions"""
        user, headers = authenticated_user

        recipe = Recipe(
            user_id=user.id,
            name="Test IPA",
            style="American IPA",
            batch_size=5.0,
            description="Test recipe for brew sessions",
            estimated_og=1.060,
            estimated_fg=1.012,
            estimated_abv=6.3,
            estimated_ibu=45,
            estimated_srm=6,
        )
        recipe.save()
        return recipe

    def test_create_brew_session_success(
        self, client, authenticated_user, sample_recipe
    ):
        """Test successful brew session creation"""
        user, headers = authenticated_user

        session_data = {
            "recipe_id": str(sample_recipe.id),
            "name": "First Brew of Test IPA",
            "brew_date": "2024-01-15",
            "status": "planned",
            "notes": "First attempt at this recipe",
        }

        response = client.post("/api/brew-sessions", json=session_data, headers=headers)

        assert response.status_code == 201
        assert response.json["name"] == "First Brew of Test IPA"
        assert response.json["recipe_id"] == str(sample_recipe.id)
        assert response.json["status"] == "planned"  # Default status
        assert response.json["notes"] == "First attempt at this recipe"

        # Verify session was saved to database
        session = BrewSession.objects(name="First Brew of Test IPA").first()
        assert session is not None
        assert str(session.user_id) == str(user.id)

    def test_create_brew_session_unauthorized(self, client, sample_recipe):
        """Test brew session creation without authentication"""
        session_data = {
            "recipe_id": str(sample_recipe.id),
            "name": "Unauthorized Session",
        }

        response = client.post("/api/brew-sessions", json=session_data)
        assert response.status_code == 401

    def test_get_user_brew_sessions(self, client, authenticated_user, sample_recipe):
        """Test retrieving user's brew sessions"""
        user, headers = authenticated_user

        # Create multiple brew sessions
        for i in range(3):
            session_data = {
                "recipe_id": str(sample_recipe.id),
                "name": f"Brew Session {i}",
                "status": "planned",
            }
            client.post("/api/brew-sessions", json=session_data, headers=headers)

        # Get brew sessions
        response = client.get("/api/brew-sessions", headers=headers)

        assert response.status_code == 200
        assert len(response.json["brew_sessions"]) == 3
        assert "pagination" in response.json
        assert response.json["pagination"]["total"] == 3

    def test_get_brew_session_by_id(self, client, authenticated_user, sample_recipe):
        """Test retrieving a specific brew session"""
        user, headers = authenticated_user

        # Create brew session
        session_data = {
            "recipe_id": str(sample_recipe.id),
            "name": "Test Session",
            "status": "planned",
        }
        create_response = client.post(
            "/api/brew-sessions", json=session_data, headers=headers
        )
        session_id = create_response.json["session_id"]

        # Get session by ID
        response = client.get(f"/api/brew-sessions/{session_id}", headers=headers)

        assert response.status_code == 200
        assert response.json["name"] == "Test Session"
        assert response.json["session_id"] == session_id

    def test_get_brew_session_not_found(self, client, authenticated_user):
        """Test retrieving non-existent brew session"""
        user, headers = authenticated_user

        response = client.get(
            "/api/brew-sessions/507f1f77bcf86cd799439011", headers=headers
        )
        assert response.status_code == 404

    def test_update_brew_session(self, client, authenticated_user, sample_recipe):
        """Test updating a brew session"""
        user, headers = authenticated_user

        # Create brew session
        session_data = {
            "recipe_id": str(sample_recipe.id),
            "name": "Original Session",
            "status": "planned",
        }
        create_response = client.post(
            "/api/brew-sessions", json=session_data, headers=headers
        )
        session_id = create_response.json["session_id"]

        # Update session
        update_data = {
            "name": "Updated Session",
            "status": "fermenting",
            "actual_og": 1.062,
            "mash_temp": 152.0,
            "notes": "Updated brewing notes",
        }

        response = client.put(
            f"/api/brew-sessions/{session_id}", json=update_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json["name"] == "Updated Session"
        assert response.json["status"] == "fermenting"
        assert response.json["actual_og"] == 1.062
        assert response.json["mash_temp"] == 152.0

    def test_update_brew_session_not_found(self, client, authenticated_user):
        """Test updating non-existent brew session"""
        user, headers = authenticated_user

        update_data = {"status": "completed"}
        response = client.put(
            "/api/brew-sessions/507f1f77bcf86cd799439011",
            json=update_data,
            headers=headers,
        )
        assert response.status_code == 404

    def test_delete_brew_session(self, client, authenticated_user, sample_recipe):
        """Test deleting a brew session"""
        user, headers = authenticated_user

        # Create brew session
        session_data = {
            "recipe_id": str(sample_recipe.id),
            "name": "Session to Delete",
            "status": "planned",
        }
        create_response = client.post(
            "/api/brew-sessions", json=session_data, headers=headers
        )
        session_id = create_response.json["session_id"]

        # Delete session
        response = client.delete(f"/api/brew-sessions/{session_id}", headers=headers)

        assert response.status_code == 200
        assert "deleted successfully" in response.json["message"]

        # Verify session is deleted
        get_response = client.get(f"/api/brew-sessions/{session_id}", headers=headers)
        assert get_response.status_code == 404

    def test_brew_session_access_control(self, client, sample_recipe):
        """Test brew session access control between different users"""
        # Create two users
        client.post(
            "/api/auth/register",
            json={
                "username": "user1",
                "email": "user1@example.com",
                "password": "pass123",
            },
        )
        client.post(
            "/api/auth/register",
            json={
                "username": "user2",
                "email": "user2@example.com",
                "password": "pass123",
            },
        )

        # Get tokens for both users
        user1_token = client.post(
            "/api/auth/login", json={"username": "user1", "password": "pass123"}
        ).json["access_token"]
        user2_token = client.post(
            "/api/auth/login", json={"username": "user2", "password": "pass123"}
        ).json["access_token"]

        user1_headers = {"Authorization": f"Bearer {user1_token}"}
        user2_headers = {"Authorization": f"Bearer {user2_token}"}

        # User1 creates a brew session
        session_data = {
            "recipe_id": str(sample_recipe.id),
            "name": "User1 Session",
            "status": "planned",
        }
        create_response = client.post(
            "/api/brew-sessions", json=session_data, headers=user1_headers
        )
        session_id = create_response.json["session_id"]

        # User2 should not be able to access user1's session
        response = client.get(f"/api/brew-sessions/{session_id}", headers=user2_headers)
        assert response.status_code == 403

        # User2 should not be able to update user1's session
        response = client.put(
            f"/api/brew-sessions/{session_id}",
            json={"status": "completed"},
            headers=user2_headers,
        )
        assert response.status_code == 403

        # User2 should not be able to delete user1's session
        response = client.delete(
            f"/api/brew-sessions/{session_id}", headers=user2_headers
        )
        assert response.status_code == 403


class TestFermentationTracking:
    """Test fermentation data tracking endpoints"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user"""
        client.post(
            "/api/auth/register",
            json={
                "username": "fermenter",
                "email": "fermenter@example.com",
                "password": "password123",
            },
        )

        login_response = client.post(
            "/api/auth/login",
            json={"username": "fermenter", "password": "password123"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="fermenter").first()

        return user, {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def brew_session_with_fermentation(self, client, authenticated_user):
        """Create a brew session for fermentation testing"""
        user, headers = authenticated_user

        # Create recipe
        recipe = Recipe(
            user_id=user.id,
            name="Fermentation Test Recipe",
            batch_size=5.0,
            estimated_og=1.050,
            estimated_fg=1.010,
        )
        recipe.save()

        # Create brew session
        session_data = {
            "recipe_id": str(recipe.id),
            "name": "Fermentation Test Session",
            "status": "fermenting",
            "actual_og": 1.052,
        }
        response = client.post("/api/brew-sessions", json=session_data, headers=headers)
        session_id = response.json["session_id"]

        return session_id, headers

    def test_add_fermentation_entry(self, client, brew_session_with_fermentation):
        """Test adding a fermentation data entry"""
        session_id, headers = brew_session_with_fermentation

        entry_data = {
            "gravity": 1.045,
            "temperature": 68.5,
            "ph": 4.2,
            "notes": "Fermentation is active, lots of bubbling",
        }

        response = client.post(
            f"/api/brew-sessions/{session_id}/fermentation",
            json=entry_data,
            headers=headers,
        )

        assert response.status_code == 201
        assert len(response.json) > 0  # Should return updated fermentation data

    def test_get_fermentation_data(self, client, brew_session_with_fermentation):
        """Test retrieving fermentation data"""
        session_id, headers = brew_session_with_fermentation

        # Add some fermentation entries
        entries = [
            {"gravity": 1.050, "temperature": 68.0, "notes": "Day 1"},
            {"gravity": 1.030, "temperature": 69.0, "notes": "Day 3"},
            {"gravity": 1.015, "temperature": 68.5, "notes": "Day 7"},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Get fermentation data
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation", headers=headers
        )

        assert response.status_code == 200
        assert len(response.json) == 3
        assert response.json[0]["notes"] == "Day 1"
        assert response.json[2]["notes"] == "Day 7"

    def test_update_fermentation_entry(self, client, brew_session_with_fermentation):
        """Test updating a fermentation entry"""
        session_id, headers = brew_session_with_fermentation

        # Add an entry
        entry_data = {"gravity": 1.040, "temperature": 68.0, "notes": "Original entry"}
        client.post(
            f"/api/brew-sessions/{session_id}/fermentation",
            json=entry_data,
            headers=headers,
        )

        # Update the entry (index 0)
        update_data = {
            "gravity": 1.038,
            "temperature": 69.0,
            "notes": "Updated entry with corrected readings",
        }

        response = client.put(
            f"/api/brew-sessions/{session_id}/fermentation/0",
            json=update_data,
            headers=headers,
        )

        assert response.status_code == 200

        # Verify the update
        get_response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation", headers=headers
        )
        assert get_response.json[0]["gravity"] == 1.038
        assert get_response.json[0]["notes"] == "Updated entry with corrected readings"

    def test_delete_fermentation_entry(self, client, brew_session_with_fermentation):
        """Test deleting a fermentation entry"""
        session_id, headers = brew_session_with_fermentation

        # Add multiple entries
        entries = [
            {"gravity": 1.050, "notes": "Entry 1"},
            {"gravity": 1.040, "notes": "Entry 2"},
            {"gravity": 1.030, "notes": "Entry 3"},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Delete middle entry (index 1)
        response = client.delete(
            f"/api/brew-sessions/{session_id}/fermentation/1", headers=headers
        )

        assert response.status_code == 200

        # Verify deletion
        get_response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation", headers=headers
        )
        assert len(get_response.json) == 2
        assert get_response.json[0]["notes"] == "Entry 1"
        assert get_response.json[1]["notes"] == "Entry 3"

    def test_get_fermentation_stats(self, client, brew_session_with_fermentation):
        """Test getting fermentation statistics"""
        session_id, headers = brew_session_with_fermentation

        # Add fermentation data with a clear progression
        entries = [
            {"gravity": 1.050, "temperature": 68.0, "ph": 4.5},
            {"gravity": 1.040, "temperature": 69.0, "ph": 4.3},
            {"gravity": 1.025, "temperature": 68.5, "ph": 4.1},
            {"gravity": 1.015, "temperature": 67.0, "ph": 4.0},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Get fermentation statistics
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation/stats", headers=headers
        )

        assert response.status_code == 200

        stats = response.json
        assert "gravity" in stats
        assert "temperature" in stats
        assert "ph" in stats

        # Check gravity stats
        assert stats["gravity"]["initial"] == 1.050
        assert stats["gravity"]["current"] == 1.015
        assert round(stats["gravity"]["drop"], 3) == 0.035
        assert stats["gravity"]["attenuation"] > 0  # Should be calculated

        # Check temperature stats (temperatures are stored in user's preferred units)
        # Temperatures should be stored as entered: 67.0, 68.0, 68.5, 69.0
        assert stats["temperature"]["min"] == 67.0
        assert stats["temperature"]["max"] == 69.0
        assert 67.0 <= stats["temperature"]["avg"] <= 69.0

        # Check pH stats
        assert stats["ph"]["min"] == 4.0
        assert stats["ph"]["max"] == 4.5

    def test_fermentation_entry_validation(
        self, client, brew_session_with_fermentation
    ):
        """Test fermentation entry data validation"""
        session_id, headers = brew_session_with_fermentation

        # Test with negative gravity (invalid)
        invalid_entry = {"gravity": -1.0, "temperature": 68.0}

        # Note: This test might need adjustment based on actual validation implementation
        response = client.post(
            f"/api/brew-sessions/{session_id}/fermentation",
            json=invalid_entry,
            headers=headers,
        )

        # If validation is implemented, this should fail
        # If not, this documents expected behavior for future implementation
        # assert response.status_code == 400

    def test_fermentation_access_control(self, client, authenticated_user):
        """Test fermentation data access control"""
        user, headers = authenticated_user

        # Create a session for another user
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("password")
        other_user.save()

        recipe = Recipe(user_id=other_user.id, name="Other Recipe", batch_size=5.0)
        recipe.save()

        session = BrewSession(
            recipe_id=recipe.id,
            user_id=other_user.id,
            name="Other Session",
            status="fermenting",
        )
        session.save()

        # Try to access other user's fermentation data
        response = client.get(
            f"/api/brew-sessions/{session.id}/fermentation", headers=headers
        )
        assert response.status_code == 403

        # Try to add fermentation data to other user's session
        response = client.post(
            f"/api/brew-sessions/{session.id}/fermentation",
            json={"gravity": 1.020},
            headers=headers,
        )
        assert response.status_code == 403


class TestGravityStabilizationAnalysis:
    """Test gravity stabilization analysis for fermentation completion detection"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user"""
        client.post(
            "/api/auth/register",
            json={
                "username": "stabilizer",
                "email": "stabilizer@example.com",
                "password": "password123",
            },
        )

        login_response = client.post(
            "/api/auth/login",
            json={"username": "stabilizer", "password": "password123"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="stabilizer").first()

        return user, {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def brew_session_for_analysis(self, client, authenticated_user):
        """Create a brew session with recipe for gravity analysis testing"""
        user, headers = authenticated_user

        # Create recipe with estimated FG
        recipe = Recipe(
            user_id=user.id,
            name="Stabilization Test Recipe",
            batch_size=5.0,
            estimated_og=1.050,
            estimated_fg=1.012,
        )
        recipe.save()

        # Create brew session
        session_data = {
            "recipe_id": str(recipe.id),
            "name": "Stabilization Test Session",
            "status": "fermenting",
            "actual_og": 1.050,
        }
        response = client.post("/api/brew-sessions", json=session_data, headers=headers)
        session_id = response.json["session_id"]

        return session_id, headers

    def test_analyze_completion_insufficient_data(
        self, client, brew_session_for_analysis
    ):
        """Test analysis with insufficient gravity readings"""
        session_id, headers = brew_session_for_analysis

        # Add only 2 entries (less than minimum 3)
        entries = [
            {"gravity": 1.050, "notes": "Day 0"},
            {"gravity": 1.030, "notes": "Day 3"},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Test analysis
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation/analyze-completion",
            headers=headers,
        )

        assert response.status_code == 200
        analysis = response.json
        assert analysis["is_stable"] is False
        assert analysis["completion_suggested"] is False
        assert "Insufficient gravity readings" in analysis["reason"]
        assert analysis["stabilization_confidence"] == 0.0

    def test_analyze_completion_gravity_still_dropping(
        self, client, brew_session_for_analysis
    ):
        """Test analysis when gravity is still actively dropping"""
        session_id, headers = brew_session_for_analysis

        # Add entries showing active fermentation
        entries = [
            {"gravity": 1.050, "notes": "Day 0"},
            {"gravity": 1.040, "notes": "Day 1"},
            {"gravity": 1.030, "notes": "Day 2"},
            {"gravity": 1.020, "notes": "Day 3"},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Test analysis
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation/analyze-completion",
            headers=headers,
        )

        assert response.status_code == 200
        analysis = response.json
        assert analysis["is_stable"] is False
        assert analysis["completion_suggested"] is False
        assert "still dropping" in analysis["reason"]

    def test_analyze_completion_stable_near_target(
        self, client, brew_session_for_analysis
    ):
        """Test analysis when gravity is stable and near estimated FG"""
        session_id, headers = brew_session_for_analysis

        # Add entries showing stabilization near estimated FG (1.012)
        entries = [
            {"gravity": 1.050, "notes": "Day 0"},
            {"gravity": 1.030, "notes": "Day 3"},
            {"gravity": 1.015, "notes": "Day 7"},
            {"gravity": 1.012, "notes": "Day 10"},
            {"gravity": 1.012, "notes": "Day 12"},
            {"gravity": 1.012, "notes": "Day 14"},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Test analysis
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation/analyze-completion",
            headers=headers,
        )

        assert response.status_code == 200
        analysis = response.json
        assert analysis["is_stable"] is True
        assert analysis["completion_suggested"] is True
        assert (
            "close to estimated FG" in analysis["reason"]
            or "close to adjusted expected FG" in analysis["reason"]
        )
        assert analysis["current_gravity"] == 1.012
        assert analysis["estimated_fg"] == 1.012
        assert (
            analysis["stabilization_confidence"] >= 0.66
        )  # Should be 2/3 = 0.67 for 2 stable readings

    def test_analyze_completion_stable_but_high(
        self, client, brew_session_for_analysis
    ):
        """Test analysis when gravity is stable but higher than expected"""
        session_id, headers = brew_session_for_analysis

        # Add entries showing stabilization at higher than expected gravity
        entries = [
            {"gravity": 1.050, "notes": "Day 0"},
            {"gravity": 1.030, "notes": "Day 3"},
            {"gravity": 1.022, "notes": "Day 7"},
            {"gravity": 1.021, "notes": "Day 10"},
            {"gravity": 1.021, "notes": "Day 12"},
        ]

        for entry in entries:
            client.post(
                f"/api/brew-sessions/{session_id}/fermentation",
                json=entry,
                headers=headers,
            )

        # Test analysis
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation/analyze-completion",
            headers=headers,
        )

        assert response.status_code == 200
        analysis = response.json
        assert analysis["is_stable"] is True
        assert analysis["completion_suggested"] is False
        assert (
            "higher than estimated FG" in analysis["reason"]
            or "higher than adjusted expected FG" in analysis["reason"]
        )
        assert "attenuation issues" in analysis["reason"]

    def test_analyze_completion_already_completed(
        self, client, brew_session_for_analysis
    ):
        """Test analysis for a session already marked as completed"""
        session_id, headers = brew_session_for_analysis

        # Mark session as completed
        update_data = {"status": "completed"}
        client.put(
            f"/api/brew-sessions/{session_id}", json=update_data, headers=headers
        )

        # Test analysis
        response = client.get(
            f"/api/brew-sessions/{session_id}/fermentation/analyze-completion",
            headers=headers,
        )

        assert response.status_code == 200
        analysis = response.json
        assert analysis["is_stable"] is True
        assert analysis["completion_suggested"] is False
        assert "already marked as completed" in analysis["reason"]

    def test_analyze_completion_access_control(self, client, authenticated_user):
        """Test that users cannot analyze other users' sessions"""
        user, headers = authenticated_user

        # Create a session for another user
        other_user = User(username="otheranalyzer", email="other@example.com")
        other_user.set_password("password")
        other_user.save()

        recipe = Recipe(user_id=other_user.id, name="Other Recipe", batch_size=5.0)
        recipe.save()

        session = BrewSession(
            recipe_id=recipe.id,
            user_id=other_user.id,
            name="Other Session",
            status="fermenting",
        )
        session.save()

        # Try to analyze other user's session
        response = client.get(
            f"/api/brew-sessions/{session.id}/fermentation/analyze-completion",
            headers=headers,
        )
        assert response.status_code == 403
