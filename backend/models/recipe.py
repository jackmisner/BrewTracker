from datetime import datetime
from . import db


class Recipe(db.Model):
    __tablename__ = "recipes"

    recipe_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    style = db.Column(db.String(50), nullable=True)
    batch_size = db.Column(db.Float, nullable=False)  # in gallons/liters
    description = db.Column(db.Text, nullable=True)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    version = db.Column(db.Integer, default=1)
    parent_recipe_id = db.Column(
        db.Integer, db.ForeignKey("recipes.recipe_id"), nullable=True
    )

    # Estimated values
    estimated_og = db.Column(db.Float, nullable=True)
    estimated_fg = db.Column(db.Float, nullable=True)
    estimated_abv = db.Column(db.Float, nullable=True)
    estimated_ibu = db.Column(db.Float, nullable=True)
    estimated_srm = db.Column(db.Float, nullable=True)

    boil_time = db.Column(db.Integer, nullable=True)  # in minutes
    efficiency = db.Column(db.Float, nullable=True)  # percentage
    notes = db.Column(db.Text, nullable=True)

    # Relationships
    brew_sessions = db.relationship("BrewSession", backref="recipe", lazy=True)
    recipe_ingredients = db.relationship("RecipeIngredient", back_populates="recipe",cascade="all, delete-orphan")

    # Relationship to Ingredient through the join table
    ingredients = db.relationship(
        "Ingredient",
        secondary="recipe_ingredients",
        primaryjoin="Recipe.recipe_id == RecipeIngredient.recipe_id",
        secondaryjoin="RecipeIngredient.ingredient_id == Ingredient.ingredient_id",
        back_populates="recipes",
        viewonly=True,
    )

    def to_dict(self):
        return {
            "recipe_id": self.recipe_id,
            "user_id": self.user_id,
            "name": self.name,
            "style": self.style,
            "batch_size": self.batch_size,
            "description": self.description,
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "version": self.version,
            "parent_recipe_id": self.parent_recipe_id,
            "estimated_og": self.estimated_og,
            "estimated_fg": self.estimated_fg,
            "estimated_abv": self.estimated_abv,
            "estimated_ibu": self.estimated_ibu,
            "estimated_srm": self.estimated_srm,
            "boil_time": self.boil_time,
            "efficiency": self.efficiency,
            "notes": self.notes,
        }
