from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models.mongo_models import DataVersion, Ingredient, User
from services.mongodb_service import MongoDBService

ingredients_bp = Blueprint("ingredients", __name__)


@ingredients_bp.route("", methods=["GET"])
@jwt_required()
def get_ingredients():
    user_id = get_jwt_identity()

    # Optional query parameters
    type_filter = request.args.get("type")
    search = request.args.get("search")
    category_filter = request.args.get("category")

    # Build query
    query = {}
    if type_filter:
        query["type"] = type_filter
    if search:
        query["name__icontains"] = search

    # Add category filtering for type-specific fields
    if category_filter:
        if type_filter == "grain":
            query["grain_type"] = category_filter
        elif type_filter == "yeast":
            query["yeast_type"] = category_filter
        # Note: hops don't have a hop_type field in the current schema
        # For hops, we could implement category filtering based on alpha_acid ranges
        # or add a hop_type field to the schema in the future

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

    # Bump data version (update count eagerly)
    try:
        DataVersion.update_version(
            "ingredients", total_records=Ingredient.objects().count()
        )
    except Exception:
        pass  # non-blocking
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
    # Bump data version (non-blocking)
    try:
        DataVersion.update_version("ingredients")
    except Exception:
        pass
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
    try:
        DataVersion.update_version(
            "ingredients", total_records=Ingredient.objects().count()
        )
    except Exception:
        pass
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


@ingredients_bp.route("/version", methods=["GET"])
def get_ingredients_version():
    """Get current version information for ingredients data"""
    try:
        # Get version with optimized count handling
        version = DataVersion.get_or_create_version_optimized("ingredients", Ingredient)

        payload = {
            "version": version.version,
            "last_modified": (
                version.last_modified.isoformat() if version.last_modified else None
            ),
            "total_records": version.total_records,
            "data_type": "ingredients",
        }
        if request.if_none_match and request.if_none_match.contains(version.version):
            return "", 304
        resp = jsonify(payload)
        resp.set_etag(version.version)
        if version.last_modified:
            resp.last_modified = version.last_modified
        resp.cache_control.public = True
        resp.cache_control.max_age = getattr(version, "count_cache_ttl", 60)
        return resp, 200

    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error getting ingredients version: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500
