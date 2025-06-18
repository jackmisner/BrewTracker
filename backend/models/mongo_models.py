from datetime import datetime, UTC
from mongoengine import Document, EmbeddedDocument, EmbeddedDocumentField, ListField
from mongoengine import (
    StringField,
    FloatField,
    IntField,
    BooleanField,
    DateTimeField,
    ReferenceField,
    ObjectIdField,
)
from mongoengine import DateField, connect, CASCADE
from werkzeug.security import generate_password_hash, check_password_hash


def initialize_db(mongo_uri):
    """Initialize database connection only if not already connected"""
    from mongoengine.connection import get_connection, ConnectionFailure

    try:
        # Check if connection already exists
        get_connection()
        print("Database connection already exists, using existing connection")
    except ConnectionFailure:
        # No connection exists, create new one
        print(f"Connecting to MongoDB: {mongo_uri}")
        connect(host=mongo_uri, uuidRepresentation="standard")


# User model
class UserSettings(EmbeddedDocument):
    # Privacy Settings
    contribute_anonymous_data = BooleanField(default=False)
    share_yeast_performance = BooleanField(default=False)
    share_recipe_metrics = BooleanField(default=False)
    public_recipes_default = BooleanField(default=False)

    # Application Preferences
    default_batch_size = FloatField(default=5.0)
    preferred_units = StringField(choices=["imperial", "metric"], default="imperial")
    timezone = StringField(default="UTC")

    # Notification Preferences
    email_notifications = BooleanField(default=True)
    brew_reminders = BooleanField(default=True)

    def get_default_batch_size_for_units(self):
        """Get appropriate default batch size for user's unit system"""
        if self.preferred_units == "metric":
            return 19.0  # 19L for metric users
        else:
            return 5.0  # 5 gallons for imperial users

    def to_dict(self):
        return {
            "contribute_anonymous_data": self.contribute_anonymous_data,
            "share_yeast_performance": self.share_yeast_performance,
            "share_recipe_metrics": self.share_recipe_metrics,
            "public_recipes_default": self.public_recipes_default,
            "default_batch_size": self.default_batch_size,
            "preferred_units": self.preferred_units,
            "timezone": self.timezone,
            "email_notifications": self.email_notifications,
            "brew_reminders": self.brew_reminders,
        }


class User(Document):
    username = StringField(required=True, unique=True, max_length=80)
    email = StringField(required=True, unique=True, max_length=120)
    password_hash = StringField(required=True)
    created_at = DateTimeField(default=lambda: datetime.now(UTC))
    last_login = DateTimeField()

    # Add settings as embedded document
    settings = EmbeddedDocumentField(UserSettings, default=UserSettings)

    # Account status
    is_active = BooleanField(default=True)
    email_verified = BooleanField(default=False)

    meta = {"collection": "users", "indexes": ["username", "email"]}

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def update_settings(self, settings_data):
        """Update user settings safely"""
        if not self.settings:
            self.settings = UserSettings()

        for key, value in settings_data.items():
            if hasattr(self.settings, key):
                setattr(self.settings, key, value)

        self.save()

    def get_preferred_units(self):
        """Get user's preferred unit system"""
        if self.settings and hasattr(self.settings, "preferred_units"):
            return self.settings.preferred_units
        return "imperial"  # Default

    def get_unit_preferences(self):
        """Get detailed unit preferences for the user"""
        from utils.unit_conversions import UnitConverter

        return UnitConverter.get_preferred_units(self.get_preferred_units())

    def convert_recipe_to_preferred_units(self, recipe_data):
        """Convert recipe data to user's preferred units"""
        from utils.unit_conversions import UnitConverter

        if not recipe_data:
            return recipe_data

        converted = recipe_data.copy()
        target_system = self.get_preferred_units()

        # Convert batch size
        if "batch_size" in converted:
            # Assume batch size is in gallons, convert if user prefers metric
            if target_system == "metric":
                converted["batch_size"] = UnitConverter.convert_volume(
                    converted["batch_size"], "gal", "l"
                )
                converted["batch_size_unit"] = "l"
            else:
                converted["batch_size_unit"] = "gal"

        # Convert ingredients
        if "ingredients" in converted and isinstance(converted["ingredients"], list):
            converted["ingredients"] = [
                UnitConverter.normalize_ingredient_data(ing, target_system)
                for ing in converted["ingredients"]
            ]

        return converted

    def to_dict(self):
        return {
            "user_id": str(self.id),
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "is_active": self.is_active,
            "email_verified": self.email_verified,
            "settings": (
                self.settings.to_dict() if self.settings else UserSettings().to_dict()
            ),
        }


class Ingredient(Document):
    name = StringField(required=True, max_length=100)
    type = StringField(required=True, max_length=50)  # grain, hop, yeast, other, etc.
    description = StringField()

    # Type-specific properties
    # For grains
    potential = FloatField()  # Potential gravity points per pound per gallon
    color = FloatField()  # Color in Lovibond
    # NEW FIELD: Add grain type categorisation
    grain_type = StringField(
        max_length=50
    )  # base_malt, roasted, caramel_crystal, smoked, adjunct_grain

    # For hops
    alpha_acid = FloatField()  # Alpha acid percentage

    # For yeast
    attenuation = FloatField()  # Attenuation percentage
    manufacturer = StringField(max_length=100)  # Yeast manufacturer
    code = StringField(max_length=50)  # Yeast code/identifier
    alcohol_tolerance = FloatField()  # Alcohol tolerance as percentage
    min_temperature = FloatField()  # Minimum fermentation temperature
    max_temperature = FloatField()  # Maximum fermentation temperature

    meta = {"collection": "ingredients", "indexes": ["name", "type", "grain_type"]}

    def to_dict(self):
        return {
            "ingredient_id": str(self.id),
            "name": self.name,
            "type": self.type,
            "description": self.description,
            "potential": self.potential,
            "color": self.color,
            "grain_type": self.grain_type,  # Add to serialization
            "alpha_acid": self.alpha_acid,
            "attenuation": self.attenuation,
            "manufacturer": self.manufacturer,
            "code": self.code,
            "alcohol_tolerance": self.alcohol_tolerance,
            "min_temperature": self.min_temperature,
            "max_temperature": self.max_temperature,
        }


# Recipe ingredient embedded document
class RecipeIngredient(EmbeddedDocument):
    ingredient_id = ObjectIdField(required=True)
    name = StringField(required=True)  # Denormalized from Ingredient
    type = StringField(required=True)  # Denormalized from Ingredient
    grain_type = StringField(max_length=50)  # Denormalized from Ingredient
    amount = FloatField(required=True)
    unit = StringField(required=True, max_length=20)  # oz, lb, g, kg, etc.
    use = StringField(max_length=50)  # mash, boil, dry hop, etc.
    time = IntField()  # time in minutes (boil time, steep time, etc.)

    # Additional fields denormalized from Ingredient for quick access
    potential = FloatField()
    color = FloatField()
    alpha_acid = FloatField()
    attenuation = FloatField()

    def to_dict(self):
        return {
            "ingredient_id": str(self.ingredient_id),
            "name": self.name,
            "type": self.type,
            "grain_type": self.grain_type,
            "amount": self.amount,
            "unit": self.unit,
            "use": self.use,
            "time": self.time,
            "potential": self.potential,
            "color": self.color,
            "alpha_acid": self.alpha_acid,
            "attenuation": self.attenuation,
        }


# Recipe model
class Recipe(Document):
    user_id = ObjectIdField(required=True)
    name = StringField(required=True, max_length=100)
    style = StringField(max_length=50)
    batch_size = FloatField(required=True)  # in gallons/liters
    batch_size_unit = StringField(default="gal", choices=["gal", "l"])  # NEW FIELD
    unit_system = StringField(
        choices=["imperial", "metric"], default="imperial"
    )  # NEW FIELD for unit system
    description = StringField()
    is_public = BooleanField(default=False)
    created_at = DateTimeField(default=lambda: datetime.now(UTC))
    updated_at = DateTimeField(default=lambda: datetime.now(UTC))
    version = IntField(default=1)
    parent_recipe_id = ObjectIdField()

    # Estimated values
    estimated_og = FloatField()
    estimated_fg = FloatField()
    estimated_abv = FloatField()
    estimated_ibu = FloatField()
    estimated_srm = FloatField()

    boil_time = IntField()  # in minutes
    efficiency = FloatField()  # percentage
    notes = StringField()

    # Embedded ingredients list - replaces the join table
    ingredients = ListField(EmbeddedDocumentField(RecipeIngredient))

    meta = {
        "collection": "recipes",
        "indexes": ["user_id", "name", "style", ("user_id", "is_public"), "created_at"],
    }

    def suggest_matching_styles(self):
        """Find beer styles that match this recipe's specifications"""
        if not all(
            [
                self.estimated_og,
                self.estimated_fg,
                self.estimated_abv,
                self.estimated_ibu,
                self.estimated_srm,
            ]
        ):
            return []

        recipe_specs = {
            "estimated_og": self.estimated_og,
            "estimated_fg": self.estimated_fg,
            "estimated_abv": self.estimated_abv,
            "estimated_ibu": self.estimated_ibu,
            "estimated_srm": self.estimated_srm,
        }

        matching_styles = []
        for style in BeerStyleGuide.objects():
            match_result = style.matches_recipe_specs(recipe_specs)
            if match_result["match_percentage"] >= 60:  # At least 60% match
                matching_styles.append(
                    {
                        "style": style,
                        "match_percentage": match_result["match_percentage"],
                        "matches": match_result["matches"],
                    }
                )

        # Sort by match percentage
        matching_styles.sort(key=lambda x: x["match_percentage"], reverse=True)
        return matching_styles[:5]  # Return top 5 matches

    def get_style_analysis(self):
        """Get detailed style analysis for this recipe"""
        if not self.style:
            return None

        # Try to find the declared style
        declared_style = BeerStyleGuide.objects(name__icontains=self.style).first()
        if not declared_style:
            # Try finding by partial match
            declared_style = BeerStyleGuide.objects(
                Q(name__icontains=self.style.split()[0])
                | Q(tags__icontains=self.style.lower())
            ).first()

        if not declared_style:
            return {"declared_style": self.style, "found": False}

        # Analyze recipe against declared style
        recipe_specs = {
            "estimated_og": self.estimated_og,
            "estimated_fg": self.estimated_fg,
            "estimated_abv": self.estimated_abv,
            "estimated_ibu": self.estimated_ibu,
            "estimated_srm": self.estimated_srm,
        }

        match_result = declared_style.matches_recipe_specs(recipe_specs)

        return {
            "declared_style": self.style,
            "found": True,
            "style_guide": declared_style,
            "match_result": match_result,
            "suggestions": declared_style.get_style_targets(),
        }

    def to_dict(self):
        return {
            "recipe_id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "style": self.style,
            "batch_size": self.batch_size,
            "batch_size_unit": self.batch_size_unit,
            "unit_system": self.unit_system,
            "description": self.description,
            "is_public": self.is_public,
            "created_at": (
                self.created_at.isoformat()
                if self.created_at and hasattr(self.created_at, "isoformat")
                else self.created_at if self.created_at else None
            ),
            "updated_at": (
                self.updated_at.isoformat()
                if self.updated_at and hasattr(self.updated_at, "isoformat")
                else self.updated_at if self.updated_at else None
            ),
            "version": self.version,
            "parent_recipe_id": (
                str(self.parent_recipe_id) if self.parent_recipe_id else None
            ),
            "estimated_og": self.estimated_og,
            "estimated_fg": self.estimated_fg,
            "estimated_abv": self.estimated_abv,
            "estimated_ibu": self.estimated_ibu,
            "estimated_srm": self.estimated_srm,
            "boil_time": self.boil_time,
            "efficiency": self.efficiency,
            "notes": self.notes,
            "ingredients": [ingredient.to_dict() for ingredient in self.ingredients],
        }


# Range value embedded document for style specifications
class StyleRange(EmbeddedDocument):
    """Embedded document for handling min/max ranges with units"""

    minimum = FloatField(required=True)
    maximum = FloatField(required=True)
    unit = StringField(required=True, max_length=10)  # sg, IBUs, %, SRM, etc.

    def to_dict(self):
        return {
            "minimum": {"unit": self.unit, "value": self.minimum},
            "maximum": {"unit": self.unit, "value": self.maximum},
        }

    def is_in_range(self, value):
        """Check if a value falls within this range"""
        return self.minimum <= value <= self.maximum

    def get_midpoint(self):
        """Get the midpoint of the range"""
        return (self.minimum + self.maximum) / 2


# Beer Style Guide model
class BeerStyleGuide(Document):
    """Model for storing beer style information following BeerJSON specification"""

    # Basic identification
    name = StringField(required=True, max_length=100, unique=True)
    category = StringField(required=True, max_length=100)
    category_id = StringField(required=True, max_length=10)
    style_id = StringField(required=True, max_length=10, unique=True)

    # Descriptions
    category_description = StringField()
    overall_impression = StringField()
    aroma = StringField()
    appearance = StringField()
    flavor = StringField()
    mouthfeel = StringField()
    comments = StringField()
    history = StringField()
    style_comparison = StringField()

    # Tags for categorization and search
    tags = ListField(StringField(max_length=50))

    # Style specifications with ranges
    original_gravity = EmbeddedDocumentField(StyleRange)
    international_bitterness_units = EmbeddedDocumentField(StyleRange)
    final_gravity = EmbeddedDocumentField(StyleRange)
    alcohol_by_volume = EmbeddedDocumentField(StyleRange)
    color = EmbeddedDocumentField(StyleRange)

    # Additional information
    ingredients = StringField()
    examples = StringField()  # Commercial examples

    # Metadata
    style_guide = StringField(default="BJCP2021", max_length=50)
    type = StringField(default="beer", max_length=20)
    version = FloatField(default=2.01)

    # Timestamps
    created_at = DateTimeField(default=lambda: datetime.now(UTC))
    updated_at = DateTimeField(default=lambda: datetime.now(UTC))

    meta = {
        "collection": "beer_style_guides",
        "indexes": [
            "style_id",
            "category_id",
            "name",
            "category",
            "tags",
            ("category_id", "style_id"),
        ],
    }

    def clean(self):
        """Validate the document before saving"""
        self.updated_at = datetime.now(UTC)

        # Ensure tags are lowercase for consistent searching
        if self.tags:
            self.tags = [tag.lower().strip() for tag in self.tags if tag.strip()]

    def matches_recipe_specs(self, recipe_data):
        """Check if a recipe's calculated specs match this style"""
        matches = {}
        total_specs = 0
        matching_specs = 0

        if recipe_data.get("estimated_og") and self.original_gravity:
            total_specs += 1
            matches["og"] = self.original_gravity.is_in_range(
                recipe_data["estimated_og"]
            )
            if matches["og"]:
                matching_specs += 1

        if recipe_data.get("estimated_fg") and self.final_gravity:
            total_specs += 1
            matches["fg"] = self.final_gravity.is_in_range(recipe_data["estimated_fg"])
            if matches["fg"]:
                matching_specs += 1

        if recipe_data.get("estimated_abv") and self.alcohol_by_volume:
            total_specs += 1
            matches["abv"] = self.alcohol_by_volume.is_in_range(
                recipe_data["estimated_abv"]
            )
            if matches["abv"]:
                matching_specs += 1

        if recipe_data.get("estimated_ibu") and self.international_bitterness_units:
            total_specs += 1
            matches["ibu"] = self.international_bitterness_units.is_in_range(
                recipe_data["estimated_ibu"]
            )
            if matches["ibu"]:
                matching_specs += 1

        if recipe_data.get("estimated_srm") and self.color:
            total_specs += 1
            matches["srm"] = self.color.is_in_range(recipe_data["estimated_srm"])
            if matches["srm"]:
                matching_specs += 1

        # Calculate match percentage
        match_percentage = (
            (matching_specs / total_specs * 100) if total_specs > 0 else 0
        )

        return {
            "matches": matches,
            "match_percentage": match_percentage,
            "matching_specs": matching_specs,
            "total_specs": total_specs,
        }

    def get_style_targets(self):
        """Get target values (midpoints) for recipe formulation"""
        targets = {}

        if self.original_gravity:
            targets["og"] = self.original_gravity.get_midpoint()

        if self.final_gravity:
            targets["fg"] = self.final_gravity.get_midpoint()

        if self.alcohol_by_volume:
            targets["abv"] = self.alcohol_by_volume.get_midpoint()

        if self.international_bitterness_units:
            targets["ibu"] = self.international_bitterness_units.get_midpoint()

        if self.color:
            targets["srm"] = self.color.get_midpoint()

        return targets

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        base_dict = {
            "style_guide_id": str(self.id),
            "name": self.name,
            "category": self.category,
            "category_id": self.category_id,
            "style_id": self.style_id,
            "category_description": self.category_description,
            "overall_impression": self.overall_impression,
            "aroma": self.aroma,
            "appearance": self.appearance,
            "flavor": self.flavor,
            "mouthfeel": self.mouthfeel,
            "comments": self.comments,
            "history": self.history,
            "style_comparison": self.style_comparison,
            "tags": self.tags,
            "ingredients": self.ingredients,
            "examples": self.examples,
            "style_guide": self.style_guide,
            "type": self.type,
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        # Add ranges if they exist
        if self.original_gravity:
            base_dict["original_gravity"] = self.original_gravity.to_dict()

        if self.international_bitterness_units:
            base_dict["international_bitterness_units"] = (
                self.international_bitterness_units.to_dict()
            )

        if self.final_gravity:
            base_dict["final_gravity"] = self.final_gravity.to_dict()

        if self.alcohol_by_volume:
            base_dict["alcohol_by_volume"] = self.alcohol_by_volume.to_dict()

        if self.color:
            base_dict["color"] = self.color.to_dict()

        return base_dict

    def __str__(self):
        return f"{self.style_id} - {self.name}"


# Fermentation entry embedded document
class FermentationEntry(EmbeddedDocument):
    """Embedded document for tracking fermentation data points"""

    entry_date = DateTimeField(required=True, default=lambda: datetime.now(UTC))
    temperature = FloatField()  # in degrees F/C
    gravity = FloatField()  # specific gravity (e.g., 1.010)
    ph = FloatField()  # pH value
    notes = StringField()  # Any additional notes for this reading

    def to_dict(self):
        return {
            "entry_date": self.entry_date.isoformat() if self.entry_date else None,
            "temperature": self.temperature,
            "gravity": self.gravity,
            "ph": self.ph,
            "notes": self.notes,
        }


# Brew session model
class BrewSession(Document):
    recipe_id = ObjectIdField(required=True)
    user_id = ObjectIdField(required=True)
    brew_date = DateField(default=lambda: datetime.now(UTC).date())
    name = StringField(max_length=100)
    status = StringField(required=True, default="planned", max_length=20)
    # status options: planned, in-progress, fermenting, conditioning, completed, archived

    # Brew day measurements
    mash_temp = FloatField()  # in degrees F/C
    actual_og = FloatField()
    actual_fg = FloatField()
    actual_abv = FloatField()
    actual_efficiency = FloatField()

    # Dates
    fermentation_start_date = DateField()
    fermentation_end_date = DateField()
    packaging_date = DateField()

    # Fermentation tracking - list of fermentation data entries
    fermentation_data = ListField(EmbeddedDocumentField(FermentationEntry))

    # Tasting and notes
    notes = StringField()
    tasting_notes = StringField()
    batch_rating = IntField()  # 1-5 scale
    photos_url = StringField(max_length=200)

    # Store a snapshot of the recipe to preserve history
    recipe_snapshot = StringField()  # Store as JSON string

    meta = {
        "collection": "brew_sessions",
        "indexes": ["user_id", "recipe_id", "brew_date", "status"],
    }

    # Store temperature unit preference
    temperature_unit = StringField(choices=["F", "C"], default="F")

    def convert_temperatures_to_unit(self, target_unit):
        """Convert all temperature fields to target unit"""
        from utils.unit_conversions import UnitConverter

        if self.temperature_unit == target_unit:
            return self  # No conversion needed

        # Convert mash temperature
        if self.mash_temp:
            self.mash_temp = UnitConverter.convert_temperature(
                self.mash_temp, self.temperature_unit, target_unit
            )

        # Convert fermentation data temperatures
        for entry in self.fermentation_data:
            if entry.temperature:
                entry.temperature = UnitConverter.convert_temperature(
                    entry.temperature, self.temperature_unit, target_unit
                )

        self.temperature_unit = target_unit
        return self

    def to_dict(self):
        base_dict = {
            "session_id": str(self.id),
            "recipe_id": str(self.recipe_id),
            "user_id": str(self.user_id),
            "brew_date": (
                self.brew_date.strftime("%Y-%m-%d") if self.brew_date else None
            ),
            "name": self.name,
            "status": self.status,
            "mash_temp": self.mash_temp,
            "actual_og": self.actual_og,
            "actual_fg": self.actual_fg,
            "actual_abv": self.actual_abv,
            "actual_efficiency": self.actual_efficiency,
            "fermentation_start_date": (
                self.fermentation_start_date.strftime("%Y-%m-%d")
                if self.fermentation_start_date
                else None
            ),
            "fermentation_end_date": (
                self.fermentation_end_date.strftime("%Y-%m-%d")
                if self.fermentation_end_date
                else None
            ),
            "packaging_date": (
                self.packaging_date.strftime("%Y-%m-%d")
                if self.packaging_date
                else None
            ),
            "fermentation_data": [entry.to_dict() for entry in self.fermentation_data],
            "notes": self.notes,
            "tasting_notes": self.tasting_notes,
            "batch_rating": self.batch_rating,
            "photos_url": self.photos_url,
            # Add temperature unit info
            "temperature_unit": self.temperature_unit,
        }

        return base_dict
