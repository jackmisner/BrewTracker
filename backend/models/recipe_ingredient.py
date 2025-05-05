from . import db


class RecipeIngredient(db.Model):
    __tablename__ = "recipe_ingredients"

    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey("recipe.recipe_id"), nullable=False)
    ingredient_id = db.Column(
        db.Integer, db.ForeignKey("ingredient.ingredient_id"), nullable=False
    )
    amount = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # oz, lb, g, kg, etc.
    use = db.Column(db.String(50))  # mash, boil, dry hop, etc.
    time = db.Column(db.Integer)  # time in minutes (boil time, steep time, etc.)

    # Relationship to get the ingredient details
    ingredient = db.relationship("Ingredient", backref="recipe_uses")

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
