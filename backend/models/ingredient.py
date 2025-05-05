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

    # Relationships
    recipes = db.relationship("Recipe", backref="ingredient", lazy=True)

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
        }
