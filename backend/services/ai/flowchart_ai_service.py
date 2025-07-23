"""
Flowchart-based AI service integration.

This module provides a service wrapper that integrates the FlowchartEngine
with the existing AI API endpoints and ensures compatibility with the
current frontend expectations.
"""

import logging
from datetime import datetime, UTC
from typing import Any, Dict, List, Optional

from models.mongo_models import BeerStyleGuide

from .flowchart_engine import FlowchartEngine, WorkflowResult
from .workflow_config_loader import load_workflow

logger = logging.getLogger(__name__)


class FlowchartAIService:
    """
    Service wrapper for FlowchartEngine that provides compatibility
    with existing AI API endpoints.
    """

    def __init__(self):
        """Initialize the flowchart AI service."""
        self.default_workflow = "recipe_optimization"
        self.engines = {}  # Cache for different workflow engines

    def get_engine(self, workflow_name: str = None) -> FlowchartEngine:
        """
        Get or create a FlowchartEngine for the specified workflow.

        Args:
            workflow_name: Name of the workflow to load. Defaults to recipe_optimization.

        Returns:
            FlowchartEngine instance
        """
        workflow_name = workflow_name or self.default_workflow

        if workflow_name not in self.engines:
            try:
                workflow_config = load_workflow(workflow_name)
                engine = FlowchartEngine(workflow_config)

                # Validate workflow before caching
                is_valid, errors = engine.validate_workflow()
                if not is_valid:
                    logger.error(f"Invalid workflow {workflow_name}: {errors}")
                    raise ValueError(f"Invalid workflow configuration: {errors}")

                self.engines[workflow_name] = engine
                logger.info(f"Loaded workflow engine: {workflow_name}")

            except Exception as e:
                logger.error(f"Failed to load workflow {workflow_name}: {e}")
                # Fall back to default workflow if available
                if workflow_name != self.default_workflow:
                    return self.get_engine(self.default_workflow)
                else:
                    raise

        return self.engines[workflow_name]

    def analyze_recipe(
        self,
        recipe_data: Dict[str, Any],
        style_id: Optional[str] = None,
        unit_system: str = "imperial",
        workflow_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze a recipe using the flowchart-based approach.

        Args:
            recipe_data: Recipe data including ingredients, batch size, etc.
            style_id: Optional MongoDB ObjectId for specific style analysis
            unit_system: Unit system preference (metric/imperial)
            workflow_name: Optional workflow name (defaults to recipe_optimization)

        Returns:
            Analysis result compatible with existing API format
        """
        try:
            # Get the appropriate engine
            engine = self.get_engine(workflow_name)

            # Load style guidelines if style_id provided
            style_guidelines = None
            style_analysis = None
            if style_id:
                style_guidelines = self._load_style_guidelines(style_id)
                if style_guidelines:
                    style_analysis = {
                        "style_name": style_guidelines.get("name", "Unknown"),
                        "overall_score": 0,  # Will be calculated by engine
                        "compliance": {},
                        "optimization_targets": [],
                    }

            # Execute the workflow
            workflow_result = engine.execute_workflow(recipe_data, style_guidelines)

            # Convert result to API format
            result = self._convert_workflow_result_to_api_format(
                workflow_result, recipe_data, style_analysis, unit_system
            )

            return result

        except Exception as e:
            logger.error(
                f"FlowchartAIService analyze_recipe failed: {e}", exc_info=True
            )
            raise

    def get_suggestions(
        self,
        recipe_data: Dict[str, Any],
        style_id: Optional[str] = None,
        suggestion_types: Optional[List[str]] = None,
        unit_system: str = "imperial",
    ) -> Dict[str, Any]:
        """
        Get suggestions using flowchart-based analysis.

        This is a simpler version that focuses on generating suggestions
        without full optimization.
        """
        try:
            # For suggestions-only mode, we can use the same analyze_recipe
            # but filter the results to focus on suggestions
            result = self.analyze_recipe(recipe_data, style_id, unit_system)

            # Extract just the suggestions portion
            return {
                "suggestions": result.get("suggestions", []),
                "current_metrics": result.get("current_metrics", {}),
                "style_analysis": result.get("style_analysis"),
                "unit_system": unit_system,
            }

        except Exception as e:
            logger.error(
                f"FlowchartAIService get_suggestions failed: {e}", exc_info=True
            )
            raise

    def calculate_effects(
        self, original_recipe: Dict[str, Any], changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate cascading effects of proposed changes.

        This uses the existing effects calculation logic but could be
        enhanced with flowchart-based prediction in the future.
        """
        try:
            # Import here to avoid circular imports
            from .cascading_effects_calculator import CascadingEffectsCalculator

            effects_calculator = CascadingEffectsCalculator()
            effects = effects_calculator.calculate_effects(original_recipe, changes)

            return {"effects": effects}

        except Exception as e:
            logger.error(
                f"FlowchartAIService calculate_effects failed: {e}", exc_info=True
            )
            raise

    def _load_style_guidelines(self, style_id: str) -> Optional[Dict[str, Any]]:
        """Load style guidelines from MongoDB."""
        try:
            style_guide = BeerStyleGuide.objects(id=style_id).first()
            if not style_guide:
                logger.warning(f"Style guide not found: {style_id}")
                return None

            # Convert style guide to dictionary format expected by RecipeContext
            # Use proper StyleRange objects from the BeerStyleGuide model
            ranges = {}

            # Original Gravity (OG)
            if (
                hasattr(style_guide, "original_gravity")
                and style_guide.original_gravity
            ):
                ranges["OG"] = {
                    "min": style_guide.original_gravity.minimum,
                    "max": style_guide.original_gravity.maximum,
                }

            # Final Gravity (FG)
            if hasattr(style_guide, "final_gravity") and style_guide.final_gravity:
                ranges["FG"] = {
                    "min": style_guide.final_gravity.minimum,
                    "max": style_guide.final_gravity.maximum,
                }

            # Alcohol By Volume (ABV)
            if (
                hasattr(style_guide, "alcohol_by_volume")
                and style_guide.alcohol_by_volume
            ):
                ranges["ABV"] = {
                    "min": style_guide.alcohol_by_volume.minimum,
                    "max": style_guide.alcohol_by_volume.maximum,
                }

            # International Bitterness Units (IBU)
            if (
                hasattr(style_guide, "international_bitterness_units")
                and style_guide.international_bitterness_units
            ):
                ranges["IBU"] = {
                    "min": style_guide.international_bitterness_units.minimum,
                    "max": style_guide.international_bitterness_units.maximum,
                }

            # Color (SRM)
            if hasattr(style_guide, "color") and style_guide.color:
                ranges["SRM"] = {
                    "min": style_guide.color.minimum,
                    "max": style_guide.color.maximum,
                }

            return {
                "id": str(style_guide.id),
                "name": style_guide.name,
                "display_name": getattr(style_guide, "display_name", style_guide.name),
                "category": getattr(style_guide, "category", ""),
                "ranges": ranges,
            }

        except Exception as e:
            logger.error(f"Error loading style guidelines {style_id}: {e}")
            return None

    def _convert_workflow_result_to_api_format(
        self,
        workflow_result: WorkflowResult,
        original_recipe: Dict[str, Any],
        style_analysis: Optional[Dict[str, Any]],
        unit_system: str,
    ) -> Dict[str, Any]:
        """
        Convert WorkflowResult to the API format expected by the frontend.
        """
        # Determine if optimization was performed (if changes were made)
        optimization_performed = len(workflow_result.changes) > 0

        if optimization_performed:
            # Full optimization mode - return complete optimization result
            # Generate optimized recipe by applying changes to original
            optimized_recipe = self._apply_changes_to_recipe(
                original_recipe, workflow_result.changes
            )

            # Create optimization summary
            optimization_summary = workflow_result.optimization_summary or {}

            return {
                "current_metrics": optimization_summary.get(
                    "metrics_before", workflow_result.final_metrics
                ),
                "style_analysis": style_analysis,
                "suggestions": [],  # Empty for optimization mode
                "analysis_timestamp": datetime.now(UTC),
                "unit_system": unit_system,
                "user_preferences": {
                    "preferred_units": unit_system,
                    "default_batch_size": original_recipe.get("batch_size", 5.0),
                },
                # Optimization-specific fields
                "optimization_performed": True,
                "iterations_completed": workflow_result.iterations_completed,
                "original_metrics": optimization_summary.get("metrics_before", {}),
                "optimized_metrics": workflow_result.final_metrics,
                "optimized_recipe": optimized_recipe,
                "recipe_changes": self._convert_changes_to_api_format(
                    workflow_result.changes
                ),
                "optimization_history": [
                    {
                        "iteration": 1,
                        "applied_changes": workflow_result.changes,
                        "metrics_before": optimization_summary.get(
                            "metrics_before", {}
                        ),
                        "metrics_after": workflow_result.final_metrics,
                    }
                ],
            }

        else:
            # No optimization needed - return suggestions format
            return {
                "current_metrics": workflow_result.final_metrics,
                "style_analysis": style_analysis,
                "suggestions": [],  # Could generate suggestions here if needed
                "analysis_timestamp": datetime.now(UTC),
                "unit_system": unit_system,
                "user_preferences": {
                    "preferred_units": unit_system,
                    "default_batch_size": original_recipe.get("batch_size", 5.0),
                },
                "optimization_performed": False,
            }

    def _apply_changes_to_recipe(
        self, original_recipe: Dict[str, Any], changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply a list of changes to a recipe and return the modified recipe."""
        # Create a deep copy to avoid modifying original
        import copy

        modified_recipe = copy.deepcopy(original_recipe)

        ingredients = modified_recipe.get("ingredients", [])

        for change in changes:
            change_type = change.get("type")

            if change_type == "ingredient_modified":
                ingredient_name = change.get("ingredient_name")
                field = change.get("field", "amount")
                new_value = change.get("new_value")

                # Find and modify the ingredient
                for ingredient in ingredients:
                    if ingredient.get("name") == ingredient_name:
                        ingredient[field] = new_value
                        break

            elif change_type == "ingredient_added":
                new_ingredient = change.get("ingredient_data", {})
                if new_ingredient:
                    # Check for duplicates before adding
                    ingredient_name = new_ingredient.get("name")
                    ingredient_type = new_ingredient.get("type")
                    use = new_ingredient.get("use", "")
                    time = new_ingredient.get("time", 0)

                    # Check if this ingredient already exists with same name, type, use, and time
                    duplicate_found = False
                    for existing in ingredients:
                        if (
                            existing.get("name") == ingredient_name
                            and existing.get("type") == ingredient_type
                            and existing.get("use") == use
                            and existing.get("time") == time
                        ):
                            logger.warning(
                                f"Skipping duplicate ingredient addition: {ingredient_name}"
                            )
                            duplicate_found = True
                            break

                    if not duplicate_found:
                        ingredients.append(new_ingredient)

            elif change_type == "ingredient_removed":
                ingredient_name = change.get("ingredient_name")
                ingredients[:] = [
                    ing for ing in ingredients if ing.get("name") != ingredient_name
                ]

        modified_recipe["ingredients"] = ingredients
        return modified_recipe

    def _convert_changes_to_api_format(
        self, changes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert internal change format to API format expected by frontend."""
        api_changes = []

        for change in changes:
            api_change = {
                "type": change.get("type", "ingredient_modified"),
                "ingredient_name": change.get("ingredient_name", ""),
                "field": change.get("field", "amount"),
                "original_value": change.get("current_value"),
                "optimized_value": change.get("new_value"),
                "unit": change.get("unit", ""),
                "change_reason": change.get("change_reason", "Optimization change"),
            }

            # Add ingredient-specific fields
            if change.get("type") == "ingredient_added":
                api_change.update(
                    {
                        "ingredient_type": change.get("ingredient_data", {}).get(
                            "type", ""
                        ),
                        "amount": change.get("ingredient_data", {}).get("amount", 0),
                        "unit": change.get("ingredient_data", {}).get("unit", ""),
                    }
                )

            api_changes.append(api_change)

        return api_changes

    def get_available_workflows(self) -> List[str]:
        """Get list of available workflow names."""
        try:
            from .workflow_config_loader import list_workflows

            return list_workflows()
        except Exception as e:
            logger.error(f"Error listing workflows: {e}")
            return [self.default_workflow]


# Global service instance
_flowchart_ai_service = None


def get_flowchart_ai_service() -> FlowchartAIService:
    """Get the global FlowchartAIService instance."""
    global _flowchart_ai_service
    if _flowchart_ai_service is None:
        _flowchart_ai_service = FlowchartAIService()
    return _flowchart_ai_service
