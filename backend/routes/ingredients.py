from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.mongo_models import Ingredient, User
from services.mongodb_service import MongoDBService

ingredients_bp = Blueprint("ingredients", __name__)


@ingredients_bp.route("", methods=["GET"])
@jwt_required()
def get_ingredients():
    user_id = get_jwt_identity()

    # Optional query parameters
    type_filter = request.args.get("type")
    search = request.args.get("search")

    # Build query
    query = {}
    if type_filter:
        query["type"] = type_filter
    if search:
        query["name__icontains"] = search

    ingredients = Ingredient.objects(**query)

    # Get user's unit preferences
    user = User.objects(id=user_id).first()
    unit_system = user.get_preferred_units() if user else "imperial"

    from utils.unit_conversions import UnitConverter

    unit_preferences = UnitConverter.get_preferred_units(unit_system)

    # Add default units to ingredient data
    ingredients_with_units = []
    for ingredient in ingredients:
        ing_dict = ingredient.to_dict()

        # Add suggested units based on ingredient type and user preferences
        if ingredient.type == "grain":
            ing_dict["suggested_unit"] = unit_preferences["weight_large"]
        elif ingredient.type == "hop":
            ing_dict["suggested_unit"] = unit_preferences["weight_small"]
        elif ingredient.type == "yeast":
            if unit_system == "metric":
                ing_dict["suggested_unit"] = "g"
            else:
                ing_dict["suggested_unit"] = "pkg"  # Packages are universal
        else:  # other/adjunct
            ing_dict["suggested_unit"] = unit_preferences["weight_small"]

        ingredients_with_units.append(ing_dict)

    return (
        jsonify(
            {
                "ingredients": ingredients_with_units,
                "unit_system": unit_system,
                "unit_preferences": unit_preferences,
            }
        ),
        200,
    )


@ingredients_bp.route("/<ingredient_id>", methods=["GET"])
@jwt_required()
def get_ingredient(ingredient_id):
    ingredient = Ingredient.objects(id=ingredient_id).first()

    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    return jsonify(ingredient.to_dict()), 200


@ingredients_bp.route("", methods=["POST"])
@jwt_required()
def create_ingredient():
    data = request.get_json()

    # Create ingredient
    ingredient = Ingredient(**data)
    ingredient.save()

    return jsonify(ingredient.to_dict()), 201


@ingredients_bp.route("/<ingredient_id>", methods=["PUT"])
@jwt_required()
def update_ingredient(ingredient_id):
    data = request.get_json()

    # Check if ingredient exists
    ingredient = Ingredient.objects(id=ingredient_id).first()
    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    # Update ingredient fields
    for key, value in data.items():
        if hasattr(ingredient, key):
            setattr(ingredient, key, value)

    ingredient.save()

    return jsonify(ingredient.to_dict()), 200


@ingredients_bp.route("/<ingredient_id>", methods=["DELETE"])
@jwt_required()
def delete_ingredient(ingredient_id):
    # Check if ingredient exists
    ingredient = Ingredient.objects(id=ingredient_id).first()
    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    # Delete ingredient
    ingredient.delete()

    return jsonify({"message": "Ingredient deleted successfully"}), 200


@ingredients_bp.route("/<ingredient_id>/recipes", methods=["GET"])
@jwt_required()
def get_ingredient_recipes(ingredient_id):
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))

    result = MongoDBService.get_ingredient_recipes(ingredient_id, page, per_page)

    recipes = [recipe.to_dict() for recipe in result["items"]]

    return (
        jsonify(
            {
                "recipes": recipes,
                "pagination": {
                    "page": result["page"],
                    "pages": result["pages"],
                    "per_page": result["per_page"],
                    "total": result["total"],
                    "has_next": result["has_next"],
                    "has_prev": result["has_prev"],
                    "next_num": result["next_num"],
                    "prev_num": result["prev_num"],
                },
            }
        ),
        200,
    )
