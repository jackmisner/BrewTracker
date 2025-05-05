from flask import Blueprint, request, jsonify
from models import db
from models.ingredient import Ingredient

ingredients_bp = Blueprint("ingredients", __name__)


@ingredients_bp.route("", methods=["GET"])
def get_ingredients():
    # Get all ingredients
    ingredients = Ingredient.query.all()
    return (
        jsonify({"ingredients": [ingredient.to_dict() for ingredient in ingredients]}),
        200,
    )


@ingredients_bp.route("/<int:ingredient_id>", methods=["GET"])
def get_ingredient(ingredient_id):
    # Get specific ingredient
    ingredient = Ingredient.query.filter_by(ingredient_id=ingredient_id).first()

    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    return jsonify({"ingredient": ingredient.to_dict()}), 200


@ingredients_bp.route("", methods=["POST"])
def create_ingredient():
    data = request.get_json()

    # Validate required fields
    if "name" not in data or "type" not in data:
        return jsonify({"error": "Ingredient name and type are required"}), 400

    # Create new ingredient
    new_ingredient = Ingredient(
        name=data["name"],
        type=data["type"],
        description=data.get("description"),
        potential=data.get("potential"),
        color=data.get("color"),
        alpha_acid=data.get("alpha_acid"),
        attenuation=data.get("attenuation"),
    )

    db.session.add(new_ingredient)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Ingredient created successfully",
                "ingredient": new_ingredient.to_dict(),
            }
        ),
        201,
    )


@ingredients_bp.route("/<int:ingredient_id>", methods=["PUT"])
def update_ingredient(ingredient_id):
    data = request.get_json()

    # Find ingredient
    ingredient = Ingredient.query.filter_by(ingredient_id=ingredient_id).first()

    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    # Update ingredient fields
    allowed_fields = [
        "name",
        "type",
        "description",
        "potential",
        "color",
        "alpha_acid",
        "attenuation",
    ]

    for field in allowed_fields:
        if field in data:
            setattr(ingredient, field, data[field])

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Ingredient updated successfully",
                "ingredient": ingredient.to_dict(),
            }
        ),
        200,
    )


@ingredients_bp.route("/<int:ingredient_id>", methods=["DELETE"])
def delete_ingredient(ingredient_id):
    # Find ingredient
    ingredient = Ingredient.query.filter_by(ingredient_id=ingredient_id).first()

    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    db.session.delete(ingredient)
    db.session.commit()

    return jsonify({"message": "Ingredient deleted successfully"}), 200
