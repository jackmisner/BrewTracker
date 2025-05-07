from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.recipe import Recipe
from models.recipe_ingredient import RecipeIngredient
from models.ingredient import Ingredient

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

    # Get the recipe
    recipe = Recipe.query.filter_by(recipe_id=recipe_id).first()

    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user owns the recipe or recipe is public
    if recipe.user_id != current_user_id and not recipe.is_public:
        return jsonify({"error": "Unauthorized access"}), 403

    # Get all ingredients for the recipe
    recipe_ingredients = RecipeIngredient.query.filter_by(recipe_id=recipe_id).all()

    # Calculate metrics
    og = 1.0
    srm = 0.0
    ibu = 0.0

    # Calculate original gravity and SRM from grains
    for ri in recipe_ingredients:
        ingredient = Ingredient.query.get(ri.ingredient_id)

        if ingredient and ingredient.type == "grain" and ingredient.potential:
            # Convert amount to pounds if needed
            weight_lb = ri.amount
            if ri.unit == "oz":
                weight_lb = ri.amount / 16
            elif ri.unit == "kg":
                weight_lb = ri.amount * 2.20462
            elif ri.unit == "g":
                weight_lb = ri.amount * 0.00220462

            # Calculate gravity points contribution
            gravity_points = ingredient.potential * weight_lb / recipe.batch_size
            og += gravity_points / 1000

            # Calculate SRM contribution if color exists
            if ingredient.color:
                srm_contribution = ingredient.color * weight_lb / recipe.batch_size
                srm += srm_contribution

    # Calculate IBUs from hops
    for ri in recipe_ingredients:
        ingredient = Ingredient.query.get(ri.ingredient_id)

        if (
            ingredient
            and ingredient.type == "hop"
            and ingredient.alpha_acid
            and ri.use == "boil"
            and ri.time
        ):
            # Convert amount to ounces if needed
            weight_oz = ri.amount
            if ri.unit == "g":
                weight_oz = ri.amount * 0.035274

            # Simplified IBU calculation
            utilization = min(0.3, 1.65 * 0.000125 ** (ri.time - 1.0107))
            ibu_contribution = (
                weight_oz * ingredient.alpha_acid * utilization * 74.89
            ) / recipe.batch_size
            ibu += ibu_contribution

    # Estimate final gravity based on attenuation
    # Use a default attenuation of 75% if none available from yeast
    attenuation = 0.75
    for ri in recipe_ingredients:
        ingredient = Ingredient.query.get(ri.ingredient_id)
        if ingredient and ingredient.type == "yeast" and ingredient.attenuation:
            attenuation = ingredient.attenuation / 100
            break

    fg = og - ((og - 1.0) * attenuation)

    # Calculate ABV
    abv = (og - fg) * 131.25

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
