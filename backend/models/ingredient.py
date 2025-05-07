from . import db


class Ingredient(db.Model):
    __tablename__ = "ingredients"

    ingredient_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # grain, hop, yeast, adjunct, etc.
    description = db.Column(db.Text)

    # Type-specific properties (as JSON or specific columns)

    # For grains
    potential = db.Column(db.Float)  # Potential gravity points per pound per gallon
    color = db.Column(db.Float)  # Color in Lovibond

    # For hops
    alpha_acid = db.Column(db.Float)  # Alpha acid percentage

    # For yeast
    attenuation = db.Column(db.Float)  # Attenuation percentage
    manufacturer = db.Column(db.String(100), nullable=True)  # Yeast manufacturer
    code = db.Column(db.String(50), nullable=True)  # Yeast code/identifier
    alcohol_tolerance = db.Column(
        db.Float, nullable=True
    )  # Alcohol tolerance as percentage
    min_temperature = db.Column(
        db.Float, nullable=True
    )  # Minimum fermentation temperature
    max_temperature = db.Column(
        db.Float, nullable=True
    )  # Maximum fermentation temperature

    # Relationships
    recipe_uses = db.relationship("RecipeIngredient", back_populates="ingredient")

    # Relationship to Recipe through the join table
    recipes = db.relationship(
        "Recipe",
        secondary="recipe_ingredients",
        primaryjoin="Ingredient.ingredient_id == RecipeIngredient.ingredient_id",
        secondaryjoin="RecipeIngredient.recipe_id == Recipe.recipe_id",
        back_populates="ingredients",
        viewonly=True,
    )

    def to_dict(self):
        return {
            "ingredient_id": self.ingredient_id,
            "name": self.name,
            "type": self.type,
            "description": self.description,
            "potential": self.potential,
            "color": self.color,
            "alpha_acid": self.alpha_acid,
            "attenuation": self.attenuation,
            "manufacturer": self.manufacturer,
            "code": self.code,
            "alcohol_tolerance": self.alcohol_tolerance,
            "min_temperature": self.min_temperature,
            "max_temperature": self.max_temperature,
        }
