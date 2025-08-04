import pytest

from models.mongo_models import Ingredient, Recipe, User


class TestIngredientEndpoints:
    """Test ingredient CRUD operations and search functionality"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user, return user and auth headers"""
        # Register user
        client.post(
            "/api/auth/register",
            json={
                "username": "ingredientuser",
                "email": "ingredients@example.com",
                "password": "TestPass123!",
            },
        )

        # Login to get token
        login_response = client.post(
            "/api/auth/login",
            json={"username": "ingredientuser", "password": "TestPass123!"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="ingredientuser").first()

        return user, {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredients for testing"""
        ingredients = [
            Ingredient(
                name="Pale Malt (2-row)",
                type="grain",
                grain_type="base_malt",
                potential=36,
                color=2.0,
                description="Base malt for most beer styles",
            ),
            Ingredient(
                name="Crystal 60L",
                type="grain",
                grain_type="caramel_crystal",
                potential=34,
                color=60.0,
                description="Adds caramel flavor and color",
            ),
            Ingredient(
                name="Chocolate Malt",
                type="grain",
                grain_type="roasted",
                potential=29,
                color=350.0,
                description="Provides chocolate and coffee flavors",
            ),
            Ingredient(
                name="Cascade",
                type="hop",
                alpha_acid=5.5,
                description="Classic American hop with citrus character",
            ),
            Ingredient(
                name="Centennial",
                type="hop",
                alpha_acid=10.0,
                description="Floral and citrus hop variety",
            ),
            Ingredient(
                name="US-05",
                type="yeast",
                attenuation=81.0,
                manufacturer="Fermentis",
                code="US-05",
                description="American ale yeast",
            ),
            Ingredient(
                name="WLP001",
                type="yeast",
                attenuation=73.0,
                manufacturer="White Labs",
                code="WLP001",
                description="California Ale Yeast",
            ),
            Ingredient(
                name="Irish Moss",
                type="other",
                description="Clarifying agent for the boil",
            ),
        ]

        for ingredient in ingredients:
            ingredient.save()

        return ingredients

    def test_get_all_ingredients(self, client, authenticated_user, sample_ingredients):
        """Test retrieving all ingredients"""
        user, headers = authenticated_user

        response = client.get("/api/ingredients", headers=headers)

        assert response.status_code == 200
        # The response now includes additional metadata
        assert "ingredients" in response.json
        assert "unit_system" in response.json
        assert "unit_preferences" in response.json
        assert len(response.json["ingredients"]) == 8

        # Check that we get the expected ingredients
        ingredient_names = [ing["name"] for ing in response.json["ingredients"]]
        assert "Pale Malt (2-row)" in ingredient_names
        assert "Cascade" in ingredient_names
        assert "US-05" in ingredient_names

    def test_get_ingredients_by_type(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test filtering ingredients by type"""
        user, headers = authenticated_user

        # Test grain filter
        response = client.get("/api/ingredients?type=grain", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 3
        for ingredient in response.json["ingredients"]:
            assert ingredient["type"] == "grain"

        # Test hop filter
        response = client.get("/api/ingredients?type=hop", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 2
        for ingredient in response.json["ingredients"]:
            assert ingredient["type"] == "hop"

        # Test yeast filter
        response = client.get("/api/ingredients?type=yeast", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 2
        for ingredient in response.json["ingredients"]:
            assert ingredient["type"] == "yeast"

        # Test other filter
        response = client.get("/api/ingredients?type=other", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 1
        assert response.json["ingredients"][0]["type"] == "other"

    def test_search_ingredients(self, client, authenticated_user, sample_ingredients):
        """Test searching ingredients by name"""
        user, headers = authenticated_user

        # Search for "malt"
        response = client.get("/api/ingredients?search=malt", headers=headers)
        assert response.status_code == 200
        assert (
            len(response.json["ingredients"]) >= 2
        )  # Should find Pale Malt and Chocolate Malt

        for ingredient in response.json["ingredients"]:
            assert "malt" in ingredient["name"].lower()

        # Search for "cascade"
        response = client.get("/api/ingredients?search=cascade", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 1
        assert response.json["ingredients"][0]["name"] == "Cascade"

        # Search with no results
        response = client.get("/api/ingredients?search=nonexistent", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 0

    def test_get_ingredient_by_id(self, client, authenticated_user, sample_ingredients):
        """Test retrieving a specific ingredient by ID"""
        user, headers = authenticated_user

        ingredient = sample_ingredients[0]  # Pale Malt
        response = client.get(f"/api/ingredients/{ingredient.id}", headers=headers)

        assert response.status_code == 200
        assert response.json["name"] == "Pale Malt (2-row)"
        assert response.json["type"] == "grain"
        assert response.json["grain_type"] == "base_malt"
        assert response.json["potential"] == 36
        assert response.json["color"] == 2.0

    def test_get_ingredient_not_found(self, client, authenticated_user):
        """Test retrieving non-existent ingredient"""
        user, headers = authenticated_user

        response = client.get(
            "/api/ingredients/507f1f77bcf86cd799439011", headers=headers
        )
        assert response.status_code == 404

    def test_create_ingredient(self, client, authenticated_user):
        """Test creating a new ingredient"""
        user, headers = authenticated_user

        ingredient_data = {
            "name": "Munich Malt",
            "type": "grain",
            "grain_type": "base_malt",
            "potential": 37,
            "color": 9.0,
            "description": "Adds rich malty flavor",
        }

        response = client.post(
            "/api/ingredients", json=ingredient_data, headers=headers
        )

        assert response.status_code == 201
        assert response.json["name"] == "Munich Malt"
        assert response.json["type"] == "grain"
        assert response.json["grain_type"] == "base_malt"
        assert response.json["potential"] == 37
        assert response.json["color"] == 9.0

        # Verify ingredient was saved to database
        ingredient = Ingredient.objects(name="Munich Malt").first()
        assert ingredient is not None
        assert ingredient.grain_type == "base_malt"

    def test_create_hop_ingredient(self, client, authenticated_user):
        """Test creating a hop ingredient with hop-specific fields"""
        user, headers = authenticated_user

        hop_data = {
            "name": "Simcoe",
            "type": "hop",
            "alpha_acid": 13.0,
            "description": "Pine and passion fruit character",
        }

        response = client.post("/api/ingredients", json=hop_data, headers=headers)

        assert response.status_code == 201
        assert response.json["name"] == "Simcoe"
        assert response.json["type"] == "hop"
        assert response.json["alpha_acid"] == 13.0
        assert response.json["description"] == "Pine and passion fruit character"

    def test_create_yeast_ingredient(self, client, authenticated_user):
        """Test creating a yeast ingredient with yeast-specific fields"""
        user, headers = authenticated_user

        yeast_data = {
            "name": "Wyeast 1056",
            "type": "yeast",
            "attenuation": 75.0,
            "manufacturer": "Wyeast",
            "code": "1056",
            "alcohol_tolerance": 11.0,
            "min_temperature": 60.0,
            "max_temperature": 72.0,
            "description": "American Ale yeast",
        }

        response = client.post("/api/ingredients", json=yeast_data, headers=headers)

        assert response.status_code == 201
        assert response.json["name"] == "Wyeast 1056"
        assert response.json["type"] == "yeast"
        assert response.json["attenuation"] == 75.0
        assert response.json["manufacturer"] == "Wyeast"
        assert response.json["code"] == "1056"
        assert response.json["alcohol_tolerance"] == 11.0

    def test_update_ingredient(self, client, authenticated_user, sample_ingredients):
        """Test updating an existing ingredient"""
        user, headers = authenticated_user

        ingredient = sample_ingredients[0]  # Pale Malt
        update_data = {
            "name": "Pale Malt (2-row) - Updated",
            "description": "Updated description for base malt",
            "potential": 37,  # Updated potential
        }

        response = client.put(
            f"/api/ingredients/{ingredient.id}", json=update_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json["name"] == "Pale Malt (2-row) - Updated"
        assert response.json["description"] == "Updated description for base malt"
        assert response.json["potential"] == 37

        # Verify update in database
        updated_ingredient = Ingredient.objects(id=ingredient.id).first()
        assert updated_ingredient.name == "Pale Malt (2-row) - Updated"
        assert updated_ingredient.potential == 37

    def test_update_ingredient_not_found(self, client, authenticated_user):
        """Test updating non-existent ingredient"""
        user, headers = authenticated_user

        update_data = {"name": "Updated Name"}
        response = client.put(
            "/api/ingredients/507f1f77bcf86cd799439011",
            json=update_data,
            headers=headers,
        )
        assert response.status_code == 404

    def test_delete_ingredient(self, client, authenticated_user, sample_ingredients):
        """Test deleting an ingredient"""
        user, headers = authenticated_user

        ingredient = sample_ingredients[-1]  # Irish Moss
        response = client.delete(f"/api/ingredients/{ingredient.id}", headers=headers)

        assert response.status_code == 200
        assert "deleted successfully" in response.json["message"]

        # Verify ingredient is deleted
        deleted_ingredient = Ingredient.objects(id=ingredient.id).first()
        assert deleted_ingredient is None

        # Verify we can't get it anymore
        get_response = client.get(f"/api/ingredients/{ingredient.id}", headers=headers)
        assert get_response.status_code == 404

    def test_delete_ingredient_not_found(self, client, authenticated_user):
        """Test deleting non-existent ingredient"""
        user, headers = authenticated_user

        response = client.delete(
            "/api/ingredients/507f1f77bcf86cd799439011", headers=headers
        )
        assert response.status_code == 404

    def test_get_ingredient_recipes(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test getting recipes that use a specific ingredient"""
        user, headers = authenticated_user

        # Create a recipe that uses the first ingredient (Pale Malt)
        ingredient = sample_ingredients[0]

        recipe_data = {
            "name": "Test Recipe with Pale Malt",
            "batch_size": 5.0,
            "is_public": True,  # Make it public so it appears in ingredient recipes
            "ingredients": [
                {
                    "ingredient_id": str(ingredient.id),
                    "name": ingredient.name,
                    "type": ingredient.type,
                    "amount": 10.0,
                    "unit": "lb",
                }
            ],
        }

        # Create the recipe
        recipe_response = client.post("/api/recipes", json=recipe_data, headers=headers)
        assert recipe_response.status_code == 201

        # Get recipes that use this ingredient
        response = client.get(
            f"/api/ingredients/{ingredient.id}/recipes", headers=headers
        )

        assert response.status_code == 200
        assert "recipes" in response.json
        assert "pagination" in response.json
        assert len(response.json["recipes"]) == 1
        assert response.json["recipes"][0]["name"] == "Test Recipe with Pale Malt"

    def test_get_ingredient_recipes_none_found(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test getting recipes for an ingredient not used in any recipes"""
        user, headers = authenticated_user

        # Use an ingredient that's not in any recipes
        ingredient = sample_ingredients[-1]  # Irish Moss

        response = client.get(
            f"/api/ingredients/{ingredient.id}/recipes", headers=headers
        )

        assert response.status_code == 200
        assert len(response.json["recipes"]) == 0
        assert response.json["pagination"]["total"] == 0

    def test_ingredient_unauthorized_access(self, client, sample_ingredients):
        """Test accessing ingredient endpoints without authentication"""

        # Test various endpoints without auth token
        response = client.get("/api/ingredients")
        assert response.status_code == 401

        response = client.get(f"/api/ingredients/{sample_ingredients[0].id}")
        assert response.status_code == 401

        response = client.post("/api/ingredients", json={"name": "Test"})
        assert response.status_code == 401

        response = client.put(
            f"/api/ingredients/{sample_ingredients[0].id}", json={"name": "Test"}
        )
        assert response.status_code == 401

        response = client.delete(f"/api/ingredients/{sample_ingredients[0].id}")
        assert response.status_code == 401

    def test_ingredient_data_integrity(
        self, client, authenticated_user, sample_ingredients
    ):
        """Test that ingredient data maintains proper types and structure"""
        user, headers = authenticated_user

        # Get a grain ingredient
        response = client.get(
            f"/api/ingredients/{sample_ingredients[0].id}", headers=headers
        )
        grain = response.json

        assert grain["type"] == "grain"
        assert isinstance(grain["potential"], (int, float))
        assert isinstance(grain["color"], (int, float))
        assert grain["grain_type"] == "base_malt"
        assert grain["alpha_acid"] is None  # Should be None for grains
        assert grain["attenuation"] is None  # Should be None for grains

        # Get a hop ingredient
        response = client.get(
            f"/api/ingredients/{sample_ingredients[3].id}", headers=headers
        )
        hop = response.json

        assert hop["type"] == "hop"
        assert isinstance(hop["alpha_acid"], (int, float))
        assert hop["potential"] is None  # Should be None for hops
        assert hop["grain_type"] is None  # Should be None for hops

        # Get a yeast ingredient
        response = client.get(
            f"/api/ingredients/{sample_ingredients[5].id}", headers=headers
        )
        yeast = response.json

        assert yeast["type"] == "yeast"
        assert isinstance(yeast["attenuation"], (int, float))
        assert yeast["manufacturer"] == "Fermentis"
        assert yeast["code"] == "US-05"
        assert yeast["potential"] is None  # Should be None for yeast
        assert yeast["alpha_acid"] is None  # Should be None for yeast

    def test_combined_filters(self, client, authenticated_user, sample_ingredients):
        """Test using both type and search filters together"""

        user, headers = authenticated_user

        # Search for "malt" within grains only
        response = client.get(
            "/api/ingredients?type=grain&search=malt", headers=headers
        )
        assert response.status_code == 200

        # Should find grain ingredients with "malt" in the name
        for ingredient in response.json["ingredients"]:
            assert ingredient["type"] == "grain"
            assert "malt" in ingredient["name"].lower()

        # Search for "05" within yeast only
        response = client.get("/api/ingredients?type=yeast&search=05", headers=headers)
        assert response.status_code == 200
        assert len(response.json["ingredients"]) == 1
        assert response.json["ingredients"][0]["name"] == "US-05"
        assert response.json["ingredients"][0]["type"] == "yeast"
