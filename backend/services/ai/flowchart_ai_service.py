"""
Flowchart-based AI service integration.

This module provides a service wrapper that integrates the FlowchartEngine
with the existing AI API endpoints and ensures compatibility with the
current frontend expectations.
"""

import logging
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from models.mongo_models import BeerStyleGuide
from utils.recipe_api_calculator import calculate_all_metrics_preview

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
        complete_recipe: Dict[str, Any],
        style_id: Optional[str] = None,
        unit_system: str = "imperial",
        workflow_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze a recipe using the flowchart-based approach.

        Args:
            complete_recipe: Complete recipe object including all metadata and ingredients
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

            # Extract recipe_data for workflow execution (maintain compatibility)
            recipe_data = {
                "ingredients": complete_recipe.get("ingredients", []),
                "batch_size": complete_recipe.get("batch_size", 5.0),
                "batch_size_unit": complete_recipe.get("batch_size_unit", "l"),
                "efficiency": complete_recipe.get("efficiency", 75),
                "boil_time": complete_recipe.get("boil_time", 60),
                "mash_temperature": complete_recipe.get(
                    "mash_temperature", 152 if unit_system == "imperial" else 67
                ),
                "mash_temp_unit": complete_recipe.get(
                    "mash_temp_unit", "F" if unit_system == "imperial" else "C"
                ),
                # For unit conversion workflow - use explicit target or default to unit_system
                "target_unit_system": complete_recipe.get(
                    "target_unit_system", unit_system
                ),
            }

            # Execute the workflow
            workflow_result = engine.execute_workflow(recipe_data, style_guidelines)

            # Convert result to API format - pass complete recipe for preservation
            result = self._convert_workflow_result_to_api_format(
                workflow_result, complete_recipe, style_analysis, unit_system
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
        """
        Apply a list of changes to a recipe and return the modified recipe.

        This method preserves all user-defined fields including:
        - name, style, description, notes (user content)
        - is_public, version, parent_recipe_id (recipe management)
        - recipe_id, user_id, username (identity)
        - created_at, updated_at (timestamps)
        - batch_size, batch_size_unit, boil_time, efficiency (user-controlled brewing params)

        Only modifies optimization-relevant fields:
        - mash_temperature, mash_temp_unit (for FG control)
        - ingredients (additions, modifications, removals)
        - estimated_* fields (calculated metrics)
        """
        # Create a deep copy to avoid modifying original - preserves ALL fields
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

            elif change_type in ["ingredient_converted", "ingredient_normalized"]:
                # Unit conversion/normalization changes
                ingredient_name = change.get("ingredient_name")
                new_amount = change.get("new_amount")
                new_unit = change.get("new_unit")

                # Find and update the ingredient
                for ingredient in ingredients:
                    if ingredient.get("name") == ingredient_name:
                        if new_amount is not None:
                            ingredient["amount"] = new_amount
                        if new_unit is not None:
                            ingredient["unit"] = new_unit
                        break

            elif change_type in ["batch_size_converted", "temperature_converted"]:
                # Recipe-level unit conversions
                if change_type == "batch_size_converted":
                    modified_recipe["batch_size"] = change.get("new_value")
                    modified_recipe["batch_size_unit"] = change.get("new_unit")
                elif change_type == "temperature_converted":
                    parameter = change.get("parameter", "mash_temperature")
                    modified_recipe[parameter] = change.get("new_value")
                    # Also update unit field
                    unit_field = parameter.replace("_temperature", "_temp_unit")
                    modified_recipe[unit_field] = change.get("new_unit")

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

            elif change_type == "modify_recipe_parameter":
                # Handle recipe-level parameter changes (like mash temperature)
                parameter = change.get("parameter")
                new_value = change.get("new_value")
                if parameter and new_value is not None:
                    modified_recipe[parameter] = new_value
                    logger.info(
                        f"Applied recipe parameter change: {parameter} = {new_value}"
                    )

        modified_recipe["ingredients"] = ingredients

        # Calculate and add metrics for the optimized recipe
        # This ensures the frontend receives pre-calculated metrics
        # and doesn't need to trigger recalculation
        try:
            calculated_metrics = calculate_all_metrics_preview(modified_recipe)
            modified_recipe.update(
                {
                    "estimated_og": calculated_metrics["og"],
                    "estimated_fg": calculated_metrics["fg"],
                    "estimated_abv": calculated_metrics["abv"],
                    "estimated_ibu": calculated_metrics["ibu"],
                    "estimated_srm": calculated_metrics["srm"],
                }
            )
            logger.info(
                f"✅ Pre-calculated metrics for optimized recipe: OG={calculated_metrics['og']:.3f}, FG={calculated_metrics['fg']:.3f}, ABV={calculated_metrics['abv']:.1f}%, IBU={calculated_metrics['ibu']}, SRM={calculated_metrics['srm']:.1f}"
            )
        except Exception as e:
            logger.error(f"❌ Failed to calculate metrics for optimized recipe: {e}")
            # Don't include metrics if calculation fails - let frontend handle it

        return modified_recipe

    def _convert_changes_to_api_format(
        self, changes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Convert internal change format to API format expected by frontend.

        Filters out intermediate iteration steps and returns only final net changes
        to provide a clean summary for the user interface. Suppresses ALL
        modifications for newly added ingredients, showing only the final addition.
        """
        # Track ingredients that were added in this workflow
        added_ingredients = set()

        # First pass: identify all ingredient additions
        for change in changes:
            if change.get("type") == "ingredient_added":
                added_ingredients.add(change.get("ingredient_name", ""))

        # Group changes by ingredient and field to eliminate iteration steps
        change_groups = {}
        recipe_param_changes = {}

        for change in changes:
            change_type = change.get("type", "ingredient_modified")
            ingredient_name = change.get("ingredient_name", "")

            if change_type == "modify_recipe_parameter":
                # Recipe parameter changes - keep the latest value
                parameter = change.get("parameter")
                if parameter:
                    recipe_param_changes[parameter] = change

            elif change_type in [
                "ingredient_modified",
                "ingredient_added",
                "ingredient_removed",
            ]:
                # Skip ALL modifications for newly added ingredients
                # Only show the addition, not any subsequent modifications
                if (
                    change_type == "ingredient_modified"
                    and ingredient_name in added_ingredients
                ):
                    # Update the corresponding addition with the final amount (if it's an amount change)
                    if change.get("field") == "amount":
                        self._update_addition_amount(
                            change_groups, ingredient_name, change.get("new_value")
                        )
                    # Skip this modification change entirely
                    continue

                # Ingredient changes - group by name and field
                field = change.get("field", "amount")
                key = f"{ingredient_name}:{field}:{change_type}"

                # For ingredient_added/removed, we want to keep all instances
                if change_type in ["ingredient_added", "ingredient_removed"]:
                    # Use a unique key to avoid grouping
                    key = f"{key}:{len(change_groups)}"

                change_groups[key] = change

        # Convert grouped changes to API format
        api_changes = []

        # Add recipe parameter changes
        for parameter, change in recipe_param_changes.items():
            api_change = {
                "type": "modify_recipe_parameter",
                "ingredient_name": "",  # No ingredient for recipe parameters
                "field": parameter,
                "parameter": parameter,
                "original_value": change.get("current_value"),
                "optimized_value": change.get("new_value"),
                "unit": "",
                "change_reason": f"Adjusted {parameter} for optimization",
            }
            api_changes.append(api_change)

        # Add ingredient changes
        for key, change in change_groups.items():
            change_type = change.get("type", "ingredient_modified")

            api_change = {
                "type": change_type,
                "ingredient_name": change.get("ingredient_name", ""),
                "field": change.get("field", "amount"),
                "original_value": change.get("current_value"),
                "optimized_value": change.get("new_value"),
                "unit": change.get("unit", ""),
                "change_reason": change.get("change_reason", "Optimization change"),
            }

            # Add type-specific fields
            if change_type == "ingredient_added":
                ingredient_data = change.get("ingredient_data", {})
                api_change.update(
                    {
                        "ingredient_type": ingredient_data.get("type", ""),
                        "amount": ingredient_data.get("amount", 0),
                        "unit": ingredient_data.get("unit", ""),
                    }
                )

            api_changes.append(api_change)

        return api_changes

    def _is_normalization_change(self, change: Dict[str, Any]) -> bool:
        """
        Determine if a change is purely a normalization adjustment.

        Normalization changes are typically:
        - Amount field modifications
        - Where the values are close (within reasonable brewing tolerance)
        - Made during the normalization step of the workflow
        """
        field = change.get("field", "")
        if field != "amount":
            return False

        current_value = change.get("current_value")
        new_value = change.get("new_value")
        change_reason = change.get("change_reason", "").lower()

        # Check if this is explicitly a normalization change
        if "normalization" in change_reason or "normalize" in change_reason:
            return True

        # Check if values are close enough to be considered normalization
        # (within 5% or 25g, whichever is larger)
        if current_value and new_value:
            try:
                current_val = float(current_value)
                new_val = float(new_value)

                # Calculate tolerance - 5% of current value or 25g, whichever is larger
                tolerance = max(abs(current_val * 0.05), 25.0)
                diff = abs(new_val - current_val)

                # If the difference is small and the new value is "rounder"
                # (ends in 0 or 5), it's likely a normalization
                if diff <= tolerance:
                    # Check if new value is "rounder" (ends in 0, 5, 25, 50, etc.)
                    new_val_int = int(new_val)
                    if (
                        new_val_int % 25 == 0
                        or new_val_int % 10 == 0
                        or new_val_int % 5 == 0
                    ):
                        return True

            except (ValueError, TypeError):
                pass

        return False

    def _update_addition_amount(
        self,
        change_groups: Dict[str, Dict[str, Any]],
        ingredient_name: str,
        new_amount: Any,
    ) -> None:
        """
        Update the amount in an ingredient addition to reflect the normalized value.
        """
        # Find the addition entry for this ingredient
        for key, change in change_groups.items():
            if (
                change.get("type") == "ingredient_added"
                and change.get("ingredient_name") == ingredient_name
            ):

                # Update the ingredient_data amount to show the final normalized amount
                ingredient_data = change.get("ingredient_data", {})
                if ingredient_data:
                    ingredient_data["amount"] = new_amount

                # Also update the new_value for consistency
                change["new_value"] = new_amount
                break

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
