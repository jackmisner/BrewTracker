from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models.mongo_models import BeerStyleGuide, DataVersion, Recipe
from services.mongodb_service import MongoDBService

beer_styles_bp = Blueprint("beer_styles", __name__)


@beer_styles_bp.route("", methods=["GET"])
def get_beer_styles():
    """Get all beer styles grouped by category"""
    try:
        categories = MongoDBService.get_all_beer_styles()
        return jsonify({"categories": categories}), 200
    except Exception as e:
        print(f"Error fetching beer styles: {e}")
        return jsonify({"error": "Failed to fetch beer styles"}), 500


@beer_styles_bp.route("/search", methods=["GET"])
def search_beer_styles():
    """Search beer styles"""
    query = request.args.get("q", "")

    try:
        styles = MongoDBService.search_beer_styles(query)
        return jsonify({"styles": styles}), 200
    except Exception as e:
        print(f"Error searching beer styles: {e}")
        return jsonify({"error": "Failed to search beer styles"}), 500


@beer_styles_bp.route("/version", methods=["GET"])
def get_beer_styles_version():
    """Get current version information for beer styles data"""
    try:
        # Get version with optimized count handling
        version = DataVersion.get_or_create_version_optimized(
            "beer_styles", BeerStyleGuide
        )

        return (
            jsonify(
                {
                    "version": version.version,
                    "last_modified": (
                        version.last_modified.isoformat()
                        if version.last_modified
                        else None
                    ),
                    "total_records": version.total_records,
                    "data_type": "beer_styles",
                }
            ),
            200,
        )

    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error getting beer styles version: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


@beer_styles_bp.route("/<style_id>", methods=["GET"])
def get_beer_style(style_id):
    """Get a specific beer style"""
    try:
        style = BeerStyleGuide.objects(style_id=style_id).first()
        if not style:
            return jsonify({"error": "Beer style not found"}), 404

        return jsonify(style.to_dict()), 200
    except Exception as e:
        print(f"Error fetching beer style: {e}")
        return jsonify({"error": "Failed to fetch beer style"}), 500


@beer_styles_bp.route("/suggestions/<recipe_id>", methods=["GET"])
@jwt_required()
def get_style_suggestions(recipe_id):
    """Get style suggestions for a recipe"""
    user_id = get_jwt_identity()

    try:
        # Verify user has access to recipe
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        if str(recipe.user_id) != user_id and not recipe.is_public:
            return jsonify({"error": "Access denied"}), 403

        suggestions = MongoDBService.get_style_suggestions_for_recipe(recipe_id)
        return jsonify({"suggestions": suggestions}), 200
    except Exception as e:
        print(f"Error getting style suggestions: {e}")
        return jsonify({"error": "Failed to get style suggestions"}), 500


@beer_styles_bp.route("/analysis/<recipe_id>", methods=["GET"])
@jwt_required()
def get_recipe_style_analysis(recipe_id):
    """Get style analysis for a recipe"""
    user_id = get_jwt_identity()

    try:
        # Verify user has access to recipe
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        if str(recipe.user_id) != user_id and not recipe.is_public:
            return jsonify({"error": "Access denied"}), 403

        analysis = MongoDBService.get_recipe_style_analysis(recipe_id)
        return jsonify({"analysis": analysis}), 200
    except Exception as e:
        print(f"Error getting style analysis: {e}")
        return jsonify({"error": "Failed to get style analysis"}), 500


@beer_styles_bp.route("/match-metrics", methods=["POST"])
def match_styles_to_metrics():
    """Find styles matching provided metrics (for frontend-calculated metrics)"""
    data = request.get_json()

    # Validate required metrics
    required_fields = ["og", "fg", "abv", "ibu", "srm"]
    metrics = {}

    for field in required_fields:
        if field in data:
            try:
                metrics[f"estimated_{field}"] = float(data[field])
            except (ValueError, TypeError):
                return jsonify({"error": f"Invalid {field} value"}), 400

    if not metrics:
        return jsonify({"error": "At least one metric is required"}), 400

    try:
        matches = MongoDBService.find_matching_styles_by_metrics(metrics)
        return jsonify({"matches": matches}), 200
    except Exception as e:
        print(f"Error matching styles to metrics: {e}")
        return jsonify({"error": "Failed to find matching styles"}), 500
