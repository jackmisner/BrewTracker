import pytest
import json
from models.mongo_models import User, Recipe, Ingredient


class TestRecipeEndpoints:
    """Test recipe CRUD operations and business logic"""

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

    def test_create_recipe_success(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test successful recipe creation"""
        user, headers = authenticated_user

        recipe_data = {
            "name": "American IPA",
            "style": "American IPA",
            "batch_size": 5.0,
            "description": "A hoppy American IPA",
            "boil_time": 60,
            "efficiency": 75,
            "is_public": False,
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredients[0].id),
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 10.0,
                    "unit": "lb",
                    "potential": 36,
                    "color": 2.0,
                },
                {
                    "ingredient_id": str(sample_ingredients[2].id),
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "use": "boil",
                    "time": 60,
                    "alpha_acid": 5.5,
                },
                {
                    "ingredient_id": str(sample_ingredients[3].id),
                    "name": "US-05",
                    "type": "yeast",
                    "amount": 1.0,
                    "unit": "pkg",
                    "attenuation": 75.0,
                },
            ],
        }

        response = client.post("/api/recipes", json=recipe_data, headers=headers)

        assert response.status_code == 201
        assert response.json["name"] == "American IPA"
        assert response.json["style"] == "American IPA"
        assert response.json["batch_size"] == 5.0
        assert len(response.json["ingredients"]) == 3

        # Verify recipe was saved to database
        recipe = Recipe.objects(name="American IPA").first()
        assert recipe is not None
        assert str(recipe.user_id) == str(user.id)

    # def test_create_recipe_validation_errors(self, client, authenticated_user):
    #     """Test recipe creation with validation errors"""
    #     user, headers = authenticated_user

    #     # Test missing required fields
    #     response = client.post("/api/recipes", json={}, headers=headers)
    #     assert response.status_code == 400

    #     # Test invalid batch size
    #     recipe_data = {"name": "Invalid Recipe", "batch_size": -1, "ingredients": []}
    #     response = client.post("/api/recipes", json=recipe_data, headers=headers)
    #     assert response.status_code == 400

    def test_get_user_recipes(self, client, authenticated_user, sample_ingredients):
        """Test retrieving user's recipes"""
        user, headers = authenticated_user

        # Create a few recipes
        for i in range(3):
            recipe_data = {
                "name": f"Test Recipe {i}",
                "batch_size": 5.0,
                "ingredients": [
                    {
                        "ingredient_id": str(sample_ingredients[0].id),
                        "name": "Pale Malt",
                        "type": "grain",
                        "amount": 8.0,
                        "unit": "lb",
                    }
                ],
            }
            client.post("/api/recipes", json=recipe_data, headers=headers)

        # Get recipes
        response = client.get("/api/recipes", headers=headers)

        assert response.status_code == 200
        assert len(response.json["recipes"]) == 3
        assert "pagination" in response.json

    def test_get_recipe_by_id(self, client, authenticated_user, sample_ingredients):
        """Test retrieving a specific recipe"""
        user, headers = authenticated_user

        # Create recipe
        recipe_data = {"name": "Test Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Get recipe by ID
        response = client.get(f"/api/recipes/{recipe_id}", headers=headers)

        assert response.status_code == 200
        assert response.json["name"] == "Test Recipe"
        assert response.json["recipe_id"] == recipe_id

    def test_get_recipe_not_found(self, client, authenticated_user):
        """Test retrieving non-existent recipe"""
        user, headers = authenticated_user

        response = client.get("/api/recipes/507f1f77bcf86cd799439011", headers=headers)
        assert response.status_code == 404

    def test_update_recipe(self, client, authenticated_user, sample_ingredients):
        """Test updating a recipe"""
        user, headers = authenticated_user

        # Create recipe
        recipe_data = {"name": "Original Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Update recipe
        update_data = {
            "name": "Updated Recipe",
            "batch_size": 6.0,
            "description": "Updated description",
            "ingredients": [
                {
                    "ingredient_id": str(sample_ingredients[0].id),
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 12.0,
                    "unit": "lb",
                }
            ],
        }

        response = client.put(
            f"/api/recipes/{recipe_id}", json=update_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json["name"] == "Updated Recipe"
        assert response.json["batch_size"] == 6.0
        assert response.json["description"] == "Updated description"
        assert len(response.json["ingredients"]) == 1

    def test_delete_recipe(self, client, authenticated_user):
        """Test deleting a recipe"""
        user, headers = authenticated_user

        # Create recipe
        recipe_data = {"name": "Recipe to Delete", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Delete recipe
        response = client.delete(f"/api/recipes/{recipe_id}", headers=headers)

        assert response.status_code == 200
        assert "deleted successfully" in response.json["message"]

        # Verify recipe is deleted
        get_response = client.get(f"/api/recipes/{recipe_id}", headers=headers)
        assert get_response.status_code == 404

    def test_clone_recipe(self, client, authenticated_user, sample_ingredients):
        """Test cloning a recipe"""
        user, headers = authenticated_user

        # Create original recipe
        recipe_data = {
            "name": "Original Recipe",
            "style": "IPA",
            "batch_size": 5.0,
            "description": "Original description",
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
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        recipe_id = create_response.json["recipe_id"]

        # Clone recipe
        response = client.post(f"/api/recipes/{recipe_id}/clone", headers=headers)

        assert response.status_code == 201
        assert response.json["name"] == "Original Recipe (v2)"
        assert response.json["version"] == 2
        assert response.json["parent_recipe_id"] == recipe_id
        assert len(response.json["ingredients"]) == 1

    def test_recipe_metrics_calculation(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test recipe metrics calculation endpoint"""
        user, headers = authenticated_user

        recipe_data = {
            "batch_size": 5.0,
            "efficiency": 75,
            "ingredients": [
                {
                    "type": "grain",
                    "amount": 10.0,
                    "unit": "lb",
                    "potential": 36,
                    "color": 2.0,
                },
                {
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "alpha_acid": 5.5,
                    "use": "boil",
                    "time": 60,
                },
                {"type": "yeast", "attenuation": 75.0},
            ],
        }

        response = client.post(
            "/api/recipes/calculate-metrics-preview", json=recipe_data, headers=headers
        )

        assert response.status_code == 200
        assert "og" in response.json
        assert "fg" in response.json
        assert "abv" in response.json
        assert "ibu" in response.json
        assert "srm" in response.json

        # Basic sanity checks
        assert response.json["og"] > 1.0
        assert response.json["fg"] > 1.0
        assert response.json["og"] > response.json["fg"]
        assert response.json["abv"] > 0
        assert response.json["ibu"] > 0

    def test_recipe_access_control(self, client, sample_ingredients):
        """Test recipe access control for different users"""
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

        # User1 creates a private recipe
        recipe_data = {
            "name": "Private Recipe",
            "batch_size": 5.0,
            "is_public": False,
            "ingredients": [],
        }
        create_response = client.post(
            "/api/recipes", json=recipe_data, headers=user1_headers
        )
        recipe_id = create_response.json["recipe_id"]

        # User2 should not be able to access user1's private recipe
        response = client.get(f"/api/recipes/{recipe_id}", headers=user2_headers)
        assert response.status_code == 403

        # User1 makes recipe public
        client.put(
            f"/api/recipes/{recipe_id}", json={"is_public": True}, headers=user1_headers
        )

        # User2 should now be able to view the public recipe
        response = client.get(f"/api/recipes/{recipe_id}", headers=user2_headers)
        assert response.status_code == 200

    def test_recipe_version_history(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test recipe version history functionality"""
        user, headers = authenticated_user

        # Create original recipe
        recipe_data = {"name": "Base Recipe", "batch_size": 5.0, "ingredients": []}
        create_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        original_id = create_response.json["recipe_id"]

        # Clone to create version 2
        clone_response = client.post(
            f"/api/recipes/{original_id}/clone", headers=headers
        )
        v2_id = clone_response.json["recipe_id"]

        # Clone v2 to create version 3
        clone2_response = client.post(f"/api/recipes/{v2_id}/clone", headers=headers)
        v3_id = clone2_response.json["recipe_id"]

        # Get version history for v3
        response = client.get(f"/api/recipes/{v3_id}/versions", headers=headers)

        assert response.status_code == 200
        assert response.json["current_version"] == 3
        assert response.json["parent_recipe"]["recipe_id"] == original_id
        assert len(response.json["child_versions"]) == 0  # v3 has no children yet
