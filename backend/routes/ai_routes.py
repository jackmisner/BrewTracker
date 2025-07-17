"""
AI Recipe Analysis Routes

Provides endpoints for AI-powered recipe analysis, suggestions, and optimization
using the backend RecipeAnalysisEngine.
"""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models.mongo_models import BeerStyleGuide, Recipe, User
from services.ai_service import RecipeAnalysisEngine
from utils.unit_conversions import UnitConverter

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__)

# Initialize the analysis engine
analysis_engine = RecipeAnalysisEngine()


@ai_bp.route("/analyze-recipe", methods=["POST"])
@jwt_required()
def analyze_recipe():
    """
    Analyze a recipe and provide AI-powered suggestions

    Expected payload:
    {
        "recipe_data": {
            "ingredients": [...],
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75
        },
        "style_id": "optional-style-guide-id",
        "unit_system": "metric" | "imperial"  # optional, defaults to user preference
    }

    Returns:
    {
        "current_metrics": {...},
        "style_analysis": {...},
        "suggestions": [...],
        "analysis_timestamp": "..."
    }
    """
    try:
        # Get current user to determine unit preferences
        current_user_id = get_jwt_identity()
        user = User.objects(id=current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        recipe_data = data.get("recipe_data")
        if not recipe_data:
            return jsonify({"error": "recipe_data is required"}), 400

        # Get style ID (optional)
        style_id = data.get("style_id")

        # Get unit system (use user preference if not specified)
        unit_system = data.get("unit_system") or user.get_preferred_units()

        # Validate unit system
        if unit_system not in ["metric", "imperial"]:
            unit_system = "imperial"  # Default fallback

        # The frontend already sends recipe data in the user's preferred units,
        # so no conversion is needed here. The previous conversion was causing
        # batch size to be incorrectly converted from liters to gallons to liters again.

        # Perform AI analysis
        analysis_result = analysis_engine.analyze_recipe(
            recipe_data,  # Use original data, already in correct units
            style_id=style_id,
            unit_system=unit_system,
        )

        # Add metadata
        analysis_result["unit_system"] = unit_system
        analysis_result["user_preferences"] = {
            "preferred_units": user.get_preferred_units(),
            "default_batch_size": user.get_default_batch_size(),
        }

        return jsonify(analysis_result), 200

    except Exception as e:
        logger.error(f"Recipe analysis failed: {str(e)}")
        return jsonify({"error": "Recipe analysis failed", "details": str(e)}), 500


@ai_bp.route("/suggestions", methods=["POST"])
@jwt_required()
def get_suggestions():
    """
    Get AI suggestions for a specific recipe

    Expected payload:
    {
        "recipe_data": {...},
        "style_id": "optional-style-guide-id",
        "suggestion_types": ["style_compliance", "general"]  # optional filter
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.objects(id=current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        recipe_data = data.get("recipe_data")
        style_id = data.get("style_id")
        unit_system = user.get_preferred_units()

        if not recipe_data:
            return jsonify({"error": "recipe_data is required"}), 400

        # The frontend already sends recipe data in user's preferred units
        # Get current metrics
        current_metrics = analysis_engine._calculate_recipe_metrics(recipe_data)

        # Get style analysis if style provided
        style_analysis = None
        if style_id:
            style_guide = BeerStyleGuide.objects(id=style_id).first()
            if style_guide:
                style_analysis = analysis_engine.style_analyzer.analyze_compliance(
                    current_metrics, style_guide
                )

        # Generate suggestions
        logger.info(
            f"🔍 Generating suggestions for recipe with {len(recipe_data.get('ingredients', []))} ingredients"
        )
        suggestions = analysis_engine.suggestion_generator.generate_suggestions(
            recipe_data, current_metrics, style_analysis, unit_system
        )
        logger.info(f"🔍 Generated {len(suggestions)} suggestions")

        return (
            jsonify(
                {
                    "suggestions": suggestions,
                    "current_metrics": current_metrics,
                    "style_analysis": style_analysis,
                    "unit_system": unit_system,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Suggestion generation failed: {str(e)}")
        return (
            jsonify({"error": "Suggestion generation failed", "details": str(e)}),
            500,
        )


@ai_bp.route("/effects", methods=["POST"])
@jwt_required()
def calculate_effects():
    """
    Calculate cascading effects of proposed recipe changes

    Expected payload:
    {
        "original_recipe": {...},
        "changes": [
            {
                "ingredient_id": "...",
                "field": "amount",
                "suggested_value": 2.5,
                "is_new_ingredient": false,
                "new_ingredient_data": {...}  # if is_new_ingredient is true
            }
        ]
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.objects(id=current_user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        original_recipe = data.get("original_recipe")
        changes = data.get("changes", [])

        if not original_recipe:
            return jsonify({"error": "original_recipe is required"}), 400

        # The frontend already sends recipe data in user's preferred units
        # Calculate effects
        effects = analysis_engine.effects_calculator.calculate_effects(
            original_recipe, changes
        )

        return (
            jsonify({"effects": effects, "unit_system": user.get_preferred_units()}),
            200,
        )

    except Exception as e:
        logger.error(f"Effects calculation failed: {str(e)}")
        return jsonify({"error": "Effects calculation failed", "details": str(e)}), 500


@ai_bp.route("/health", methods=["GET"])
def ai_health():
    """Health check for AI service"""
    try:
        # Test that the analysis engine can be instantiated
        test_engine = RecipeAnalysisEngine()
        return (
            jsonify(
                {
                    "status": "healthy",
                    "service": "AI Recipe Analysis",
                    "components": {
                        "style_analyzer": "available",
                        "suggestion_generator": "available",
                        "effects_calculator": "available",
                    },
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500
