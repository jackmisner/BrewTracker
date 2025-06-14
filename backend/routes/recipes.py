from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from models.mongo_models import Recipe, User
from services.mongodb_service import MongoDBService
from utils.recipe_api_calculator import calculate_all_metrics_preview

recipes_bp = Blueprint("recipes", __name__)


@recipes_bp.route("", methods=["GET"])
@jwt_required()
def get_recipes():
    user_id = get_jwt_identity()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))

    # Use unit-aware method
    result = MongoDBService.get_user_recipes_with_units(user_id, page, per_page)

    # Since get_user_recipes_with_units now returns dictionaries directly,
    # we don't need to call to_dict() on them
    recipes = result["items"]

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


@recipes_bp.route("/<recipe_id>", methods=["GET"])
@jwt_required()
def get_recipe(recipe_id):
    user_id = get_jwt_identity()

    # Use unit-aware method
    recipe_data = MongoDBService.get_recipe_for_user(recipe_id, user_id)

    if not recipe_data:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user has access to this recipe
    recipe = Recipe.objects(id=recipe_id).first()
    if str(recipe.user_id) != user_id and not recipe.is_public:
        return jsonify({"error": "Access denied"}), 403

    return jsonify(recipe_data), 200


@recipes_bp.route("", methods=["POST"])
@jwt_required()
def create_recipe():
    user_id = get_jwt_identity()
    data = request.get_json()

    # Add user_id to the recipe data
    data["user_id"] = ObjectId(user_id)

    # Create recipe with unit awareness
    recipe = MongoDBService.create_recipe(data, user_id)

    if recipe:
        # Return recipe converted to user's preferred units
        recipe_data = MongoDBService.get_recipe_for_user(str(recipe.id), user_id)
        return jsonify(recipe_data), 201
    else:
        return jsonify({"error": "Failed to create recipe"}), 400


@recipes_bp.route("/<recipe_id>", methods=["PUT"])
@jwt_required()
def update_recipe(recipe_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check if recipe exists and belongs to user
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    if str(recipe.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Update recipe
    updated_recipe, message = MongoDBService.update_recipe(recipe_id, data)

    if updated_recipe:
        return jsonify(updated_recipe.to_dict()), 200
    else:
        return jsonify({"error": message}), 400


@recipes_bp.route("/<recipe_id>", methods=["DELETE"])
@jwt_required()
def delete_recipe(recipe_id):
    user_id = get_jwt_identity()

    # Check if recipe exists and belongs to user
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    if str(recipe.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Delete recipe
    recipe.delete()

    return jsonify({"message": "Recipe deleted successfully"}), 200


@recipes_bp.route("/<recipe_id>/brew-sessions", methods=["GET"])
@jwt_required()
def get_recipe_brew_sessions(recipe_id):
    """Get all brew sessions for a specific recipe"""
    user_id = get_jwt_identity()

    try:
        # First verify the recipe exists and user has access
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        if str(recipe.user_id) != user_id and not recipe.is_public:
            return jsonify({"error": "Access denied"}), 403

        # Get brew sessions for this recipe
        sessions = MongoDBService.get_recipe_brew_sessions(recipe_id)

        # Filter sessions to only include user's own sessions
        user_sessions = [
            session for session in sessions if str(session.user_id) == user_id
        ]

        # Convert to dict format
        sessions_data = [session.to_dict() for session in user_sessions]

        return (
            jsonify({"brew_sessions": sessions_data, "total": len(sessions_data)}),
            200,
        )

    except Exception as e:
        print(f"Error fetching recipe brew sessions: {e}")
        return jsonify({"error": "Failed to fetch brew sessions"}), 500


@recipes_bp.route("/<recipe_id>/metrics", methods=["GET"])
@jwt_required()
def get_recipe_metrics(recipe_id):
    # Calculate recipe statistics
    stats = MongoDBService.calculate_recipe_stats(recipe_id)

    if stats:
        return jsonify(stats), 200
    else:
        return jsonify({"message": "No completed brew sessions for this recipe"}), 404


@recipes_bp.route("/calculate-metrics-preview", methods=["POST"])
@jwt_required()
def calculate_metrics_preview():
    """Calculate metrics for a recipe that hasn't been saved to the database yet"""
    try:
        data = request.get_json()

        # Calculate metrics
        metrics = calculate_all_metrics_preview(data)

        return jsonify(metrics), 200
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return jsonify({"error": f"Failed to calculate metrics: {str(e)}"}), 400


@recipes_bp.route("/<recipe_id>/clone", methods=["POST"])
@jwt_required()
def clone_recipe(recipe_id):
    user_id = get_jwt_identity()

    # Clone the recipe
    cloned_recipe, message = MongoDBService.clone_recipe(recipe_id, user_id)

    if cloned_recipe:
        return jsonify(cloned_recipe.to_dict()), 201
    else:
        return jsonify({"error": message}), 400


@recipes_bp.route("/<recipe_id>/versions", methods=["GET"])
@jwt_required()
def get_recipe_versions(recipe_id):
    user_id = get_jwt_identity()

    # Get the recipe
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user has access
    if str(recipe.user_id) != user_id and not recipe.is_public:
        return jsonify({"error": "Access denied"}), 403

    # Get parent recipe if exists
    parent_recipe = None
    if recipe.parent_recipe_id:
        parent = Recipe.objects(id=recipe.parent_recipe_id).first()
        if parent:
            parent_recipe = {
                "recipe_id": str(parent.id),
                "name": parent.name,
                "version": parent.version,
            }

    # Get child versions
    child_versions = []
    children = Recipe.objects(parent_recipe_id=recipe_id)
    for child in children:
        child_versions.append(
            {"recipe_id": str(child.id), "name": child.name, "version": child.version}
        )

    return (
        jsonify(
            {
                "current_version": recipe.version,
                "parent_recipe": parent_recipe,
                "child_versions": child_versions,
            }
        ),
        200,
    )
