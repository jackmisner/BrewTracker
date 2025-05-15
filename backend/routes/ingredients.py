from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models.mongo_models import Ingredient
from services.mongodb_service import MongoDBService

ingredients_bp = Blueprint("ingredients", __name__)


@ingredients_bp.route("", methods=["GET"])
@jwt_required()
def get_ingredients():
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

    return jsonify([ingredient.to_dict() for ingredient in ingredients]), 200


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
