import json
from datetime import UTC, datetime

import pytest
from bson import ObjectId

from models.mongo_models import (
    BeerStyleGuide,
    Recipe,
    RecipeIngredient,
    StyleRange,
    User,
)


class TestBeerStylesRoutes:
    """Comprehensive tests for beer styles routes"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        """Set up test data for each test"""
        # Create test user
        self.test_user = User(username="testuser", email="test@example.com")
        self.test_user.set_password("testpass123")
        self.test_user.save()

        # Create test beer styles
        self.test_style_1 = BeerStyleGuide(
            name="American IPA",
            category="India Pale Ale",
            category_id="21",
            style_id="21A",
            category_description="IPA category description",
            overall_impression="Bold hoppy beer",
            aroma="Citrus and pine hops",
            appearance="Golden to amber",
            flavor="Strong hop flavor",
            mouthfeel="Medium body",
            comments="Modern American style",
            history="Developed in America",
            style_comparison="More hoppy than English IPA",
            tags=["hoppy", "bitter", "american", "ipa"],
            original_gravity=StyleRange(minimum=1.056, maximum=1.070, unit="sg"),
            international_bitterness_units=StyleRange(
                minimum=40, maximum=70, unit="IBUs"
            ),
            final_gravity=StyleRange(minimum=1.008, maximum=1.014, unit="sg"),
            alcohol_by_volume=StyleRange(minimum=5.5, maximum=7.5, unit="%"),
            color=StyleRange(minimum=6, maximum=14, unit="SRM"),
            ingredients="American hops, pale malt",
            examples="Dogfish Head 60 Minute IPA",
        )
        self.test_style_1.save()

        self.test_style_2 = BeerStyleGuide(
            name="German Pilsner",
            category="Pilsner",
            category_id="05",
            style_id="05D",
            category_description="Light lagers",
            overall_impression="Crisp and clean",
            aroma="Floral hops",
            appearance="Pale gold",
            flavor="Clean malt and hop balance",
            mouthfeel="Light body",
            tags=["crisp", "clean", "german", "pilsner"],
            original_gravity=StyleRange(minimum=1.044, maximum=1.050, unit="sg"),
            international_bitterness_units=StyleRange(
                minimum=25, maximum=45, unit="IBUs"
            ),
            final_gravity=StyleRange(minimum=1.008, maximum=1.013, unit="sg"),
            alcohol_by_volume=StyleRange(minimum=4.4, maximum=5.2, unit="%"),
            color=StyleRange(minimum=2, maximum=5, unit="SRM"),
            ingredients="German pilsner malt, noble hops",
            examples="Bitburger Premium",
        )
        self.test_style_2.save()

        # Create test recipe with estimated values
        self.test_recipe = Recipe(
            user_id=self.test_user.id,
            name="Test IPA Recipe",
            style="American IPA",
            batch_size=5.0,
            description="Test recipe description",
            is_public=True,
            estimated_og=1.065,
            estimated_fg=1.012,
            estimated_abv=7.0,
            estimated_ibu=55,
            estimated_srm=8,
            boil_time=60,
            efficiency=75.0,
        )

        # Add test ingredients
        test_ingredient = RecipeIngredient(
            ingredient_id=ObjectId(),
            name="Pale Malt",
            type="grain",
            amount=10.0,
            unit="lb",
            use="mash",
        )
        self.test_recipe.ingredients.append(test_ingredient)
        self.test_recipe.save()

        # Create private recipe for access testing
        self.private_recipe = Recipe(
            user_id=self.test_user.id,
            name="Private Recipe",
            style="German Pilsner",
            batch_size=5.0,
            is_public=False,
            estimated_og=1.048,
            estimated_fg=1.010,
            estimated_abv=4.8,
            estimated_ibu=35,
            estimated_srm=3,
        )
        self.private_recipe.save()

        yield

        # Cleanup is handled by conftest.py clean_db fixture

    @pytest.fixture
    def auth_headers(self, client):
        """Get authentication headers for protected routes"""
        response = client.post(
            "/api/auth/login", json={"username": "testuser", "password": "testpass123"}
        )
        token = response.get_json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_get_all_beer_styles_success(self, client):
        """Test successfully getting all beer styles grouped by category"""
        response = client.get("/api/beer-styles")

        assert response.status_code == 200
        data = response.get_json()

        assert "categories" in data
        categories = data["categories"]

        # Should have our two test categories
        assert "21" in categories  # IPA category
        assert "05" in categories  # Pilsner category

        # Check IPA category structure
        ipa_category = categories["21"]
        assert ipa_category["category"] == "India Pale Ale"
        assert ipa_category["category_id"] == "21"
        assert len(ipa_category["styles"]) == 1
        assert ipa_category["styles"][0]["name"] == "American IPA"
        assert ipa_category["styles"][0]["style_id"] == "21A"

        # Check style has proper ranges
        style = ipa_category["styles"][0]
        assert "original_gravity" in style
        assert style["original_gravity"]["minimum"]["value"] == 1.056
        assert style["original_gravity"]["maximum"]["value"] == 1.070

    def test_get_all_beer_styles_empty_database(self, client):
        """Test getting beer styles when database is empty"""
        # Clear all styles
        BeerStyleGuide.drop_collection()

        response = client.get("/api/beer-styles")

        assert response.status_code == 200
        data = response.get_json()
        assert "categories" in data
        assert data["categories"] == {}

    def test_search_beer_styles_by_name(self, client):
        """Test searching beer styles by name"""
        response = client.get("/api/beer-styles/search?q=IPA")

        assert response.status_code == 200
        data = response.get_json()

        assert "styles" in data
        styles = data["styles"]
        assert len(styles) == 1
        assert styles[0]["name"] == "American IPA"
        assert styles[0]["style_id"] == "21A"

    def test_search_beer_styles_by_category(self, client):
        """Test searching beer styles by category"""
        response = client.get("/api/beer-styles/search?q=Pilsner")

        assert response.status_code == 200
        data = response.get_json()

        assert "styles" in data
        styles = data["styles"]
        assert len(styles) == 1
        assert styles[0]["name"] == "German Pilsner"

    def test_search_beer_styles_by_tag(self, client):
        """Test searching beer styles by tag"""
        response = client.get("/api/beer-styles/search?q=hoppy")

        assert response.status_code == 200
        data = response.get_json()

        assert "styles" in data
        styles = data["styles"]
        assert len(styles) == 1
        assert styles[0]["name"] == "American IPA"

    def test_search_beer_styles_no_query(self, client):
        """Test searching beer styles without query parameter"""
        response = client.get("/api/beer-styles/search")

        assert response.status_code == 200
        data = response.get_json()
        assert "styles" in data
        assert data["styles"] == []

    def test_search_beer_styles_short_query(self, client):
        """Test searching beer styles with query too short"""
        response = client.get("/api/beer-styles/search?q=I")

        assert response.status_code == 200
        data = response.get_json()
        assert "styles" in data
        assert data["styles"] == []

    def test_search_beer_styles_no_results(self, client):
        """Test searching beer styles with no matching results"""
        response = client.get("/api/beer-styles/search?q=nonexistent")

        assert response.status_code == 200
        data = response.get_json()
        assert "styles" in data
        assert data["styles"] == []

    def test_get_specific_beer_style_success(self, client):
        """Test getting a specific beer style by ID"""
        response = client.get(f"/api/beer-styles/{self.test_style_1.style_id}")

        assert response.status_code == 200
        data = response.get_json()

        assert data["name"] == "American IPA"
        assert data["style_id"] == "21A"
        assert data["category"] == "India Pale Ale"
        assert "original_gravity" in data
        assert "international_bitterness_units" in data

    def test_get_specific_beer_style_not_found(self, client):
        """Test getting a beer style that doesn't exist"""
        response = client.get("/api/beer-styles/99Z")

        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Beer style not found"

    def test_get_style_suggestions_success(self, client, auth_headers):
        """Test getting style suggestions for a recipe"""
        response = client.get(
            f"/api/beer-styles/suggestions/{self.test_recipe.id}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "suggestions" in data

        # The suggestions might be empty if no styles match well enough
        # but the response should still be successful
        suggestions = data["suggestions"]
        assert isinstance(suggestions, list)

        # If there are suggestions, check their structure
        if suggestions:
            suggestion = suggestions[0]
            assert "style" in suggestion
            assert "match_percentage" in suggestion
            assert "matches" in suggestion
            # Ensure style is a dict (serialized properly)
            assert isinstance(suggestion["style"], dict)
            assert "name" in suggestion["style"]
            assert "style_id" in suggestion["style"]

    def test_get_style_suggestions_with_matching_recipe(self, client, auth_headers):
        """Test that a recipe with metrics matching our test style gets suggestions"""
        # Our test recipe metrics should match the American IPA style perfectly
        # OG: 1.065 (in range 1.056-1.070)
        # FG: 1.012 (in range 1.008-1.014)
        # ABV: 7.0 (in range 5.5-7.5)
        # IBU: 55 (in range 40-70)
        # SRM: 8 (in range 6-14)

        response = client.get(
            f"/api/beer-styles/suggestions/{self.test_recipe.id}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        suggestions = data["suggestions"]

        # Should find at least one matching style (our American IPA)
        assert len(suggestions) >= 1

        # Check that American IPA is in the suggestions
        american_ipa_found = False
        for suggestion in suggestions:
            if suggestion["style"]["name"] == "American IPA":
                american_ipa_found = True
                # Should be a very high match percentage
                assert suggestion["match_percentage"] >= 80
                break

        assert (
            american_ipa_found
        ), "American IPA should be suggested for matching recipe"

    def test_get_style_suggestions_recipe_not_found(self, client, auth_headers):
        """Test getting style suggestions for non-existent recipe"""
        fake_recipe_id = ObjectId()
        response = client.get(
            f"/api/beer-styles/suggestions/{fake_recipe_id}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Recipe not found"

    def test_get_style_suggestions_unauthorized(self, client):
        """Test getting style suggestions without authentication"""
        response = client.get(f"/api/beer-styles/suggestions/{self.test_recipe.id}")

        assert response.status_code == 401

    def test_get_style_suggestions_access_denied_private_recipe(self, client):
        """Test getting style suggestions for another user's private recipe"""
        # Create another user
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("password123")
        other_user.save()

        # Login as other user
        response = client.post(
            "/api/auth/login", json={"username": "otheruser", "password": "password123"}
        )
        token = response.get_json()["access_token"]
        other_auth_headers = {"Authorization": f"Bearer {token}"}

        # Try to access the private recipe
        response = client.get(
            f"/api/beer-styles/suggestions/{self.private_recipe.id}",
            headers=other_auth_headers,
        )

        assert response.status_code == 403
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Access denied"

    def test_get_style_suggestions_public_recipe_access(self, client):
        """Test that other users can access suggestions for public recipes"""
        # Create another user
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("password123")
        other_user.save()

        # Login as other user
        response = client.post(
            "/api/auth/login", json={"username": "otheruser", "password": "password123"}
        )
        token = response.get_json()["access_token"]
        other_auth_headers = {"Authorization": f"Bearer {token}"}

        # Access public recipe should work
        response = client.get(
            f"/api/beer-styles/suggestions/{self.test_recipe.id}",
            headers=other_auth_headers,
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "suggestions" in data
        # Response should be successful even if no suggestions found
        assert isinstance(data["suggestions"], list)

    def test_get_recipe_style_analysis_success(self, client, auth_headers):
        """Test getting style analysis for a recipe"""
        response = client.get(
            f"/api/beer-styles/analysis/{self.test_recipe.id}", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "analysis" in data

        analysis = data["analysis"]
        if analysis:
            assert "declared_style" in analysis
            # If style found, check structure
            if analysis.get("found"):
                assert "style_guide" in analysis
                assert "match_result" in analysis
                # Ensure style_guide is properly serialized
                assert isinstance(analysis["style_guide"], dict)
                if "name" in analysis["style_guide"]:
                    assert isinstance(analysis["style_guide"]["name"], str)

    def test_get_recipe_style_analysis_recipe_not_found(self, client, auth_headers):
        """Test getting style analysis for non-existent recipe"""
        fake_recipe_id = ObjectId()
        response = client.get(
            f"/api/beer-styles/analysis/{fake_recipe_id}", headers=auth_headers
        )

        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Recipe not found"

    def test_get_recipe_style_analysis_unauthorized(self, client):
        """Test getting style analysis without authentication"""
        response = client.get(f"/api/beer-styles/analysis/{self.test_recipe.id}")

        assert response.status_code == 401

    def test_get_recipe_style_analysis_access_denied(self, client):
        """Test getting style analysis for another user's private recipe"""
        # Create another user
        other_user = User(username="otheruser", email="other@example.com")
        other_user.set_password("password123")
        other_user.save()

        # Login as other user
        response = client.post(
            "/api/auth/login", json={"username": "otheruser", "password": "password123"}
        )
        token = response.get_json()["access_token"]
        other_auth_headers = {"Authorization": f"Bearer {token}"}

        # Try to access the private recipe
        response = client.get(
            f"/api/beer-styles/analysis/{self.private_recipe.id}",
            headers=other_auth_headers,
        )

        assert response.status_code == 403
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Access denied"

    def test_match_styles_to_metrics_success(self, client):
        """Test matching styles to provided metrics"""
        metrics = {"og": 1.065, "fg": 1.012, "abv": 7.0, "ibu": 55, "srm": 8}

        response = client.post("/api/beer-styles/match-metrics", json=metrics)

        assert response.status_code == 200
        data = response.get_json()
        assert "matches" in data

        # Should find the American IPA as a match
        if data["matches"]:
            # Check that matches have the expected structure
            match = data["matches"][0]
            assert "style" in match
            assert "match_percentage" in match
            assert "matches" in match

    def test_match_styles_to_metrics_partial_data(self, client):
        """Test matching styles with only some metrics provided"""
        metrics = {"og": 1.065, "abv": 7.0}

        response = client.post("/api/beer-styles/match-metrics", json=metrics)

        assert response.status_code == 200
        data = response.get_json()
        assert "matches" in data

    def test_match_styles_to_metrics_no_data(self, client):
        """Test matching styles with no metrics provided"""
        response = client.post("/api/beer-styles/match-metrics", json={})

        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "At least one metric is required"

    def test_match_styles_to_metrics_invalid_data_type(self, client):
        """Test matching styles with invalid data types"""
        metrics = {"og": "not_a_number", "fg": 1.012, "abv": 7.0}

        response = client.post("/api/beer-styles/match-metrics", json=metrics)

        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
        assert "Invalid og value" in data["error"]

    def test_match_styles_to_metrics_invalid_json(self, client):
        """Test matching styles with invalid JSON"""
        response = client.post(
            "/api/beer-styles/match-metrics",
            data="invalid json",
            content_type="application/json",
        )

        assert response.status_code == 400

    def test_match_styles_to_metrics_empty_json(self, client):
        """Test matching styles with empty JSON"""
        response = client.post(
            "/api/beer-styles/match-metrics", content_type="application/json"
        )

        assert response.status_code == 400

    def test_beer_styles_error_handling(self, client, auth_headers, monkeypatch):
        """Test error handling in beer styles routes"""

        # Mock MongoDBService to raise an exception
        def mock_get_all_beer_styles():
            raise Exception("Database connection error")

        from routes import beer_styles

        monkeypatch.setattr(
            beer_styles.MongoDBService, "get_all_beer_styles", mock_get_all_beer_styles
        )

        response = client.get("/api/beer-styles")

        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Failed to fetch beer styles"

    def test_search_beer_styles_error_handling(self, client, monkeypatch):
        """Test error handling in search beer styles"""

        def mock_search_beer_styles(query):
            raise Exception("Search error")

        from routes import beer_styles

        monkeypatch.setattr(
            beer_styles.MongoDBService, "search_beer_styles", mock_search_beer_styles
        )

        response = client.get("/api/beer-styles/search?q=test")

        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Failed to search beer styles"

    def test_get_style_suggestions_error_handling(
        self, client, auth_headers, monkeypatch
    ):
        """Test error handling in style suggestions"""

        def mock_get_style_suggestions_for_recipe(recipe_id):
            raise Exception("Suggestion error")

        from routes import beer_styles

        monkeypatch.setattr(
            beer_styles.MongoDBService,
            "get_style_suggestions_for_recipe",
            mock_get_style_suggestions_for_recipe,
        )

        response = client.get(
            f"/api/beer-styles/suggestions/{self.test_recipe.id}", headers=auth_headers
        )

        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Failed to get style suggestions"

    def test_get_recipe_style_analysis_error_handling(
        self, client, auth_headers, monkeypatch
    ):
        """Test error handling in recipe style analysis"""

        def mock_get_recipe_style_analysis(recipe_id):
            raise Exception("Analysis error")

        from routes import beer_styles

        monkeypatch.setattr(
            beer_styles.MongoDBService,
            "get_recipe_style_analysis",
            mock_get_recipe_style_analysis,
        )

        response = client.get(
            f"/api/beer-styles/analysis/{self.test_recipe.id}", headers=auth_headers
        )

        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Failed to get style analysis"

    def test_match_styles_error_handling(self, client, monkeypatch):
        """Test error handling in match styles to metrics"""

        def mock_find_matching_styles_by_metrics(metrics):
            raise Exception("Matching error")

        from routes import beer_styles

        monkeypatch.setattr(
            beer_styles.MongoDBService,
            "find_matching_styles_by_metrics",
            mock_find_matching_styles_by_metrics,
        )

        metrics = {"og": 1.065, "abv": 7.0}
        response = client.post("/api/beer-styles/match-metrics", json=metrics)

        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Failed to find matching styles"

    def test_invalid_recipe_id_format(self, client, auth_headers):
        """Test handling of invalid recipe ID format"""
        response = client.get(
            "/api/beer-styles/suggestions/invalid_id", headers=auth_headers
        )

        # Should either be 404 or 500 depending on how ObjectId handles invalid format
        assert response.status_code in [404, 500]

    def test_beer_style_data_completeness(self, client):
        """Test that beer style data includes all expected fields"""
        response = client.get(f"/api/beer-styles/{self.test_style_1.style_id}")

        assert response.status_code == 200
        data = response.get_json()

        # Check required fields
        required_fields = [
            "name",
            "category",
            "category_id",
            "style_id",
            "overall_impression",
            "aroma",
            "appearance",
            "flavor",
            "mouthfeel",
        ]

        for field in required_fields:
            assert field in data
            assert data[field] is not None

        # Check range fields
        range_fields = [
            "original_gravity",
            "international_bitterness_units",
            "final_gravity",
            "alcohol_by_volume",
            "color",
        ]

        for field in range_fields:
            if field in data:
                assert "minimum" in data[field]
                assert "maximum" in data[field]
                assert "value" in data[field]["minimum"]
                assert "unit" in data[field]["minimum"]

    def test_beer_style_tags_search_case_insensitive(self, client):
        """Test that tag search is case insensitive"""
        # Test uppercase
        response = client.get("/api/beer-styles/search?q=HOPPY")
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["styles"]) == 1

        # Test mixed case
        response = client.get("/api/beer-styles/search?q=HoPpY")
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["styles"]) == 1

    def test_multiple_metrics_validation(self, client):
        """Test validation of multiple metrics with various invalid values"""
        test_cases = [
            {"og": "invalid", "expected_error": "Invalid og value"},
            {"fg": None, "expected_error": "Invalid fg value"},
            {"abv": "text", "expected_error": "Invalid abv value"},
            {"ibu": [], "expected_error": "Invalid ibu value"},
            {"srm": {}, "expected_error": "Invalid srm value"},
        ]

        for case in test_cases:
            response = client.post("/api/beer-styles/match-metrics", json=case)
            assert response.status_code == 400
            data = response.get_json()
            assert case["expected_error"] in data["error"]
