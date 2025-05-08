from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.recipe import Recipe
from models.recipe_ingredient import RecipeIngredient
from models.ingredient import Ingredient
from utils.helpers import (
    calculate_og,
    calculate_fg,
    calculate_abv,
    calculate_ibu,
    calculate_srm,
)

recipe_ingredients_bp = Blueprint("recipe_ingredients", __name__)


@recipe_ingredients_bp.route("/recipes/<int:recipe_id>/ingredients", methods=["GET"])
@jwt_required()
def get_recipe_ingredients(recipe_id):
    current_user_id = get_jwt_identity()

    # Get the recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe or recipe is public
    if recipe.user_id != current_user_id and not recipe.is_public:
        return jsonify({"error": "Unauthorized access"}), 403

    # Get ingredients for the recipe
    ingredients = RecipeIngredient.query.filter_by(recipe_id=recipe_id).all()

    # Augment the recipe ingredients with the ingredient name
    ingredients_with_name = []
    for ri in ingredients:
        ingredient = Ingredient.query.get(ri.ingredient_id)
        ingredient_data = ri.to_dict()
        if ingredient:
            ingredient_data["ingredient_name"] = ingredient.name
        ingredients_with_name.append(ingredient_data)

    return jsonify({"ingredients": ingredients_with_name}), 200


@recipe_ingredients_bp.route("/recipes/<int:recipe_id>/ingredients", methods=["POST"])
@jwt_required()
def add_recipe_ingredient(recipe_id):
    current_user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    if "ingredient_id" not in data or "amount" not in data or "unit" not in data:
        return jsonify({"error": "ingredient_id, amount, and unit are required"}), 400

    # Get the recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe
    if recipe.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    # Check if ingredient exists
    ingredient = Ingredient.query.get(data["ingredient_id"])
    if not ingredient:
        return jsonify({"error": "Ingredient not found"}), 404

    # Create new recipe ingredient
    new_ingredient = RecipeIngredient(
        recipe_id=recipe_id,
        ingredient_id=data["ingredient_id"],
        amount=data["amount"],
        unit=data["unit"],
        use=data.get("use"),
        time=data.get("time"),
    )
    # print(new_ingredient)

    db.session.add(new_ingredient)
    db.session.commit()

    # Return the new ingredient with the ingredient name
    response_data = new_ingredient.to_dict()
    response_data["ingredient_name"] = ingredient.name

    return jsonify(response_data), 201


@recipe_ingredients_bp.route(
    "/recipes/<int:recipe_id>/ingredients/<int:ingredient_id>", methods=["DELETE"]
)
@jwt_required()
def remove_recipe_ingredient(recipe_id, ingredient_id):
    current_user_id = get_jwt_identity()

    # Get the recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe
    if recipe.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    # Find the recipe ingredient
    recipe_ingredient = RecipeIngredient.query.filter_by(
        id=ingredient_id, recipe_id=recipe_id
    ).first()

    if not recipe_ingredient:
        return jsonify({"error": "Ingredient not found in recipe"}), 404

    # Delete the recipe ingredient
    db.session.delete(recipe_ingredient)
    db.session.commit()

    return jsonify({"message": "Ingredient removed from recipe"}), 200


@recipe_ingredients_bp.route("/recipes/<int:recipe_id>/metrics", methods=["GET"])
@jwt_required()
def calculate_recipe_metrics(recipe_id):
    current_user_id = get_jwt_identity()

    # Get the recipe with its ingredients
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Authorization check
    if recipe.user_id != current_user_id and not recipe.is_public:
        return jsonify({"error": "Unauthorized access"}), 403

    # Get all ingredients with a single query to avoid N+1 problem
    recipe_ingredients = (
        RecipeIngredient.query.join(Ingredient)
        .filter(RecipeIngredient.recipe_id == recipe_id)
        .all()
    )

    # Calculate metrics using helper functions
    og = calculate_og(recipe)
    fg = calculate_fg(recipe)
    abv = calculate_abv(recipe)
    ibu = calculate_ibu(recipe)
    srm = calculate_srm(recipe)

    # Update recipe with calculated metrics
    recipe.estimated_og = og
    recipe.estimated_fg = fg
    recipe.estimated_abv = abv
    recipe.estimated_ibu = ibu
    recipe.estimated_srm = srm
    db.session.commit()

    return (
        jsonify({"metrics": {"og": og, "fg": fg, "abv": abv, "ibu": ibu, "srm": srm}}),
        200,
    )
