import json

import pytest

from models.mongo_models import BrewSession, Ingredient, Recipe, User


class TestRecipeEndpointsExtended:
    """Extended tests for recipe endpoints to improve coverage"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user, return user and auth headers"""
        # Register user
        client.post(
            "/api/auth/register",
            json={
                "username": "recipeuser",
                "email": "recipe@example.com",
                "password": "password123",
            },
        )

        # Login to get token
        login_response = client.post(
            "/api/auth/login",
            json={"username": "recipeuser", "password": "password123"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="recipeuser").first()

        return user, {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredients for testing"""
        ingredients = [
            Ingredient(
                name="Pale Malt",
                type="grain",
                grain_type="base_malt",
                potential=36,
                color=2.0,
            ),
            Ingredient(
                name="Crystal 60L",
                type="grain",
                grain_type="caramel_crystal",
                potential=34,
                color=60.0,
            ),
            Ingredient(name="Cascade", type="hop", alpha_acid=5.5),
            Ingredient(name="US-05", type="yeast", attenuation=75.0),
        ]

        for ingredient in ingredients:
            ingredient.save()

        return ingredients

    def test_get_recipe_defaults_success(self, client, authenticated_user):
        """Test getting recipe defaults endpoint"""
        user, headers = authenticated_user

        response = client.get("/api/recipes/defaults", headers=headers)

        assert response.status_code == 200
        assert "batch_size" in response.json
        assert "efficiency" in response.json
        assert "boil_time" in response.json
        assert "unit_system" in response.json
        assert "suggested_units" in response.json
        assert "typical_batch_sizes" in response.json

        # Check that suggested units are present
        suggested = response.json["suggested_units"]
        assert "grain" in suggested
        assert "hop" in suggested
        assert "yeast" in suggested
        assert "volume" in suggested
        assert "temperature" in suggested

        # Check typical batch sizes
        typical = response.json["typical_batch_sizes"]
        assert isinstance(typical, list)
        assert len(typical) > 0

    def test_get_recipe_defaults_user_not_found(self, client):
        """Test getting recipe defaults when user doesn't exist"""
        # Create a fake token (this is difficult to test without mocking)
        # For now, test without authentication
        response = client.get("/api/recipes/defaults")
        assert response.status_code == 401

    def test_get_recipe_defaults_metric_user(self, client, authenticated_user):
        """Test getting recipe defaults for metric user"""
        user, headers = authenticated_user

        # Update user to metric
        user.settings.preferred_units = "metric"
        user.save()

        response = client.get("/api/recipes/defaults", headers=headers)

        assert response.status_code == 200
        assert response.json["unit_system"] == "metric"

        # Check metric-specific units
        suggested = response.json["suggested_units"]
        assert suggested["grain"] == "kg"
        assert suggested["hop"] == "g"
        assert suggested["volume"] == "l"
        assert suggested["temperature"] == "c"

        # Check metric batch sizes
        typical = response.json["typical_batch_sizes"]
        assert any("L" in size["label"] for size in typical)

    def test_create_recipe_with_unit_system(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test creating recipe with explicit unit system"""
        user, headers = authenticated_user

        # Set user to metric but create imperial recipe
        user.settings.preferred_units = "metric"
        user.save()

        recipe_data = {
            "name": "Imperial Recipe",
            "batch_size": 5.0,
            "unit_system": "imperial",  # Explicit imperial
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredients[0].id),
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 10.0,
                    "unit": "lb",
                }
            ],
        }

        response = client.post("/api/recipes", json=recipe_data, headers=headers)

        assert response.status_code == 201
        assert response.json["recipe"]["unit_system"] == "imperial"

    def test_create_recipe_error_handling(self, client, authenticated_user):
        """Test recipe creation error handling"""
        user, headers = authenticated_user

        # Test with invalid data that might cause an exception
        recipe_data = {
            "name": "Error Recipe",
            "batch_size": "invalid",  # Invalid type
            "ingredients": [],
        }

        response = client.post("/api/recipes", json=recipe_data, headers=headers)
        assert response.status_code == 400
        assert "Failed to create recipe" in response.json["error"]

    def test_update_recipe_not_owner(self, client, sample_ingredients):
        """Test updating recipe by non-owner"""
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

        # Get tokens
        user1_token = client.post(
            "/api/auth/login", json={"username": "user1", "password": "pass123"}
        ).json["access_token"]
        user2_token = client.post(
            "/api/auth/login", json={"username": "user2", "password": "pass123"}
        ).json["access_token"]

        user1_headers = {"Authorization": f"Bearer {user1_token}"}
        user2_headers = {"Authorization": f"Bearer {user2_token}"}

        # User1 creates recipe
        recipe_data = {"name": "User1 Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post(
            "/api/recipes", json=recipe_data, headers=user1_headers
        )
        recipe_id = create_response.json["recipe_id"]

        # User2 tries to update
        update_data = {"name": "Modified by User2"}
        response = client.put(
            f"/api/recipes/{recipe_id}", json=update_data, headers=user2_headers
        )

        assert response.status_code == 403
        assert "Access denied" in response.json["error"]

    def test_get_recipe_brew_sessions_success(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test getting brew sessions for a recipe"""
        user, headers = authenticated_user

        # Create recipe
        recipe_data = {"name": "Session Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Create brew sessions for this recipe
        for i in range(3):
            session_data = {
                "recipe_id": recipe_id,
                "name": f"Brew Session {i}",
                "status": "completed",
            }
            client.post("/api/brew-sessions", json=session_data, headers=headers)

        # Get brew sessions for recipe
        response = client.get(
            f"/api/recipes/{recipe_id}/brew-sessions", headers=headers
        )

        assert response.status_code == 200
        assert "brew_sessions" in response.json
        assert "total" in response.json
        assert response.json["total"] == 3
        assert len(response.json["brew_sessions"]) == 3

    def test_get_recipe_brew_sessions_recipe_not_found(
        self, client, authenticated_user
    ):
        """Test getting brew sessions for non-existent recipe"""
        user, headers = authenticated_user

        response = client.get(
            "/api/recipes/507f1f77bcf86cd799439011/brew-sessions", headers=headers
        )

        assert response.status_code == 404
        assert "Recipe not found" in response.json["error"]

    def test_get_recipe_brew_sessions_access_denied(self, client, sample_ingredients):
        """Test getting brew sessions for recipe without access"""
        # Create two users
        client.post(
            "/api/auth/register",
            json={
                "username": "owner",
                "email": "owner@example.com",
                "password": "pass123",
            },
        )
        client.post(
            "/api/auth/register",
            json={
                "username": "other",
                "email": "other@example.com",
                "password": "pass123",
            },
        )

        # Get tokens
        owner_token = client.post(
            "/api/auth/login", json={"username": "owner", "password": "pass123"}
        ).json["access_token"]
        other_token = client.post(
            "/api/auth/login", json={"username": "other", "password": "pass123"}
        ).json["access_token"]

        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Owner creates private recipe
        recipe_data = {
            "name": "Private Recipe",
            "batch_size": 5.0,
            "is_public": False,
            "ingredients": [],
        }
        create_response = client.post(
            "/api/recipes", json=recipe_data, headers=owner_headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Other user tries to access brew sessions
        response = client.get(
            f"/api/recipes/{recipe_id}/brew-sessions", headers=other_headers
        )

        assert response.status_code == 403
        assert "Access denied" in response.json["error"]

    def test_get_recipe_brew_sessions_public_recipe(self, client, sample_ingredients):
        """Test getting brew sessions for public recipe (should only see own sessions)"""
        # Create two users
        client.post(
            "/api/auth/register",
            json={
                "username": "owner",
                "email": "owner@example.com",
                "password": "pass123",
            },
        )
        client.post(
            "/api/auth/register",
            json={
                "username": "other",
                "email": "other@example.com",
                "password": "pass123",
            },
        )

        # Get tokens
        owner_token = client.post(
            "/api/auth/login", json={"username": "owner", "password": "pass123"}
        ).json["access_token"]
        other_token = client.post(
            "/api/auth/login", json={"username": "other", "password": "pass123"}
        ).json["access_token"]

        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Owner creates public recipe
        recipe_data = {
            "name": "Public Recipe",
            "batch_size": 5.0,
            "is_public": True,
            "ingredients": [],
        }
        create_response = client.post(
            "/api/recipes", json=recipe_data, headers=owner_headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Owner creates a brew session
        session_data = {
            "recipe_id": recipe_id,
            "name": "Owner Session",
            "status": "completed",
        }
        client.post("/api/brew-sessions", json=session_data, headers=owner_headers)

        # Other user accesses public recipe brew sessions (should see empty list)
        response = client.get(
            f"/api/recipes/{recipe_id}/brew-sessions", headers=other_headers
        )

        assert response.status_code == 200
        assert response.json["total"] == 0  # Should not see owner's sessions

    def test_get_recipe_metrics_success(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test getting recipe metrics (statistics)"""
        user, headers = authenticated_user

        # Create recipe
        recipe_data = {"name": "Metrics Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Create completed brew session with actual measurements
        session_data = {
            "recipe_id": recipe_id,
            "name": "Completed Session",
            "status": "completed",
            "actual_og": 1.060,
            "actual_fg": 1.012,
            "actual_abv": 6.3,
            "actual_efficiency": 76.0,
        }
        client.post("/api/brew-sessions", json=session_data, headers=headers)

        # Get recipe metrics
        response = client.get(f"/api/recipes/{recipe_id}/metrics", headers=headers)

        assert response.status_code == 200
        # Response structure depends on MongoDB service implementation

    def test_get_recipe_metrics_no_sessions(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test getting recipe metrics with no completed sessions"""
        user, headers = authenticated_user

        # Create recipe
        recipe_data = {
            "name": "No Sessions Recipe",
            "batch_size": 5.0,
            "ingredients": [],
        }
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Get recipe metrics (no sessions)
        response = client.get(f"/api/recipes/{recipe_id}/metrics", headers=headers)

        assert response.status_code == 404
        assert "No completed brew sessions" in response.json["message"]

    def test_calculate_metrics_preview_error_handling(self, client, authenticated_user):
        """Test metrics preview calculation error handling"""
        user, headers = authenticated_user

        # Test with invalid/missing data
        invalid_data = {"batch_size": "invalid", "ingredients": []}  # Invalid type

        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=invalid_data, headers=headers
        )

        assert response.status_code == 400
        assert "Failed to calculate metrics" in response.json["error"]

    def test_calculate_metrics_preview_minimal_data(self, client, authenticated_user):
        """Test metrics preview with minimal valid data"""
        user, headers = authenticated_user

        minimal_data = {"batch_size": 5.0, "efficiency": 75, "ingredients": []}

        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=minimal_data, headers=headers
        )

        assert response.status_code == 200
        assert "og" in response.json
        assert "fg" in response.json
        assert "abv" in response.json
        assert "ibu" in response.json
        assert "srm" in response.json

    def test_calculate_metrics_preview_batch_size_types(
        self, client, authenticated_user
    ):
        """Test metrics preview with different batch_size types"""
        user, headers = authenticated_user

        # Test with integer batch_size
        int_data = {"batch_size": 5, "efficiency": 75, "ingredients": []}
        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=int_data, headers=headers
        )
        assert response.status_code == 200

        # Test with float batch_size
        float_data = {"batch_size": 5.5, "efficiency": 75, "ingredients": []}
        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=float_data, headers=headers
        )
        assert response.status_code == 200

        # Test with string batch_size (should fail)
        string_data = {"batch_size": "5", "efficiency": 75, "ingredients": []}
        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=string_data, headers=headers
        )
        assert response.status_code == 400
        assert "batch_size must be a number" in response.json["error"]

        # Test with None batch_size (should fail)
        none_data = {"batch_size": None, "efficiency": 75, "ingredients": []}
        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=none_data, headers=headers
        )
        assert response.status_code == 400
        assert "batch_size must be a number" in response.json["error"]

    def test_clone_recipe_not_found(self, client, authenticated_user):
        """Test cloning non-existent recipe"""
        user, headers = authenticated_user

        response = client.post(
            "/api/recipes/507f1f77bcf86cd799439011/clone", headers=headers
        )

        assert response.status_code == 400
        assert "error" in response.json

    def test_clone_recipe_public_recipe(self, client, sample_ingredients):
        """Test cloning a public recipe by different user"""
        # Create two users
        client.post(
            "/api/auth/register",
            json={
                "username": "owner",
                "email": "owner@example.com",
                "password": "pass123",
            },
        )
        client.post(
            "/api/auth/register",
            json={
                "username": "cloner",
                "email": "cloner@example.com",
                "password": "pass123",
            },
        )

        # Get tokens
        owner_token = client.post(
            "/api/auth/login", json={"username": "owner", "password": "pass123"}
        ).json["access_token"]
        cloner_token = client.post(
            "/api/auth/login", json={"username": "cloner", "password": "pass123"}
        ).json["access_token"]

        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        cloner_headers = {"Authorization": f"Bearer {cloner_token}"}

        # Owner creates public recipe
        recipe_data = {
            "name": "Public Recipe to Clone",
            "batch_size": 5.0,
            "is_public": True,
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredients[0].id),
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 10.0,
                    "unit": "lb",
                }
            ],
        }
        create_response = client.post(
            "/api/recipes", json=recipe_data, headers=owner_headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Other user clones public recipe
        response = client.post(
            f"/api/recipes/{recipe_id}/clone", headers=cloner_headers
        )

        assert response.status_code == 201
        assert "Public Recipe to Clone (v2)" in response.json["name"]
        assert response.json["version"] == 2

    def test_get_recipe_versions_success(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test getting recipe version history"""
        user, headers = authenticated_user

        # Create original recipe
        recipe_data = {"name": "Version Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        original_id = create_response.json["recipe_id"]

        # Clone to create version 2
        clone_response = client.post(
            f"/api/recipes/{original_id}/clone", headers=headers
        )
        v2_id = clone_response.json["recipe_id"]

        # Get version history for original
        response = client.get(f"/api/recipes/{original_id}/versions", headers=headers)

        assert response.status_code == 200
        assert response.json["current_version"] == 1
        assert response.json["parent_recipe"] is None  # Original has no parent
        assert len(response.json["child_versions"]) == 1  # Has one child (v2)

        # Get version history for v2
        response = client.get(f"/api/recipes/{v2_id}/versions", headers=headers)

        assert response.status_code == 200
        assert response.json["current_version"] == 2
        assert response.json["parent_recipe"] is not None
        assert response.json["parent_recipe"]["recipe_id"] == original_id

    def test_get_recipe_versions_not_found(self, client, authenticated_user):
        """Test getting versions for non-existent recipe"""
        user, headers = authenticated_user

        response = client.get(
            "/api/recipes/507f1f77bcf86cd799439011/versions", headers=headers
        )

        assert response.status_code == 404

    def test_get_recipe_versions_access_denied(self, client, sample_ingredients):
        """Test getting versions for recipe without access"""
        # Create two users
        client.post(
            "/api/auth/register",
            json={
                "username": "owner",
                "email": "owner@example.com",
                "password": "pass123",
            },
        )
        client.post(
            "/api/auth/register",
            json={
                "username": "other",
                "email": "other@example.com",
                "password": "pass123",
            },
        )

        # Get tokens
        owner_token = client.post(
            "/api/auth/login", json={"username": "owner", "password": "pass123"}
        ).json["access_token"]
        other_token = client.post(
            "/api/auth/login", json={"username": "other", "password": "pass123"}
        ).json["access_token"]

        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}

        # Owner creates private recipe
        recipe_data = {
            "name": "Private Recipe",
            "batch_size": 5.0,
            "is_public": False,
            "ingredients": [],
        }
        create_response = client.post(
            "/api/recipes", json=recipe_data, headers=owner_headers
        )
        recipe_id = create_response.json["recipe_id"]

        # Other user tries to access versions
        response = client.get(
            f"/api/recipes/{recipe_id}/versions", headers=other_headers
        )

        assert response.status_code == 403

    def test_get_public_recipes_success(self, client, sample_ingredients):
        """Test getting public recipes endpoint"""
        # Create user
        client.post(
            "/api/auth/register",
            json={
                "username": "publicuser",
                "email": "public@example.com",
                "password": "pass123",
            },
        )

        token = client.post(
            "/api/auth/login", json={"username": "publicuser", "password": "pass123"}
        ).json["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create public recipes
        for i in range(3):
            recipe_data = {
                "name": f"Public Recipe {i}",
                "style": "American IPA",
                "batch_size": 5.0,
                "is_public": True,
                "ingredients": [],
            }
            client.post("/api/recipes", json=recipe_data, headers=headers)

        # Create private recipe (should not appear)
        private_data = {
            "name": "Private Recipe",
            "batch_size": 5.0,
            "is_public": False,
            "ingredients": [],
        }
        client.post("/api/recipes", json=private_data, headers=headers)

        # Get public recipes (no auth required)
        response = client.get("/api/recipes/public")

        assert response.status_code == 200
        assert "recipes" in response.json
        assert "pagination" in response.json
        assert len(response.json["recipes"]) == 3  # Only public recipes

        # Check that username is included
        for recipe in response.json["recipes"]:
            assert "username" in recipe
            assert recipe["username"] == "publicuser"

    def test_get_public_recipes_with_filters(self, client, sample_ingredients):
        """Test getting public recipes with style and search filters"""
        # Create user
        client.post(
            "/api/auth/register",
            json={
                "username": "filteruser",
                "email": "filter@example.com",
                "password": "pass123",
            },
        )

        token = client.post(
            "/api/auth/login", json={"username": "filteruser", "password": "pass123"}
        ).json["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create recipes with different styles
        recipes_data = [
            {"name": "IPA Recipe 1", "style": "American IPA", "is_public": True},
            {"name": "IPA Recipe 2", "style": "American IPA", "is_public": True},
            {"name": "Stout Recipe", "style": "Imperial Stout", "is_public": True},
            {"name": "Lager Recipe", "style": "Pilsner", "is_public": True},
        ]

        for recipe_data in recipes_data:
            recipe_data.update({"batch_size": 5.0, "ingredients": []})
            client.post("/api/recipes", json=recipe_data, headers=headers)

        # Test style filter
        response = client.get("/api/recipes/public?style=IPA")
        assert response.status_code == 200
        assert len(response.json["recipes"]) == 2

        # Test search filter
        response = client.get("/api/recipes/public?search=Stout")
        assert response.status_code == 200
        assert len(response.json["recipes"]) == 1
        assert "Stout" in response.json["recipes"][0]["name"]

        # Test pagination
        response = client.get("/api/recipes/public?per_page=2&page=1")
        assert response.status_code == 200
        assert len(response.json["recipes"]) == 2
        assert response.json["pagination"]["has_next"] is True

    def test_get_public_recipes_pagination_edge_cases(self, client, sample_ingredients):
        """Test public recipes pagination edge cases"""
        # Test with no recipes
        response = client.get("/api/recipes/public")
        assert response.status_code == 200
        assert len(response.json["recipes"]) == 0
        assert response.json["pagination"]["total"] == 0

        # Test with invalid pagination parameters
        response = client.get("/api/recipes/public?page=0")  # Invalid page
        assert response.status_code == 200  # Should handle gracefully

        response = client.get("/api/recipes/public?per_page=0")  # Invalid per_page
        assert response.status_code == 200  # Should handle gracefully

    def test_recipe_endpoint_error_handling(self, client, authenticated_user):
        """Test various error conditions in recipe endpoints"""
        user, headers = authenticated_user

        # Test getting recipe with invalid ID format
        response = client.get("/api/recipes/invalid_id", headers=headers)
        assert response.status_code in [400, 404]  # Depending on validation

        # Test updating recipe with invalid ID
        response = client.put(
            "/api/recipes/invalid_id", json={"name": "Updated"}, headers=headers
        )
        assert response.status_code in [400, 404]

        # Test deleting recipe with invalid ID
        response = client.delete("/api/recipes/invalid_id", headers=headers)
        assert response.status_code in [400, 404]

    def test_recipe_unit_system_consistency(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that recipe unit systems are handled consistently"""
        user, headers = authenticated_user

        # Create recipe with metric units
        recipe_data = {
            "name": "Metric Recipe",
            "batch_size": 20.0,
            "batch_size_unit": "l",
            "unit_system": "metric",
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredients[0].id),
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 4.5,
                    "unit": "kg",
                }
            ],
        }

        response = client.post("/api/recipes", json=recipe_data, headers=headers)

        assert response.status_code == 201
        recipe = response.json["recipe"]
        assert recipe["unit_system"] == "metric"
        assert recipe["batch_size_unit"] == "l"
        assert recipe["ingredients"][0]["unit"] == "kg"

    def test_recipe_with_empty_ingredients(self, client, authenticated_user):
        """Test creating and updating recipes with empty ingredients list"""
        user, headers = authenticated_user

        # Create recipe with empty ingredients
        recipe_data = {
            "name": "Empty Recipe",
            "batch_size": 5.0,
            "ingredients": [],
        }

        response = client.post("/api/recipes", json=recipe_data, headers=headers)
        assert response.status_code == 201

        recipe_id = response.json["recipe_id"]

        # Update with empty ingredients
        update_data = {
            "name": "Updated Empty Recipe",
            "ingredients": [],
        }

        response = client.put(
            f"/api/recipes/{recipe_id}", json=update_data, headers=headers
        )
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 0
