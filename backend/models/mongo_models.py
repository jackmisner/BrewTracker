from datetime import datetime
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
    connect(host=mongo_uri)


# User model
class User(Document):
    username = StringField(required=True, unique=True, max_length=80)
    email = StringField(required=True, unique=True, max_length=120)
    password_hash = StringField(required=True)
    created_at = DateTimeField(default=datetime.utcnow)
    last_login = DateTimeField()

    meta = {"collection": "users", "indexes": ["username", "email"]}

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "user_id": str(self.id),
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
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
    description = StringField()
    is_public = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)
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

    def to_dict(self):
        return {
            "recipe_id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "style": self.style,
            "batch_size": self.batch_size,
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


# Fermentation entry embedded document
class FermentationEntry(EmbeddedDocument):
    """Embedded document for tracking fermentation data points"""

    entry_date = DateTimeField(required=True, default=datetime.utcnow)
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
    brew_date = DateField(default=datetime.utcnow().date)
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

    def to_dict(self):
        return {
            "session_id": str(self.id),
            "recipe_id": str(self.recipe_id),
            "user_id": str(self.user_id),
            "brew_date": self.brew_date.isoformat() if self.brew_date else None,
            "name": self.name,
            "status": self.status,
            "mash_temp": self.mash_temp,
            "actual_og": self.actual_og,
            "actual_fg": self.actual_fg,
            "actual_abv": self.actual_abv,
            "actual_efficiency": self.actual_efficiency,
            "fermentation_start_date": (
                self.fermentation_start_date.isoformat()
                if self.fermentation_start_date
                else None
            ),
            "fermentation_end_date": (
                self.fermentation_end_date.isoformat()
                if self.fermentation_end_date
                else None
            ),
            "packaging_date": (
                self.packaging_date.isoformat() if self.packaging_date else None
            ),
            "fermentation_data": [entry.to_dict() for entry in self.fermentation_data],
            "notes": self.notes,
            "tasting_notes": self.tasting_notes,
            "batch_rating": self.batch_rating,
            "photos_url": self.photos_url,
        }
