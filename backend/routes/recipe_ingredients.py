from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from models.mongo_models import Recipe, Ingredient
from services.mongodb_service import MongoDBService

recipe_ingredients_bp = Blueprint("recipe_ingredients", __name__)


@recipe_ingredients_bp.route("/recipes/<recipe_id>/ingredients", methods=["GET"])
@jwt_required()
def get_recipe_ingredients(recipe_id):
    # Check if recipe exists
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check access permission
    user_id = get_jwt_identity()
    if str(recipe.user_id) != user_id and not recipe.is_public:
        return jsonify({"error": "Access denied"}), 403

    # Return ingredients
    ingredients = [ingredient.to_dict() for ingredient in recipe.ingredients]
    return jsonify(ingredients), 200


@recipe_ingredients_bp.route("/recipes/<recipe_id>/ingredients", methods=["POST"])
@jwt_required()
def add_recipe_ingredient(recipe_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check if recipe exists and belongs to user
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    if str(recipe.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Add ingredient to recipe
    success, message = MongoDBService.add_ingredient_to_recipe(recipe_id, data)

    if success:
        # Get updated recipe
        updated_recipe = Recipe.objects(id=recipe_id).first()
        return jsonify(updated_recipe.to_dict()), 201
    else:
        return jsonify({"error": message}), 400


@recipe_ingredients_bp.route(
    "/recipes/<recipe_id>/ingredients/<int:index>", methods=["DELETE"]
)
@jwt_required()
def remove_recipe_ingredient(recipe_id, index):
    user_id = get_jwt_identity()

    # Check if recipe exists and belongs to user
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    if str(recipe.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Remove ingredient from recipe
    success, message = MongoDBService.remove_ingredient_from_recipe(recipe_id, index)

    if success:
        # Get updated recipe
        updated_recipe = Recipe.objects(id=recipe_id).first()
        return jsonify(updated_recipe.to_dict()), 200
    else:
        return jsonify({"error": message}), 400
