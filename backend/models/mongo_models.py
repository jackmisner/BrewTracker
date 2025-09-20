import hashlib
import hmac
import os
from datetime import UTC, datetime
from typing import ClassVar

from mongoengine import (
    CASCADE,
    BooleanField,
    DateField,
    DateTimeField,
    Document,
    EmbeddedDocument,
    EmbeddedDocumentField,
    FloatField,
    IntField,
    ListField,
    ObjectIdField,
    ReferenceField,
    StringField,
    connect,
)
from mongoengine.errors import NotUniqueError
from mongoengine.queryset.visitor import Q
from werkzeug.security import check_password_hash, generate_password_hash

from utils.crypto import get_password_reset_secret


def initialize_db(mongo_uri):
    """Initialize database connection only if not already connected"""
    from mongoengine.connection import ConnectionFailure, get_connection

    try:
        # Check if connection already exists
        get_connection()
        print("Database connection already exists, using existing connection")
    except ConnectionFailure:
        # No connection exists, create new one
        print(f"Connecting to MongoDB: {mongo_uri}")
        # Import config to get MONGO_OPTIONS
        from flask import Flask

        import config

        # Create temporary app to get config
        app = Flask(__name__)
        env = os.getenv("FLASK_ENV", "development")
        if env == "production":
            app.config.from_object(config.ProductionConfig)
        elif env == "testing":
            app.config.from_object(config.TestConfig)
        else:
            app.config.from_object(config.Config)

        connect(host=mongo_uri, **app.config["MONGO_OPTIONS"])


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
    password_hash = StringField()  # Made optional for Google users
    created_at = DateTimeField(default=lambda: datetime.now(UTC))
    last_login = DateTimeField()

    # Google OAuth fields
    google_id = StringField(unique=True, sparse=True)  # sparse allows nulls
    auth_provider = StringField(choices=["local", "google"], default="local")
    google_profile_picture = StringField()  # Store Google profile image URL

    # Add settings as embedded document
    settings = EmbeddedDocumentField(UserSettings, default=UserSettings)

    # Account status
    is_active = BooleanField(default=True)
    email_verified = BooleanField(default=False)

    # Email verification fields
    email_verification_token = StringField()
    email_verification_expires = DateTimeField()
    email_verification_sent_at = DateTimeField()

    # Password reset fields
    password_reset_token = StringField()
    password_reset_expires = DateTimeField()
    password_reset_sent_at = DateTimeField()

    meta = {
        "collection": "users",
        "indexes": [
            "username",
            "email",
            "google_id",
            {
                "fields": ["password_reset_token"],
                "sparse": True,
                "unique": True,
                "name": "idx_users_pwd_reset_token",
            },
            {
                "fields": ["password_reset_expires"],
                "sparse": True,
                "name": "idx_users_pwd_reset_expires",
            },
        ],
        "index_background": True,  # Set background indexing at the meta level
    }

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False  # Google users don't have passwords
        return check_password_hash(self.password_hash, password)

    def _get_secret_key(self):
        """Get secret key for password reset HMAC operations"""
        return get_password_reset_secret()

    def set_password_reset_token(self, raw_token):
        """Store a secure hash of the password reset token"""
        if raw_token:
            # Use HMAC-SHA256 for token hashing
            token_hash = hmac.new(
                self._get_secret_key(), raw_token.encode("utf-8"), hashlib.sha256
            ).hexdigest()
            self.password_reset_token = token_hash
        else:
            self.password_reset_token = None

    def verify_password_reset_token(self, raw_token):
        """Verify the password reset token by comparing hashes"""
        if not self.password_reset_token or not raw_token:
            return False

        # Generate hash of provided token
        provided_hash = hmac.new(
            self._get_secret_key(), raw_token.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        # Use secure comparison to prevent timing attacks
        return hmac.compare_digest(self.password_reset_token, provided_hash)

    def set_google_info(self, google_id, profile_picture=None):
        """Set Google authentication information"""
        self.google_id = google_id
        self.auth_provider = "google"
        self.email_verified = True  # Google accounts are pre-verified
        if profile_picture:
            self.google_profile_picture = profile_picture

    @classmethod
    def find_by_google_id(cls, google_id):
        """Find user by Google ID"""
        return cls.objects(google_id=google_id).first()

    @classmethod
    def find_by_email(cls, email):
        """Find user by email (for account linking)"""
        return cls.objects(email=email).first()

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

    def get_default_batch_size(self):
        """Get user's default batch size"""
        if self.settings and hasattr(self.settings, "default_batch_size"):
            return self.settings.default_batch_size
        # Return appropriate default based on unit system
        unit_system = self.get_preferred_units()
        return 19.0 if unit_system == "metric" else 5.0

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
            "auth_provider": self.auth_provider,
            "google_profile_picture": self.google_profile_picture,
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
    attenuation = FloatField()  # Attenuation percentage (theoretical/manufacturer spec)
    manufacturer = StringField(max_length=100)  # Yeast manufacturer
    code = StringField(max_length=50)  # Yeast code/identifier
    alcohol_tolerance = FloatField()  # Alcohol tolerance as percentage
    min_temperature = FloatField()  # Minimum fermentation temperature
    max_temperature = FloatField()  # Maximum fermentation temperature
    yeast_type = StringField(
        max_length=50
    )  # Yeast type: lager, belgian_ale, english_ale, american_ale, wheat, wild

    # Real-world attenuation tracking
    actual_attenuation_data = ListField(
        FloatField()
    )  # List of actual attenuation percentages
    actual_attenuation_average = FloatField()  # Running average of actual attenuation
    actual_attenuation_count = IntField(default=0)  # Number of data points collected
    attenuation_confidence = FloatField(
        default=0.0
    )  # Confidence score (0-1) based on data volume
    last_attenuation_update = DateTimeField()  # When attenuation data was last updated

    meta = {
        "collection": "ingredients",
        "indexes": ["name", "type", "grain_type", "yeast_type"],
    }

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
            "yeast_type": self.yeast_type,
            "actual_attenuation_average": self.actual_attenuation_average,
            "actual_attenuation_count": self.actual_attenuation_count,
            "attenuation_confidence": self.attenuation_confidence,
            "last_attenuation_update": (
                self.last_attenuation_update.isoformat()
                if self.last_attenuation_update
                else None
            ),
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
        # Generate frontend-compatible ID for React key uniqueness
        ingredient_id_str = str(self.ingredient_id)

        # Check if ingredient_id is already a compound ID (contains underscores and context)
        if "_" in ingredient_id_str and len(ingredient_id_str.split("_")) >= 3:
            # Compound ID like "Cascade_boil_60_68515f66d6b61a5de3de081d" - use as-is for unique ID
            frontend_id = f"{self.type}-{ingredient_id_str}"
        else:
            # Simple ObjectId - create unique ID with usage context to prevent duplicates
            # Include use and time to ensure uniqueness for same ingredient used multiple times
            use_context = f"{self.use or 'none'}"
            time_context = f"{self.time or 0}"
            frontend_id = (
                f"{self.type}-{ingredient_id_str}-{use_context}-{time_context}"
            )

        return {
            "id": frontend_id,  # Add frontend-compatible ID for React keys
            "ingredient_id": ingredient_id_str,  # Keep original for backend operations
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

    # Enhanced version tracking fields
    original_author = StringField()  # Original author for cloned public recipes
    clone_count = IntField(default=0)  # Number of times this recipe has been cloned
    is_owner = BooleanField(
        default=True
    )  # Whether current user owns this recipe (context-dependent)

    # Estimated values
    estimated_og = FloatField()
    estimated_fg = FloatField()
    estimated_abv = FloatField()
    estimated_ibu = FloatField()
    estimated_srm = FloatField()

    boil_time = IntField()  # in minutes
    efficiency = FloatField()  # percentage
    notes = StringField()

    # Mash temperature fields - affects wort fermentability and FG calculations
    # Note: Defaults are set dynamically in MongoDBService based on user preference
    mash_temperature = FloatField()  # Single infusion temperature (152°F/67°C baseline)
    mash_temp_unit = StringField(choices=["F", "C"])  # Temperature unit
    mash_time = IntField(default=60)  # Mash duration in minutes (for future use)

    # Embedded ingredients list - replaces the join table
    ingredients = ListField(EmbeddedDocumentField(RecipeIngredient))

    meta = {
        "collection": "recipes",
        "indexes": ["user_id", "name", "style", ("user_id", "is_public"), "created_at"],
    }

    def get_is_owner(self, viewer_user_id):
        """Compute whether the viewer is the owner of this recipe"""
        if not viewer_user_id or not self.user_id:
            return False
        uid = getattr(viewer_user_id, "id", viewer_user_id)
        if isinstance(uid, dict) and "user_id" in uid:
            uid = uid["user_id"]
        try:
            return str(self.user_id) == str(uid)
        except Exception:
            return False

    def to_dict_with_user_context(self, viewer_user_id=None):
        """Convert to dictionary with user context for is_owner field"""
        result = self.to_dict()
        # Override is_owner with computed value based on viewer context
        result["is_owner"] = self.get_is_owner(viewer_user_id)
        return result

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
                        "style": style.to_dict(),  # FIX: Convert to dict for JSON serialization
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
            "style_guide": declared_style.to_dict(),  # FIX: Convert to dict for JSON serialization
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
            "original_author": self.original_author,
            "clone_count": self.clone_count,
            "is_owner": self.is_owner,
            "estimated_og": self.estimated_og,
            "estimated_fg": self.estimated_fg,
            "estimated_abv": self.estimated_abv,
            "estimated_ibu": self.estimated_ibu,
            "estimated_srm": self.estimated_srm,
            "boil_time": self.boil_time,
            "efficiency": self.efficiency,
            "notes": self.notes,
            "mash_temperature": self.mash_temperature,
            "mash_temp_unit": self.mash_temp_unit,
            "mash_time": self.mash_time,
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


class DryHopAddition(EmbeddedDocument):
    """Embedded document for tracking dry hop additions during fermentation"""

    addition_date = DateTimeField(required=True, default=lambda: datetime.now(UTC))
    hop_name = StringField(required=True, max_length=100)
    hop_type = StringField(max_length=50)  # Pellet, Leaf, Extract, etc.
    amount = FloatField(required=True)  # Amount of hops added
    amount_unit = StringField(required=True, max_length=10)  # oz, g, etc.
    duration_days = IntField()  # Planned duration in days (optional)
    removal_date = DateTimeField()  # When hops were removed (optional)
    notes = StringField()  # Any additional notes
    phase = StringField(
        max_length=20, default="fermentation"
    )  # fermentation, secondary, etc.

    def to_dict(self):
        return {
            "addition_date": (
                self.addition_date.isoformat() if self.addition_date else None
            ),
            "hop_name": self.hop_name,
            "hop_type": self.hop_type,
            "amount": self.amount,
            "amount_unit": self.amount_unit,
            "duration_days": self.duration_days,
            "removal_date": (
                self.removal_date.isoformat() if self.removal_date else None
            ),
            "notes": self.notes,
            "phase": self.phase,
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

    # Dry hop additions tracking
    dry_hop_additions = ListField(EmbeddedDocumentField(DryHopAddition))

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
            "dry_hop_additions": [
                addition.to_dict() for addition in self.dry_hop_additions
            ],
            "notes": self.notes,
            "tasting_notes": self.tasting_notes,
            "batch_rating": self.batch_rating,
            "photos_url": self.photos_url,
            # Add temperature unit info
            "temperature_unit": self.temperature_unit,
        }

        return base_dict


class DataVersion(Document):
    """Model to track version information for static data collections"""

    # Data type identifier
    data_type = StringField(
        required=True, unique=True, max_length=50
    )  # 'ingredients' or 'beer_styles'

    # Version information
    version = StringField(required=True, max_length=100)  # Version hash or identifier
    last_modified = DateTimeField(required=True, default=lambda: datetime.now(UTC))

    # Metadata
    total_records = IntField(default=0)  # Number of records in the collection
    checksum = StringField(max_length=64)  # Optional checksum for data integrity

    # Performance optimization fields
    last_count_update = DateTimeField(default=lambda: datetime.now(UTC))
    count_cache_ttl = IntField(
        default=300, min_value=0
    )  # TTL for count cache in seconds (5 minutes)

    meta: "ClassVar[dict]" = {
        "collection": "data_versions",
        "indexes": ["data_type", "last_modified", "last_count_update"],
    }

    def to_dict(self):
        return {
            "data_type": self.data_type,
            "version": self.version,
            "last_modified": (
                self.last_modified.isoformat() if self.last_modified else None
            ),
            "total_records": self.total_records,
            "checksum": self.checksum,
        }

    @classmethod
    def get_or_create_version(cls, data_type):
        """Get existing version or create a new one"""
        version = cls.objects(data_type=data_type).first()
        if not version:
            # Create initial version
            import uuid

            version = cls(
                data_type=data_type,
                version=str(uuid.uuid4()),
                last_modified=datetime.now(UTC),
                total_records=0,
            )
            try:
                version.save()
            except NotUniqueError:
                # Another process created it: fetch the existing one
                version = cls.objects(data_type=data_type).first()
        return version

    def is_count_cache_valid(self):
        """Check if the cached count is still valid"""
        if not self.last_count_update:
            return False

        cache_age = (datetime.now(UTC) - self.last_count_update).total_seconds()
        return cache_age < self.count_cache_ttl

    def update_count_cache(self, model_class):
        """Update the cached record count"""
        try:
            current_count = model_class.objects().count()

            # Only update if count has changed or cache is expired
            if self.total_records != current_count or not self.is_count_cache_valid():
                self.total_records = current_count
                self.last_count_update = datetime.now(UTC)
                self.save()
                return True
            return False
        except Exception as e:
            # Log error but don't fail the request
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                "Failed to update count cache for %s: %s",
                self.data_type,
                e,
                exc_info=True,
            )
            return False

    @classmethod
    def get_or_create_version_optimized(cls, data_type, model_class=None):
        """Get version with optimized count handling"""
        version = cls.objects(data_type=data_type).first()
        if not version:
            # Create initial version
            import uuid

            initial_count = 0

            # Get initial count if model class is provided
            if model_class:
                try:
                    initial_count = model_class.objects().count()
                except Exception:
                    pass  # Use default 0 if count fails

            version = cls(
                data_type=data_type,
                version=str(uuid.uuid4()),
                last_modified=datetime.now(UTC),
                total_records=initial_count,
                last_count_update=datetime.now(UTC),
            )
            try:
                version.save()
            except NotUniqueError:
                # Another process created it: fetch the existing one
                version = cls.objects(data_type=data_type).first()
        elif model_class and not version.is_count_cache_valid():
            # Update count cache if expired
            version.update_count_cache(model_class)

        return version

    @classmethod
    def update_version(cls, data_type, total_records=None):
        """Update version when data changes"""
        import uuid

        version = cls.get_or_create_version(data_type)
        version.version = str(uuid.uuid4())
        version.last_modified = datetime.now(UTC)
        if total_records is not None:
            version.total_records = total_records
            version.last_count_update = datetime.now(UTC)
        version.save()
        return version
