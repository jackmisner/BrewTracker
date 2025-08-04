from datetime import UTC, date, datetime

import pytest
from bson import ObjectId

from models.mongo_models import (
    BrewSession,
    FermentationEntry,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User,
    UserSettings,
)


class TestUserSettings:
    """Test UserSettings embedded document"""

    def test_user_settings_creation(self):
        """Test creating UserSettings with default values"""
        settings = UserSettings()

        assert settings.contribute_anonymous_data is False
        assert settings.share_yeast_performance is False
        assert settings.share_recipe_metrics is False
        assert settings.public_recipes_default is False
        assert settings.default_batch_size == 5.0
        assert settings.preferred_units == "imperial"
        assert settings.timezone == "UTC"
        assert settings.email_notifications is True
        assert settings.brew_reminders is True

    def test_user_settings_custom_values(self):
        """Test creating UserSettings with custom values"""
        settings = UserSettings(
            contribute_anonymous_data=True,
            share_yeast_performance=True,
            preferred_units="metric",
            default_batch_size=20.0,
            timezone="America/New_York",
            email_notifications=False,
        )

        assert settings.contribute_anonymous_data is True
        assert settings.share_yeast_performance is True
        assert settings.preferred_units == "metric"
        assert settings.default_batch_size == 20.0
        assert settings.timezone == "America/New_York"
        assert settings.email_notifications is False

    def test_get_default_batch_size_for_units(self):
        """Test getting appropriate batch size for unit system"""
        # Imperial units
        settings = UserSettings(preferred_units="imperial")
        assert settings.get_default_batch_size_for_units() == 5.0

        # Metric units
        settings = UserSettings(preferred_units="metric")
        assert settings.get_default_batch_size_for_units() == 19.0

    def test_user_settings_to_dict(self):
        """Test converting UserSettings to dictionary"""
        settings = UserSettings(
            contribute_anonymous_data=True,
            preferred_units="metric",
            default_batch_size=19.0,
        )

        settings_dict = settings.to_dict()

        assert isinstance(settings_dict, dict)
        assert settings_dict["contribute_anonymous_data"] is True
        assert settings_dict["preferred_units"] == "metric"
        assert settings_dict["default_batch_size"] == 19.0
        assert "share_yeast_performance" in settings_dict
        assert "email_notifications" in settings_dict


class TestUser:
    """Test User document"""

    def test_user_creation(self):
        """Test creating a user with required fields"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.password_hash is not None
        assert user.created_at is not None
        assert user.is_active is True
        assert user.email_verified is False

    def test_user_password_hashing(self):
        """Test password hashing and checking"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")

        # Password should be hashed
        assert user.password_hash != "TestPass123!"

        # Check password should work
        assert user.check_password("TestPass123!") is True
        assert user.check_password("WrongPass123!") is False

    def test_user_default_settings(self):
        """Test user gets default settings"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        # Settings should be created with defaults
        assert user.settings is not None
        assert isinstance(user.settings, UserSettings)
        assert user.settings.preferred_units == "imperial"

    def test_user_update_settings(self):
        """Test updating user settings"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        settings_data = {
            "preferred_units": "metric",
            "default_batch_size": 20.0,
            "email_notifications": False,
        }

        user.update_settings(settings_data)

        assert user.settings.preferred_units == "metric"
        assert user.settings.default_batch_size == 20.0
        assert user.settings.email_notifications is False

    def test_user_update_settings_no_existing(self):
        """Test updating settings when user has no existing settings"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.settings = None
        user.save()

        settings_data = {"preferred_units": "metric"}
        user.update_settings(settings_data)

        assert user.settings is not None
        assert user.settings.preferred_units == "metric"

    def test_user_get_preferred_units(self):
        """Test getting user's preferred units"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        # Default should be imperial
        assert user.get_preferred_units() == "imperial"

        # Update to metric
        user.settings.preferred_units = "metric"
        assert user.get_preferred_units() == "metric"

    def test_user_get_preferred_units_no_settings(self):
        """Test getting preferred units when user has no settings"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.settings = None

        # Should return default
        assert user.get_preferred_units() == "imperial"

    def test_user_get_unit_preferences(self):
        """Test getting detailed unit preferences"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        prefs = user.get_unit_preferences()

        assert isinstance(prefs, dict)
        assert "weight_large" in prefs
        assert "volume_large" in prefs
        assert "temperature" in prefs

    def test_user_convert_recipe_to_preferred_units(self):
        """Test converting recipe data to user's preferred units"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.settings = UserSettings(preferred_units="metric")
        user.save()

        recipe_data = {
            "batch_size": 5.0,  # gallons
            "ingredients": [{"name": "Pale Malt", "amount": 10.0, "unit": "lb"}],
        }

        converted = user.convert_recipe_to_preferred_units(recipe_data)

        # Batch size should be converted to liters
        assert converted["batch_size"] != 5.0  # Should be converted
        assert converted["batch_size_unit"] == "l"

        # Ingredients should be converted
        assert len(converted["ingredients"]) == 1

    def test_user_convert_recipe_none_input(self):
        """Test converting None recipe data"""
        user = User(username="testuser", email="test@example.com")

        result = user.convert_recipe_to_preferred_units(None)
        assert result is None

    def test_user_to_dict(self):
        """Test converting user to dictionary"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        user_dict = user.to_dict()

        assert isinstance(user_dict, dict)
        assert user_dict["username"] == "testuser"
        assert user_dict["email"] == "test@example.com"
        assert "user_id" in user_dict
        assert "password_hash" not in user_dict  # Should not expose password
        assert "created_at" in user_dict
        assert "settings" in user_dict
        assert user_dict["is_active"] is True

    def test_user_to_dict_dates(self):
        """Test user to_dict with various date formats"""
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.created_at = datetime.now(UTC)
        user.last_login = datetime.now(UTC)
        user.save()

        user_dict = user.to_dict()

        # Dates should be converted to ISO format
        assert isinstance(user_dict["created_at"], str)
        assert isinstance(user_dict["last_login"], str)


class TestIngredient:
    """Test Ingredient document"""

    def test_ingredient_creation_grain(self):
        """Test creating a grain ingredient"""
        ingredient = Ingredient(
            name="Pale Malt (2-row)",
            type="grain",
            grain_type="base_malt",
            potential=36,
            color=2.0,
            description="Base malt for most beers",
        )
        ingredient.save()

        assert ingredient.name == "Pale Malt (2-row)"
        assert ingredient.type == "grain"
        assert ingredient.grain_type == "base_malt"
        assert ingredient.potential == 36
        assert ingredient.color == 2.0
        assert ingredient.alpha_acid is None  # Should be None for grains

    def test_ingredient_creation_hop(self):
        """Test creating a hop ingredient"""
        ingredient = Ingredient(
            name="Cascade",
            type="hop",
            alpha_acid=5.5,
            description="Classic American hop",
        )
        ingredient.save()

        assert ingredient.name == "Cascade"
        assert ingredient.type == "hop"
        assert ingredient.alpha_acid == 5.5
        assert ingredient.potential is None  # Should be None for hops
        assert ingredient.grain_type is None

    def test_ingredient_creation_yeast(self):
        """Test creating a yeast ingredient"""
        ingredient = Ingredient(
            name="US-05",
            type="yeast",
            attenuation=81.0,
            manufacturer="Fermentis",
            code="US-05",
            alcohol_tolerance=12.0,
            min_temperature=60.0,
            max_temperature=72.0,
            description="American ale yeast",
        )
        ingredient.save()

        assert ingredient.name == "US-05"
        assert ingredient.type == "yeast"
        assert ingredient.attenuation == 81.0
        assert ingredient.manufacturer == "Fermentis"
        assert ingredient.code == "US-05"
        assert ingredient.alcohol_tolerance == 12.0
        assert ingredient.min_temperature == 60.0
        assert ingredient.max_temperature == 72.0

    def test_ingredient_to_dict(self):
        """Test converting ingredient to dictionary"""
        ingredient = Ingredient(
            name="Crystal 60L",
            type="grain",
            grain_type="caramel_crystal",
            potential=34,
            color=60.0,
        )
        ingredient.save()

        ing_dict = ingredient.to_dict()

        assert isinstance(ing_dict, dict)
        assert ing_dict["name"] == "Crystal 60L"
        assert ing_dict["type"] == "grain"
        assert ing_dict["grain_type"] == "caramel_crystal"
        assert ing_dict["potential"] == 34
        assert ing_dict["color"] == 60.0
        assert "ingredient_id" in ing_dict


class TestRecipeIngredient:
    """Test RecipeIngredient embedded document"""

    def test_recipe_ingredient_creation(self):
        """Test creating a recipe ingredient"""
        ingredient_id = ObjectId()
        recipe_ingredient = RecipeIngredient(
            ingredient_id=ingredient_id,
            name="Pale Malt",
            type="grain",
            grain_type="base_malt",
            amount=10.0,
            unit="lb",
            use="mash",
            time=0,
            potential=36,
            color=2.0,
        )

        assert recipe_ingredient.ingredient_id == ingredient_id
        assert recipe_ingredient.name == "Pale Malt"
        assert recipe_ingredient.type == "grain"
        assert recipe_ingredient.amount == 10.0
        assert recipe_ingredient.unit == "lb"

    def test_recipe_ingredient_to_dict(self):
        """Test converting recipe ingredient to dictionary"""
        ingredient_id = ObjectId()
        recipe_ingredient = RecipeIngredient(
            ingredient_id=ingredient_id,
            name="Cascade",
            type="hop",
            amount=1.0,
            unit="oz",
            use="boil",
            time=60,
            alpha_acid=5.5,
        )

        ing_dict = recipe_ingredient.to_dict()

        assert isinstance(ing_dict, dict)
        assert ing_dict["ingredient_id"] == str(ingredient_id)
        assert ing_dict["name"] == "Cascade"
        assert ing_dict["type"] == "hop"
        assert ing_dict["amount"] == 1.0
        assert ing_dict["unit"] == "oz"
        assert ing_dict["use"] == "boil"
        assert ing_dict["time"] == 60
        assert ing_dict["alpha_acid"] == 5.5
        # Test new 'id' field for React key uniqueness
        expected_id = f"hop-{ingredient_id}-boil-60"
        assert ing_dict["id"] == expected_id

    def test_recipe_ingredient_compound_id_to_dict(self):
        """Test converting recipe ingredient with compound ID to dictionary"""
        compound_id = "Cascade_boil_60_68515f66d6b61a5de3de081d"
        recipe_ingredient = RecipeIngredient(
            ingredient_id=compound_id,
            name="Cascade",
            type="hop",
            amount=1.0,
            unit="oz",
            use="boil",
            time=60,
            alpha_acid=5.5,
        )

        ing_dict = recipe_ingredient.to_dict()

        assert isinstance(ing_dict, dict)
        assert ing_dict["ingredient_id"] == compound_id
        assert ing_dict["name"] == "Cascade"
        assert ing_dict["type"] == "hop"
        # Test that compound ID is preserved in frontend ID
        expected_id = f"hop-{compound_id}"
        assert ing_dict["id"] == expected_id


class TestRecipe:
    """Test Recipe document"""

    def test_recipe_creation(self):
        """Test creating a recipe"""
        user_id = ObjectId()
        recipe = Recipe(
            user_id=user_id,
            name="American IPA",
            style="American IPA",
            batch_size=5.0,
            batch_size_unit="gal",
            unit_system="imperial",
            description="Hoppy American IPA",
            boil_time=60,
            efficiency=75,
            estimated_og=1.060,
            estimated_fg=1.012,
        )
        recipe.save()

        assert recipe.user_id == user_id
        assert recipe.name == "American IPA"
        assert recipe.style == "American IPA"
        assert recipe.batch_size == 5.0
        assert recipe.batch_size_unit == "gal"
        assert recipe.unit_system == "imperial"
        assert recipe.boil_time == 60
        assert recipe.efficiency == 75
        assert recipe.version == 1  # Default version
        assert recipe.is_public is False  # Default

    def test_recipe_with_ingredients(self):
        """Test creating a recipe with ingredients"""
        user_id = ObjectId()
        ingredient_id = ObjectId()

        recipe = Recipe(user_id=user_id, name="Test Recipe", batch_size=5.0)

        # Add ingredient
        recipe_ingredient = RecipeIngredient(
            ingredient_id=ingredient_id,
            name="Pale Malt",
            type="grain",
            amount=10.0,
            unit="lb",
        )
        recipe.ingredients.append(recipe_ingredient)
        recipe.save()

        assert len(recipe.ingredients) == 1
        assert recipe.ingredients[0].name == "Pale Malt"

    def test_recipe_to_dict(self):
        """Test converting recipe to dictionary"""
        user_id = ObjectId()
        recipe = Recipe(
            user_id=user_id,
            name="Test Recipe",
            batch_size=5.0,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        recipe.save()

        recipe_dict = recipe.to_dict()

        assert isinstance(recipe_dict, dict)
        assert recipe_dict["name"] == "Test Recipe"
        assert recipe_dict["batch_size"] == 5.0
        assert recipe_dict["user_id"] == str(user_id)
        assert "recipe_id" in recipe_dict
        assert "created_at" in recipe_dict
        assert "updated_at" in recipe_dict
        assert "ingredients" in recipe_dict

    def test_recipe_parent_child_relationships(self):
        """Test recipe versioning relationships"""
        user_id = ObjectId()

        # Create parent recipe
        parent_recipe = Recipe(
            user_id=user_id, name="Original Recipe", batch_size=5.0, version=1
        )
        parent_recipe.save()

        # Create child recipe
        child_recipe = Recipe(
            user_id=user_id,
            name="Original Recipe (v2)",
            batch_size=5.0,
            version=2,
            parent_recipe_id=parent_recipe.id,
        )
        child_recipe.save()

        child_dict = child_recipe.to_dict()
        assert child_dict["version"] == 2
        assert child_dict["parent_recipe_id"] == str(parent_recipe.id)


class TestFermentationEntry:
    """Test FermentationEntry embedded document"""

    def test_fermentation_entry_creation(self):
        """Test creating a fermentation entry"""
        entry = FermentationEntry(
            entry_date=datetime.now(UTC),
            temperature=68.0,
            gravity=1.020,
            ph=4.2,
            notes="Active fermentation",
        )

        assert entry.temperature == 68.0
        assert entry.gravity == 1.020
        assert entry.ph == 4.2
        assert entry.notes == "Active fermentation"
        assert entry.entry_date is not None

    def test_fermentation_entry_default_date(self):
        """Test fermentation entry with default date"""
        entry = FermentationEntry(temperature=68.0, gravity=1.020)

        assert entry.entry_date is not None
        assert isinstance(entry.entry_date, datetime)

    def test_fermentation_entry_to_dict(self):
        """Test converting fermentation entry to dictionary"""
        entry_date = datetime.now(UTC)
        entry = FermentationEntry(
            entry_date=entry_date,
            temperature=68.0,
            gravity=1.020,
            ph=4.2,
            notes="Test entry",
        )

        entry_dict = entry.to_dict()

        assert isinstance(entry_dict, dict)
        assert entry_dict["temperature"] == 68.0
        assert entry_dict["gravity"] == 1.020
        assert entry_dict["ph"] == 4.2
        assert entry_dict["notes"] == "Test entry"
        assert isinstance(entry_dict["entry_date"], str)  # Should be ISO format


class TestBrewSession:
    """Test BrewSession document"""

    def test_brew_session_creation(self):
        """Test creating a brew session"""
        recipe_id = ObjectId()
        user_id = ObjectId()

        session = BrewSession(
            recipe_id=recipe_id,
            user_id=user_id,
            name="First Brew",
            status="planned",
            brew_date=date.today(),
        )
        session.save()

        assert session.recipe_id == recipe_id
        assert session.user_id == user_id
        assert session.name == "First Brew"
        assert session.status == "planned"
        assert session.temperature_unit == "F"  # Default

    def test_brew_session_with_measurements(self):
        """Test brew session with actual measurements"""
        recipe_id = ObjectId()
        user_id = ObjectId()

        session = BrewSession(
            recipe_id=recipe_id,
            user_id=user_id,
            name="Completed Brew",
            status="completed",
            mash_temp=152.0,
            actual_og=1.060,
            actual_fg=1.012,
            actual_abv=6.3,
            actual_efficiency=76.0,
        )
        session.save()

        assert session.mash_temp == 152.0
        assert session.actual_og == 1.060
        assert session.actual_fg == 1.012
        assert session.actual_abv == 6.3
        assert session.actual_efficiency == 76.0

    def test_brew_session_with_fermentation_data(self):
        """Test brew session with fermentation tracking"""
        recipe_id = ObjectId()
        user_id = ObjectId()

        session = BrewSession(
            recipe_id=recipe_id,
            user_id=user_id,
            name="Fermentation Test",
            status="fermenting",
        )

        # Add fermentation entries
        entry1 = FermentationEntry(temperature=68.0, gravity=1.040, notes="Day 3")
        entry2 = FermentationEntry(temperature=67.0, gravity=1.020, notes="Day 7")

        session.fermentation_data.append(entry1)
        session.fermentation_data.append(entry2)
        session.save()

        assert len(session.fermentation_data) == 2
        assert session.fermentation_data[0].gravity == 1.040
        assert session.fermentation_data[1].gravity == 1.020

    def test_brew_session_convert_temperatures(self):
        """Test converting temperatures in brew session"""
        recipe_id = ObjectId()
        user_id = ObjectId()

        session = BrewSession(
            recipe_id=recipe_id,
            user_id=user_id,
            name="Temperature Test",
            mash_temp=152.0,  # Fahrenheit
            temperature_unit="F",
        )

        # Add fermentation data with temperatures
        entry = FermentationEntry(temperature=68.0)  # Fahrenheit
        session.fermentation_data.append(entry)

        # Convert to Celsius
        session.convert_temperatures_to_unit("C")

        assert session.temperature_unit == "C"
        assert abs(session.mash_temp - 66.67) < 0.1  # ~66.67°C
        assert abs(session.fermentation_data[0].temperature - 20.0) < 0.1  # ~20°C

    def test_brew_session_convert_temperatures_same_unit(self):
        """Test converting temperatures when already in target unit"""
        recipe_id = ObjectId()
        user_id = ObjectId()

        session = BrewSession(
            recipe_id=recipe_id,
            user_id=user_id,
            name="Temperature Test",
            mash_temp=152.0,
            temperature_unit="F",
        )

        original_temp = session.mash_temp

        # Convert to same unit
        session.convert_temperatures_to_unit("F")

        assert session.temperature_unit == "F"
        assert session.mash_temp == original_temp  # Should be unchanged

    def test_brew_session_to_dict(self):
        """Test converting brew session to dictionary"""
        recipe_id = ObjectId()
        user_id = ObjectId()

        session = BrewSession(
            recipe_id=recipe_id,
            user_id=user_id,
            name="Test Session",
            status="completed",
            brew_date=date(2024, 1, 15),
            fermentation_start_date=date(2024, 1, 16),
            fermentation_end_date=date(2024, 1, 30),
            packaging_date=date(2024, 2, 1),
        )
        session.save()

        session_dict = session.to_dict()

        assert isinstance(session_dict, dict)
        assert session_dict["name"] == "Test Session"
        assert session_dict["status"] == "completed"
        assert session_dict["brew_date"] == "2024-01-15"
        assert session_dict["fermentation_start_date"] == "2024-01-16"
        assert session_dict["fermentation_end_date"] == "2024-01-30"
        assert session_dict["packaging_date"] == "2024-02-01"
        assert session_dict["recipe_id"] == str(recipe_id)
        assert session_dict["user_id"] == str(user_id)
        assert "session_id" in session_dict
        assert "temperature_unit" in session_dict


class TestModelRelationships:
    """Test relationships between models"""

    def test_user_recipe_relationship(self):
        """Test user to recipe relationship"""
        # Create user
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        # Create recipe for user
        recipe = Recipe(user_id=user.id, name="User's Recipe", batch_size=5.0)
        recipe.save()

        # Query recipes for user
        user_recipes = Recipe.objects(user_id=user.id)
        assert user_recipes.count() == 1
        assert user_recipes.first().name == "User's Recipe"

    def test_recipe_ingredient_relationship(self):
        """Test recipe to ingredient relationship"""
        # Create ingredient
        ingredient = Ingredient(name="Test Ingredient", type="grain", potential=36)
        ingredient.save()

        # Create recipe with ingredient
        user_id = ObjectId()
        recipe = Recipe(user_id=user_id, name="Recipe with Ingredient", batch_size=5.0)

        recipe_ingredient = RecipeIngredient(
            ingredient_id=ingredient.id,
            name=ingredient.name,
            type=ingredient.type,
            amount=10.0,
            unit="lb",
        )
        recipe.ingredients.append(recipe_ingredient)
        recipe.save()

        assert len(recipe.ingredients) == 1
        assert recipe.ingredients[0].ingredient_id == ingredient.id

    def test_recipe_brew_session_relationship(self):
        """Test recipe to brew session relationship"""
        # Create user and recipe
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        recipe = Recipe(user_id=user.id, name="Session Recipe", batch_size=5.0)
        recipe.save()

        # Create brew session for recipe
        session = BrewSession(
            recipe_id=recipe.id, user_id=user.id, name="Test Session", status="planned"
        )
        session.save()

        # Query sessions for recipe
        recipe_sessions = BrewSession.objects(recipe_id=recipe.id)
        assert recipe_sessions.count() == 1
        assert recipe_sessions.first().name == "Test Session"

    def test_complex_recipe_structure(self):
        """Test complex recipe with multiple ingredients and full data"""
        # Create user
        user = User(username="testuser", email="test@example.com")
        user.set_password("TestPass123!")
        user.save()

        # Create ingredients
        grain = Ingredient(name="Pale Malt", type="grain", potential=36)
        hop = Ingredient(name="Cascade", type="hop", alpha_acid=5.5)
        yeast = Ingredient(name="US-05", type="yeast", attenuation=75)
        grain.save()
        hop.save()
        yeast.save()

        # Create complex recipe
        recipe = Recipe(
            user_id=user.id,
            name="Complex IPA",
            style="American IPA",
            batch_size=5.0,
            description="A complex IPA recipe",
            boil_time=60,
            efficiency=75,
            estimated_og=1.060,
            estimated_fg=1.012,
            estimated_abv=6.3,
            estimated_ibu=45,
            estimated_srm=6,
        )

        # Add ingredients
        grain_ingredient = RecipeIngredient(
            ingredient_id=grain.id,
            name=grain.name,
            type=grain.type,
            amount=10.0,
            unit="lb",
            potential=grain.potential,
        )

        hop_ingredient = RecipeIngredient(
            ingredient_id=hop.id,
            name=hop.name,
            type=hop.type,
            amount=1.0,
            unit="oz",
            use="boil",
            time=60,
            alpha_acid=hop.alpha_acid,
        )

        yeast_ingredient = RecipeIngredient(
            ingredient_id=yeast.id,
            name=yeast.name,
            type=yeast.type,
            amount=1.0,
            unit="pkg",
            attenuation=yeast.attenuation,
        )

        recipe.ingredients.extend([grain_ingredient, hop_ingredient, yeast_ingredient])
        recipe.save()

        # Create brew session with fermentation data
        session = BrewSession(
            recipe_id=recipe.id,
            user_id=user.id,
            name="Complex Brew Session",
            status="fermenting",
            actual_og=1.058,
            mash_temp=152.0,
        )

        # Add fermentation entries
        entry1 = FermentationEntry(
            temperature=68.0, gravity=1.040, ph=4.5, notes="Day 3 - active fermentation"
        )
        entry2 = FermentationEntry(
            temperature=67.0, gravity=1.020, ph=4.2, notes="Day 7 - slowing down"
        )

        session.fermentation_data.extend([entry1, entry2])
        session.save()

        # Verify everything is connected
        assert recipe.name == "Complex IPA"
        assert len(recipe.ingredients) == 3
        assert session.recipe_id == recipe.id
        assert len(session.fermentation_data) == 2

        # Test serialization
        recipe_dict = recipe.to_dict()
        session_dict = session.to_dict()

        assert len(recipe_dict["ingredients"]) == 3
        assert len(session_dict["fermentation_data"]) == 2
