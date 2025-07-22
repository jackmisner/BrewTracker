"""
AI Recipe Analysis Routes

Provides endpoints for AI-powered recipe analysis, suggestions, and optimization
using the backend RecipeAnalysisEngine.
"""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models.mongo_models import BeerStyleGuide, Recipe, User
from services.ai import RecipeAnalysisEngine
from services.ai.flowchart_ai_service import get_flowchart_ai_service
from utils.unit_conversions import UnitConverter

logger = logging.getLogger(__name__)

ai_bp = Blueprint("ai", __name__)

# Initialize the analysis engines
analysis_engine = RecipeAnalysisEngine()
flowchart_ai_service = get_flowchart_ai_service()


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

        # Check if flowchart-based analysis is requested
        use_flowchart = data.get("use_flowchart", False)
        workflow_name = data.get("workflow_name")  # Optional workflow name

        # The frontend already sends recipe data in the user's preferred units,
        # so no conversion is needed here. The previous conversion was causing
        # batch size to be incorrectly converted from liters to gallons to liters again.

        if use_flowchart:
            # Use flowchart-based analysis
            logger.info(f"🔬 Using flowchart-based analysis with workflow: {workflow_name or 'default'}")
            analysis_result = flowchart_ai_service.analyze_recipe(
                recipe_data,
                style_id=style_id,
                unit_system=unit_system,
                workflow_name=workflow_name
            )
        else:
            # Use traditional analysis engine
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


@ai_bp.route("/optimize-recipe", methods=["POST"])
@jwt_required()
def optimize_recipe():
    """
    Optimize a recipe using flowchart-based analysis

    Expected payload:
    {
        "recipe_data": {
            "ingredients": [...],
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75
        },
        "style_id": "optional-style-guide-id",
        "workflow_name": "optional-workflow-name",  # defaults to "recipe_optimization"
        "unit_system": "metric" | "imperial"  # optional, defaults to user preference
    }

    Returns:
    {
        "optimization_performed": true,
        "iterations_completed": 3,
        "original_metrics": {...},
        "optimized_metrics": {...},
        "optimized_recipe": {...},
        "recipe_changes": [...],
        "optimization_history": [...],
        "execution_path": [...],  # detailed workflow execution path
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

        # Get optional parameters
        style_id = data.get("style_id")
        workflow_name = data.get("workflow_name", "recipe_optimization")
        unit_system = data.get("unit_system") or user.get_preferred_units()

        # Validate unit system
        if unit_system not in ["metric", "imperial"]:
            unit_system = "imperial"  # Default fallback

        logger.info(f"🔬 Optimizing recipe using flowchart workflow: {workflow_name}")
        logger.info(f"🔍 Recipe has {len(recipe_data.get('ingredients', []))} ingredients")

        # Perform flowchart-based optimization
        optimization_result = flowchart_ai_service.analyze_recipe(
            recipe_data,
            style_id=style_id,
            unit_system=unit_system,
            workflow_name=workflow_name
        )

        # Add metadata specific to optimization endpoint
        optimization_result["unit_system"] = unit_system
        optimization_result["workflow_name"] = workflow_name
        optimization_result["user_preferences"] = {
            "preferred_units": user.get_preferred_units(),
            "default_batch_size": user.get_default_batch_size(),
        }

        logger.info(f"✅ Optimization completed. Changes made: {len(optimization_result.get('recipe_changes', []))}")

        return jsonify(optimization_result), 200

    except Exception as e:
        logger.error(f"Recipe optimization failed: {str(e)}", exc_info=True)
        return jsonify({"error": "Recipe optimization failed", "details": str(e)}), 500


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


@ai_bp.route("/workflows", methods=["GET"])
@jwt_required()
def list_workflows():
    """
    List available optimization workflows
    
    Returns:
    {
        "workflows": [
            {
                "name": "recipe_optimization",
                "display_name": "Recipe Style Optimization",
                "description": "Comprehensive recipe optimization following BJCP style guidelines",
                "version": "1.0"
            }
        ]
    }
    """
    try:
        workflows = flowchart_ai_service.get_available_workflows()
        
        # Get workflow details for each
        workflow_details = []
        for workflow_name in workflows:
            try:
                from .workflow_config_loader import load_workflow
                config = load_workflow(workflow_name)
                
                workflow_details.append({
                    "name": workflow_name,
                    "display_name": config.get("workflow_name", workflow_name),
                    "description": config.get("description", "No description available"),
                    "version": config.get("version", "1.0")
                })
            except Exception as e:
                logger.warning(f"Could not load details for workflow {workflow_name}: {e}")
                workflow_details.append({
                    "name": workflow_name,
                    "display_name": workflow_name.title().replace('_', ' '),
                    "description": "Workflow available but details could not be loaded",
                    "version": "Unknown"
                })
        
        return jsonify({"workflows": workflow_details}), 200
        
    except Exception as e:
        logger.error(f"Failed to list workflows: {str(e)}")
        return jsonify({"error": "Failed to list workflows", "details": str(e)}), 500
