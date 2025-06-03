import pytest
from datetime import datetime, date, UTC
from models.mongo_models import (
    User,
    Recipe,
    BrewSession,
    Ingredient,
    RecipeIngredient,
    FermentationEntry,
)
from services.mongodb_service import MongoDBService


class TestMongoDBServiceUserMethods:
    """Test MongoDB service user-related methods"""

    @pytest.fixture
    def sample_user(self):
        """Create a sample user for testing"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("password123")
        user.save()
        return user

    def test_get_user_by_id(self, sample_user):
        """Test retrieving a user by ID"""
        result = MongoDBService.get_user_by_id(sample_user.id)

        assert result is not None
        assert result.username == "testuser"
        assert result.email == "test@example.com"

    def test_get_user_by_id_not_found(self):
        """Test retrieving non-existent user by ID"""
        from bson import ObjectId

        fake_id = ObjectId()
        result = MongoDBService.get_user_by_id(fake_id)

        assert result is None

    def test_get_user_by_username(self, sample_user):
        """Test retrieving a user by username"""
        result = MongoDBService.get_user_by_username("testuser")

        assert result is not None
        assert result.username == "testuser"
        assert result.email == "test@example.com"

    def test_get_user_by_username_not_found(self):
        """Test retrieving non-existent user by username"""
        result = MongoDBService.get_user_by_username("nonexistent")

        assert result is None


class TestMongoDBServiceRecipeMethods:
    """Test MongoDB service recipe-related methods"""

    @pytest.fixture
    def sample_user(self):
        """Create a sample user"""
        user = User(username="recipeuser", email="recipe@example.com")
        user.set_password("password")
        user.save()
        return user

    @pytest.fixture
    def sample_ingredients(self):
        """Create sample ingredients"""
        ingredients = [
            Ingredient(name="Pale Malt", type="grain", potential=36, color=2.0),
            Ingredient(name="Cascade", type="hop", alpha_acid=5.5),
            Ingredient(name="US-05", type="yeast", attenuation=75.0),
        ]

        for ingredient in ingredients:
            ingredient.save()

        return ingredients

    @pytest.fixture
    def sample_recipe(self, sample_user, sample_ingredients):
        """Create a sample recipe with ingredients"""
        recipe_data = {
            "user_id": sample_user.id,
            "name": "Test IPA",
            "style": "American IPA",
            "batch_size": 5.0,
            "description": "A test IPA recipe",
            "ingredients": [
                {
                    "ingredient_id": sample_ingredients[0].id,
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 10.0,
                    "unit": "lb",
                    "potential": 36,
                    "color": 2.0,
                },
                {
                    "ingredient_id": sample_ingredients[1].id,
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "use": "boil",
                    "time": 60,
                    "alpha_acid": 5.5,
                },
                {
                    "ingredient_id": sample_ingredients[2].id,
                    "name": "US-05",
                    "type": "yeast",
                    "amount": 1.0,
                    "unit": "pkg",
                    "attenuation": 75.0,
                },
            ],
        }

        return MongoDBService.create_recipe(recipe_data)

    def test_create_recipe(self, sample_user, sample_ingredients):
        """Test creating a recipe"""
        recipe_data = {
            "user_id": sample_user.id,
            "name": "New Recipe",
            "style": "Pale Ale",
            "batch_size": 5.0,
            "description": "A new recipe",
            "estimated_og": 1.050,
            "estimated_fg": 1.012,
            "ingredients": [
                {
                    "ingredient_id": sample_ingredients[0].id,
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 8.0,
                    "unit": "lb",
                }
            ],
        }

        recipe = MongoDBService.create_recipe(recipe_data)

        assert recipe is not None
        assert recipe.name == "New Recipe"
        assert recipe.style == "Pale Ale"
        assert recipe.batch_size == 5.0
        assert len(recipe.ingredients) == 1
        assert recipe.ingredients[0].name == "Pale Malt"
        assert recipe.created_at is not None
        assert recipe.updated_at is not None

    def test_get_user_recipes(self, sample_user, sample_recipe):
        """Test getting user recipes with pagination"""
        # Create additional recipes
        for i in range(5):
            recipe_data = {
                "user_id": sample_user.id,
                "name": f"Recipe {i}",
                "batch_size": 5.0,
                "ingredients": [],
            }
            MongoDBService.create_recipe(recipe_data)

        # Test first page
        result = MongoDBService.get_user_recipes(sample_user.id, page=1, per_page=3)

        assert result["total"] == 6  # 5 new + 1 from fixture
        assert result["pages"] == 2
        assert len(result["items"]) == 3
        assert result["has_next"] is True
        assert result["has_prev"] is False

        # Test second page
        result = MongoDBService.get_user_recipes(sample_user.id, page=2, per_page=3)

        assert len(result["items"]) == 3
        assert result["has_next"] is False
        assert result["has_prev"] is True

    def test_update_recipe(self, sample_recipe, sample_ingredients):
        """Test updating a recipe"""
        update_data = {
            "name": "Updated Recipe Name",
            "description": "Updated description",
            "batch_size": 6.0,
            "ingredients": [
                {
                    "ingredient_id": sample_ingredients[0].id,
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 12.0,
                    "unit": "lb",
                }
            ],
        }

        updated_recipe, message = MongoDBService.update_recipe(
            sample_recipe.id, update_data
        )

        assert updated_recipe is not None
        assert updated_recipe.name == "Updated Recipe Name"
        assert updated_recipe.description == "Updated description"
        assert updated_recipe.batch_size == 6.0
        assert len(updated_recipe.ingredients) == 1
        assert updated_recipe.ingredients[0].amount == 12.0

    def test_update_recipe_not_found(self):
        """Test updating non-existent recipe"""
        from bson import ObjectId

        fake_id = ObjectId()

        updated_recipe, message = MongoDBService.update_recipe(
            fake_id, {"name": "Test"}
        )

        assert updated_recipe is None
        assert "not found" in message

    def test_clone_recipe(self, sample_recipe, sample_user):
        """Test cloning a recipe"""
        cloned_recipe, message = MongoDBService.clone_recipe(
            sample_recipe.id, str(sample_user.id)
        )

        assert cloned_recipe is not None
        assert cloned_recipe.name == "Test IPA (v2)"
        assert cloned_recipe.version == 2
        assert cloned_recipe.parent_recipe_id == sample_recipe.id
        assert str(cloned_recipe.user_id) == str(sample_user.id)
        assert len(cloned_recipe.ingredients) == len(sample_recipe.ingredients)

    def test_clone_recipe_multiple_versions(self, sample_recipe, sample_user):
        """Test cloning a recipe multiple times creates proper version numbers"""
        # Clone once
        clone1, _ = MongoDBService.clone_recipe(sample_recipe.id, str(sample_user.id))
        assert clone1.version == 2

        # Clone again (from original)
        clone2, _ = MongoDBService.clone_recipe(sample_recipe.id, str(sample_user.id))
        assert clone2.version == 3

        # Clone from the first clone
        clone3, _ = MongoDBService.clone_recipe(clone1.id, str(sample_user.id))
        assert clone3.version == 4
        assert clone3.parent_recipe_id == sample_recipe.id  # Should link to root

    def test_clone_recipe_not_found(self, sample_user):
        """Test cloning non-existent recipe"""
        from bson import ObjectId

        fake_id = ObjectId()

        cloned_recipe, message = MongoDBService.clone_recipe(
            fake_id, str(sample_user.id)
        )

        assert cloned_recipe is None
        assert "not found" in message

    def test_calculate_recipe_stats_no_sessions(self, sample_recipe):
        """Test calculating recipe stats with no brew sessions"""
        stats = MongoDBService.calculate_recipe_stats(sample_recipe.id)

        # Should return estimated values from recipe
        assert stats is not None
        assert stats["total_brews"] == 0

    def test_calculate_recipe_stats_with_sessions(self, sample_recipe, sample_user):
        """Test calculating recipe stats with completed brew sessions"""
        # Create completed brew sessions
        sessions_data = [
            {
                "recipe_id": sample_recipe.id,
                "user_id": sample_user.id,
                "status": "completed",
                "actual_og": 1.055,
                "actual_fg": 1.012,
                "actual_abv": 5.7,
                "actual_efficiency": 76.0,
            },
            {
                "recipe_id": sample_recipe.id,
                "user_id": sample_user.id,
                "status": "completed",
                "actual_og": 1.058,
                "actual_fg": 1.014,
                "actual_abv": 5.8,
                "actual_efficiency": 78.0,
            },
        ]

        for session_data in sessions_data:
            session = BrewSession(**session_data)
            session.save()

        stats = MongoDBService.calculate_recipe_stats(sample_recipe.id)

        assert stats is not None
        assert stats["total_brews"] == 2
        assert 1.055 <= stats["avg_og"] <= 1.058
        assert 1.012 <= stats["avg_fg"] <= 1.014
        assert 5.7 <= stats["avg_abv"] <= 5.8
        assert 76.0 <= stats["avg_efficiency"] <= 78.0


class TestMongoDBServiceBrewSessionMethods:
    """Test MongoDB service brew session methods"""

    @pytest.fixture
    def sample_user_and_recipe(self):
        """Create user and recipe for brew session testing"""
        user = User(username="brewer", email="brewer@example.com")
        user.set_password("password")
        user.save()

        recipe = Recipe(user_id=user.id, name="Session Test Recipe", batch_size=5.0)
        recipe.save()

        return user, recipe

    def test_create_brew_session(self, sample_user_and_recipe):
        """Test creating a brew session"""
        user, recipe = sample_user_and_recipe

        session_data = {
            "recipe_id": recipe.id,
            "user_id": user.id,
            "name": "Test Brew Session",
            "status": "planned",
        }

        session = MongoDBService.create_brew_session(session_data)

        assert session is not None
        assert session.name == "Test Brew Session"
        assert session.recipe_id == recipe.id
        assert session.user_id == user.id
        assert session.status == "planned"  # Default status override

    def test_get_user_brew_sessions(self, sample_user_and_recipe):
        """Test getting user brew sessions with pagination"""
        user, recipe = sample_user_and_recipe

        # Create multiple sessions
        for i in range(5):
            session_data = {
                "recipe_id": recipe.id,
                "user_id": user.id,
                "name": f"Session {i}",
                "status": "planned",
            }
            MongoDBService.create_brew_session(session_data)

        result = MongoDBService.get_user_brew_sessions(user.id, page=1, per_page=3)

        assert result["total"] == 5
        assert len(result["items"]) == 3
        assert result["pages"] == 2
        assert result["has_next"] is True

    def test_update_brew_session(self, sample_user_and_recipe):
        """Test updating a brew session"""
        user, recipe = sample_user_and_recipe

        session_data = {
            "recipe_id": recipe.id,
            "user_id": user.id,
            "name": "Original Session",
        }
        session = MongoDBService.create_brew_session(session_data)

        update_data = {
            "name": "Updated Session",
            "status": "fermenting",
            "actual_og": 1.055,
            "mash_temp": 152.0,
        }

        updated_session = MongoDBService.update_brew_session(session.id, update_data)

        assert updated_session[0] is not None
        updated_session = updated_session[0]
        assert updated_session.name == "Updated Session"
        assert updated_session.status == "fermenting"
        assert updated_session.actual_og == 1.055
        assert updated_session.mash_temp == 152.0


class TestMongoDBServiceFermentationMethods:
    """Test MongoDB service fermentation tracking methods"""

    @pytest.fixture
    def brew_session_for_fermentation(self):
        """Create a brew session for fermentation testing"""
        user = User(username="fermenter", email="fermenter@example.com")
        user.set_password("password")
        user.save()

        recipe = Recipe(user_id=user.id, name="Fermentation Recipe", batch_size=5.0)
        recipe.save()

        session = BrewSession(
            recipe_id=recipe.id,
            user_id=user.id,
            name="Fermentation Test Session",
            status="fermenting",
        )
        session.save()

        return session

    def test_add_fermentation_entry(self, brew_session_for_fermentation):
        """Test adding a fermentation entry"""
        session = brew_session_for_fermentation

        entry_data = {
            "gravity": 1.045,
            "temperature": 68.5,
            "ph": 4.2,
            "notes": "Active fermentation",
        }

        success, message = MongoDBService.add_fermentation_entry(session.id, entry_data)

        assert success is True
        assert "successfully" in message

        # Verify entry was added
        data, _ = MongoDBService.get_fermentation_data(session.id)
        assert len(data) == 1
        assert data[0]["gravity"] == 1.045
        assert data[0]["temperature"] == 68.5

    def test_get_fermentation_data(self, brew_session_for_fermentation):
        """Test retrieving fermentation data"""
        session = brew_session_for_fermentation

        # Add multiple entries
        entries = [
            {"gravity": 1.050, "temperature": 68.0, "notes": "Day 1"},
            {"gravity": 1.030, "temperature": 69.0, "notes": "Day 3"},
            {"gravity": 1.015, "temperature": 68.5, "notes": "Day 7"},
        ]

        for entry in entries:
            MongoDBService.add_fermentation_entry(session.id, entry)

        data, message = MongoDBService.get_fermentation_data(session.id)

        assert data is not None
        assert len(data) == 3
        assert data[0]["notes"] == "Day 1"
        assert data[2]["notes"] == "Day 7"

    def test_update_fermentation_entry(self, brew_session_for_fermentation):
        """Test updating a fermentation entry"""
        session = brew_session_for_fermentation

        # Add an entry
        entry_data = {"gravity": 1.040, "temperature": 68.0, "notes": "Original"}
        MongoDBService.add_fermentation_entry(session.id, entry_data)

        # Update the entry
        update_data = {"gravity": 1.038, "notes": "Updated reading"}
        success, message = MongoDBService.update_fermentation_entry(
            session.id, 0, update_data
        )

        assert success is True

        # Verify update
        data, _ = MongoDBService.get_fermentation_data(session.id)
        assert data[0]["gravity"] == 1.038
        assert data[0]["notes"] == "Updated reading"

    def test_delete_fermentation_entry(self, brew_session_for_fermentation):
        """Test deleting a fermentation entry"""
        session = brew_session_for_fermentation

        # Add multiple entries
        entries = [
            {"gravity": 1.050, "notes": "Entry 1"},
            {"gravity": 1.040, "notes": "Entry 2"},
            {"gravity": 1.030, "notes": "Entry 3"},
        ]

        for entry in entries:
            MongoDBService.add_fermentation_entry(session.id, entry)

        # Delete middle entry
        success, message = MongoDBService.delete_fermentation_entry(session.id, 1)

        assert success is True

        # Verify deletion
        data, _ = MongoDBService.get_fermentation_data(session.id)
        assert len(data) == 2
        assert data[0]["notes"] == "Entry 1"
        assert data[1]["notes"] == "Entry 3"

    def test_get_fermentation_stats(self, brew_session_for_fermentation):
        """Test calculating fermentation statistics"""
        session = brew_session_for_fermentation

        # Add fermentation data with progression
        entries = [
            {"gravity": 1.050, "temperature": 68.0, "ph": 4.5},
            {"gravity": 1.040, "temperature": 69.0, "ph": 4.3},
            {"gravity": 1.025, "temperature": 68.5, "ph": 4.1},
            {"gravity": 1.015, "temperature": 67.0, "ph": 4.0},
        ]

        for entry in entries:
            MongoDBService.add_fermentation_entry(session.id, entry)

        stats, message = MongoDBService.get_fermentation_stats(session.id)

        assert stats is not None

        # Check gravity stats
        assert stats["gravity"]["initial"] == 1.050
        assert stats["gravity"]["current"] == 1.015
        assert round(stats["gravity"]["drop"], 3) == 0.035
        assert stats["gravity"]["attenuation"] > 0

        # Check temperature stats
        assert stats["temperature"]["min"] == 67.0
        assert stats["temperature"]["max"] == 69.0
        assert 67.0 <= stats["temperature"]["avg"] <= 69.0

        # Check pH stats
        assert stats["ph"]["min"] == 4.0
        assert stats["ph"]["max"] == 4.5


class TestMongoDBServiceSearchMethods:
    """Test MongoDB service search and filter methods"""

    @pytest.fixture
    def sample_data_for_search(self):
        """Create sample data for search testing"""
        # Create users
        user1 = User(username="searchuser1", email="search1@example.com")
        user1.set_password("password")
        user1.save()

        user2 = User(username="searchuser2", email="search2@example.com")
        user2.set_password("password")
        user2.save()

        # Create ingredients
        ingredient = Ingredient(name="Search Ingredient", type="grain")
        ingredient.save()

        # Create public recipes
        recipes = []
        for i in range(5):
            recipe = Recipe(
                user_id=user1.id,
                name=f"Search Recipe {i}",
                style="Test Style",
                batch_size=5.0,
                is_public=True,
            )
            recipe.save()
            recipes.append(recipe)

        # Create private recipe
        private_recipe = Recipe(
            user_id=user1.id,
            name="Private Recipe",
            style="Test Style",
            batch_size=5.0,
            is_public=False,
        )
        private_recipe.save()

        return user1, user2, ingredient, recipes

    def test_get_ingredient_recipes(self, sample_data_for_search):
        """Test finding recipes that use a specific ingredient"""
        user1, user2, ingredient, recipes = sample_data_for_search

        # Add ingredient to first recipe
        recipe = recipes[0]
        recipe_ingredient = RecipeIngredient(
            ingredient_id=ingredient.id,
            name=ingredient.name,
            type=ingredient.type,
            amount=5.0,
            unit="lb",
        )
        recipe.ingredients.append(recipe_ingredient)
        recipe.save()

        result = MongoDBService.get_ingredient_recipes(
            ingredient.id, page=1, per_page=10
        )

        assert result["total"] == 1
        assert len(result["items"]) == 1
        assert result["items"][0].name == "Search Recipe 0"

    def test_get_recent_activity(self, sample_data_for_search):
        """Test getting recent user activity"""
        user1, user2, ingredient, recipes = sample_data_for_search

        # Create some brew sessions
        for i in range(3):
            session = BrewSession(
                recipe_id=recipes[i].id,
                user_id=user1.id,
                name=f"Recent Session {i}",
                status="completed",
            )
            session.save()

        activity = MongoDBService.get_recent_activity(user1.id, limit=5)

        assert "recent_sessions" in activity
        assert "recent_recipes" in activity
        assert len(activity["recent_sessions"]) == 3
        assert len(activity["recent_recipes"]) >= 5  # Includes private recipe

    def test_get_attenuation_by_recipe(self, sample_data_for_search):
        """Test getting attenuation statistics by recipe"""
        user1, user2, ingredient, recipes = sample_data_for_search

        # Create completed brew sessions with actual gravity readings
        for i, recipe in enumerate(recipes[:2]):
            session = BrewSession(
                recipe_id=recipe.id,
                user_id=user1.id,
                name=f"Completed Session {i}",
                status="completed",
                actual_og=1.050 + (i * 0.005),
                actual_fg=1.012 + (i * 0.002),
            )
            session.save()

        results = MongoDBService.get_attenuation_by_recipe(user1.id)

        assert len(results) == 2
        for result in results:
            assert "name" in result
            assert "attenuation" in result
            assert result["attenuation"] > 0
