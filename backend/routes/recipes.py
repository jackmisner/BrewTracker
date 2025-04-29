from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.recipe import Recipe

recipes_bp = Blueprint("recipes", __name__)


@recipes_bp.route("", methods=["GET"])
@jwt_required()
def get_recipes():
    current_user_id = get_jwt_identity()

    # Get all recipes for the current user
    recipes = Recipe.query.filter_by(user_id=current_user_id).all()

    return jsonify({"recipes": [recipe.to_dict() for recipe in recipes]}), 200


@recipes_bp.route("/<int:recipe_id>", methods=["GET"])
@jwt_required()
def get_recipe(recipe_id):
    current_user_id = get_jwt_identity()

    # Get specific recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe or recipe is public
    if recipe.user_id != current_user_id and not recipe.is_public:
        return jsonify({"error": "Unauthorized access"}), 403

    return jsonify({"recipe": recipe.to_dict()}), 200


@recipes_bp.route("", methods=["POST"])
@jwt_required()
def create_recipe():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    if "name" not in data or "batch_size" not in data:
        return jsonify({"error": "Recipe name and batch size are required"}), 400

    # Create new recipe
    new_recipe = Recipe(
        user_id=current_user_id,
        name=data["name"],
        style=data.get("style"),
        batch_size=data["batch_size"],
        description=data.get("description"),
        is_public=data.get("is_public", False),
        estimated_og=data.get("estimated_og"),
        estimated_fg=data.get("estimated_fg"),
        estimated_abv=data.get("estimated_abv"),
        estimated_ibu=data.get("estimated_ibu"),
        estimated_srm=data.get("estimated_srm"),
        boil_time=data.get("boil_time"),
        efficiency=data.get("efficiency"),
        notes=data.get("notes"),
        parent_recipe_id=data.get("parent_recipe_id"),
    )

    db.session.add(new_recipe)
    db.session.commit()

    return (
        jsonify(
            {"message": "Recipe created successfully", "recipe": new_recipe.to_dict()}
        ),
        201,
    )


@recipes_bp.route("/<int:recipe_id>", methods=["PUT"])
@jwt_required()
def update_recipe(recipe_id):
    current_user_id = get_jwt_identity()
    data = request.get_json()

    # Find recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe
    if recipe.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    # Update recipe fields
    for key, value in data.items():
        if hasattr(recipe, key):
            setattr(recipe, key, value)

    db.session.commit()

    return (
        jsonify({"message": "Recipe updated successfully", "recipe": recipe.to_dict()}),
        200,
    )


@recipes_bp.route("/<int:recipe_id>", methods=["DELETE"])
@jwt_required()
def delete_recipe(recipe_id):
    current_user_id = get_jwt_identity()

    # Find recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe
    if recipe.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    db.session.delete(recipe)
    db.session.commit()

    return jsonify({"message": "Recipe deleted successfully"}), 200
