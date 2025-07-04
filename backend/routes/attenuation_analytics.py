from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from services.attenuation_service import AttenuationService

attenuation_analytics_bp = Blueprint("attenuation_analytics", __name__)


@attenuation_analytics_bp.route("/yeast/<ingredient_id>", methods=["GET"])
@jwt_required()
def get_yeast_attenuation_analytics(ingredient_id):
    """Get attenuation analytics for a specific yeast ingredient"""
    try:
        analytics = AttenuationService.get_attenuation_analytics(ingredient_id)

        if analytics:
            return jsonify(analytics), 200
        else:
            return (
                jsonify(
                    {"error": "Yeast ingredient not found or no analytics available"}
                ),
                404,
            )

    except Exception as e:
        return jsonify({"error": f"Failed to retrieve analytics: {str(e)}"}), 500


@attenuation_analytics_bp.route("/yeast", methods=["GET"])
@jwt_required()
def get_all_yeast_analytics():
    """Get attenuation analytics for all yeast ingredients with data"""
    try:
        analytics_list = AttenuationService.get_all_yeast_analytics()

        return (
            jsonify(
                {"yeast_analytics": analytics_list, "total_count": len(analytics_list)}
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": f"Failed to retrieve analytics: {str(e)}"}), 500


@attenuation_analytics_bp.route(
    "/yeast/<ingredient_id>/improved-estimate", methods=["GET"]
)
@jwt_required()
def get_improved_attenuation_estimate(ingredient_id):
    """Get improved attenuation estimate for a specific yeast"""
    try:
        estimate = AttenuationService.get_improved_attenuation_estimate(ingredient_id)

        if estimate is not None:
            return (
                jsonify(
                    {"ingredient_id": ingredient_id, "improved_estimate": estimate}
                ),
                200,
            )
        else:
            return jsonify({"error": "Yeast ingredient not found"}), 404

    except Exception as e:
        return jsonify({"error": f"Failed to calculate estimate: {str(e)}"}), 500


@attenuation_analytics_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_attenuation_system_stats():
    """Get overall system statistics for attenuation tracking"""
    try:
        from models.mongo_models import Ingredient

        # Get counts of yeast ingredients
        total_yeast = Ingredient.objects(type="yeast").count()
        yeast_with_data = Ingredient.objects(
            type="yeast", actual_attenuation_count__gt=0
        ).count()

        # Get total data points collected
        total_data_points = 0
        high_confidence_yeast = 0

        for ingredient in Ingredient.objects(
            type="yeast", actual_attenuation_count__gt=0
        ):
            total_data_points += ingredient.actual_attenuation_count
            if (
                ingredient.attenuation_confidence
                and ingredient.attenuation_confidence >= 0.8
            ):
                high_confidence_yeast += 1

        stats = {
            "total_yeast_ingredients": total_yeast,
            "yeast_with_actual_data": yeast_with_data,
            "total_attenuation_data_points": total_data_points,
            "high_confidence_yeast": high_confidence_yeast,
            "data_coverage_percentage": (
                round((yeast_with_data / total_yeast * 100), 1)
                if total_yeast > 0
                else 0
            ),
        }

        return jsonify(stats), 200

    except Exception as e:
        return jsonify({"error": f"Failed to retrieve system stats: {str(e)}"}), 500
