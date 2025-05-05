from . import db


class RecipeIngredient(db.Model):
    __tablename__ = "recipe_ingredients"

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(
        db.Integer, db.ForeignKey("recipes.recipe_id"), nullable=False
    )
    ingredient_id = db.Column(
        db.Integer, db.ForeignKey("ingredients.ingredient_id"), nullable=False
    )
    amount = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # oz, lb, g, kg, etc.
    use = db.Column(db.String(50))  # mash, boil, dry hop, etc.
    time = db.Column(db.Integer)  # time in minutes (boil time, steep time, etc.)

    # Define relationships consistently with the parent models
    ingredient = db.relationship("Ingredient", back_populates="recipe_uses")
    recipe = db.relationship("Recipe", back_populates="recipe_ingredients")

    def to_dict(self):
        return {
            "id": self.id,
            "recipe_id": self.recipe_id,
            "ingredient_id": self.ingredient_id,
            "amount": self.amount,
            "unit": self.unit,
            "use": self.use,
            "time": self.time,
            "ingredient": self.ingredient.to_dict() if self.ingredient else None,
        }
