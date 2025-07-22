"""
Cascading Effects Calculator

Calculates predicted effects of recipe changes on brewing metrics.
Handles ingredient modifications and new ingredient additions.
"""

import logging
from typing import Any, Dict, List

from utils.recipe_api_calculator import (
    calculate_abv_preview,
    calculate_fg_preview,
    calculate_ibu_preview,
    calculate_og_preview,
    calculate_srm_preview,
)

logger = logging.getLogger(__name__)


class CascadingEffectsCalculator:
    """Calculates predicted effects of recipe changes"""

    def calculate_effects(self, original_recipe: Dict, changes: List[Dict]) -> Dict:
        """
        Calculate the predicted effects of applying changes to a recipe

        Args:
            original_recipe: Original recipe data
            changes: List of ingredient changes to apply

        Returns:
            Predicted new metrics and changes
        """
        try:

            # Create modified recipe by applying changes
            modified_recipe = self._apply_changes_to_recipe(original_recipe, changes)

            # Calculate metrics for both original and modified recipes
            original_metrics = self._calculate_metrics(original_recipe)
            modified_metrics = self._calculate_metrics(modified_recipe)

            # Calculate the differences
            metric_changes = {}
            for metric in ["og", "fg", "abv", "ibu", "srm"]:
                original_value = original_metrics.get(metric, 0)
                modified_value = modified_metrics.get(metric, 0)
                change = modified_value - original_value

                metric_changes[metric] = {
                    "original": original_value,
                    "predicted": modified_value,
                    "change": change,
                    "change_percent": (
                        (change / original_value * 100) if original_value != 0 else 0
                    ),
                }

            return {
                "original_metrics": original_metrics,
                "predicted_metrics": modified_metrics,
                "metric_changes": metric_changes,
            }

        except Exception as e:
            logger.error(f"Cascading effects calculation failed: {str(e)}")
            return {}

    def _apply_changes_to_recipe(self, recipe: Dict, changes: List[Dict]) -> Dict:
        """Apply ingredient changes to create a modified recipe"""
        import copy

        # CRITICAL FIX: Use deep copy to avoid modifying original recipe
        modified_recipe = copy.deepcopy(recipe)
        modified_ingredients = modified_recipe.get("ingredients", [])

        # Apply changes to ingredients
        for change in changes:
            if change.get("is_new_ingredient"):
                # Add new ingredient with proper database ingredient_id
                new_ingredient_data = change.get("new_ingredient_data", {})
                ingredient_name = new_ingredient_data.get("name")

                # Look up ingredient in database to get proper ingredient_id
                ingredient_id = None
                if ingredient_name:
                    try:
                        # Try to find the ingredient in the database by name
                        from models.mongo_models import Ingredient

                        db_ingredient = Ingredient.objects(
                            name__icontains=ingredient_name
                        ).first()
                        if db_ingredient:
                            ingredient_id = str(db_ingredient.id)
                    except Exception as e:
                        logger.error(
                            f"Error looking up ingredient {ingredient_name}: {str(e)}"
                        )

                new_ingredient = new_ingredient_data.copy()
                new_ingredient.update(
                    {
                        "ingredient_id": ingredient_id,  # Add proper database ingredient_id
                        "amount": change.get("suggested_value"),
                        "unit": change.get("unit", "g"),  # Default to grams for metric
                    }
                )
                # Add new ingredient to recipe
                modified_ingredients.append(new_ingredient)
            else:
                # Modify existing ingredient
                ingredient_id = change.get("ingredient_id")
                field = change.get("field")
                new_value = change.get("suggested_value")

                found = False
                # Try to find ingredient by exact ingredient_id match first
                for ing in modified_ingredients:
                    if ing.get("ingredient_id") == ingredient_id:
                        old_value = ing.get(field)

                        # Special handling for yeast strain changes - replace entire yeast ingredient
                        if (
                            change.get("is_yeast_strain_change")
                            and field == "ingredient_id"
                        ):
                            new_yeast_data = change.get("new_yeast_data")
                            if new_yeast_data:
                                # Replace the entire yeast ingredient with database yeast data
                                ing["ingredient_id"] = new_yeast_data.get("id")
                                ing["name"] = new_yeast_data.get("name")
                                ing["attenuation"] = new_yeast_data.get("attenuation")
                                ing["type"] = new_yeast_data.get("type")
                                logger.info(
                                    f"🔍 Replaced yeast ingredient: {old_value} → {new_yeast_data.get('name')} (attenuation: {new_yeast_data.get('attenuation')}%)"
                                )
                            else:
                                # Fallback: just change the field
                                ing[field] = new_value
                        else:
                            # Regular field change
                            ing[field] = new_value
                            logger.info(f"✅ Successfully updated {ing.get('name')}: {field} = {old_value} -> {new_value}")

                        found = True
                        break

                # Enhanced fallback: Try smarter matching when exact ID match fails
                if not found:
                    ingredient_name = change.get("ingredient_name")
                    ingredient_type = change.get("ingredient_type")
                    ingredient_use = change.get("ingredient_use")
                    ingredient_time = change.get("ingredient_time")

                    logger.info(
                        f"🔍 Exact ID match failed for {ingredient_id}, trying smart matching for {ingredient_name}"
                    )
                    logger.info(
                        f"🔍 Change details: type={ingredient_type}, use={ingredient_use}, time={ingredient_time}, field={field}, value={new_value}"
                    )

                    # Try to find by name first (simple case)
                    if ingredient_name:
                        for ing in modified_ingredients:
                            if ing.get("name") == ingredient_name:
                                # For hops, check if we need to disambiguate by use/time
                                if ingredient_type == "hop":
                                    logger.info(
                                        f"🔍 Examining hop match: {ingredient_name} - recipe has use='{ing.get('use')}' time={ing.get('time')}, looking for use='{ingredient_use}' time={ingredient_time}"
                                    )
                                    # Check if this is the right hop addition by use and time
                                    if (
                                        ingredient_use
                                        and ing.get("use") == ingredient_use
                                        and ingredient_time is not None
                                        and ing.get("time") == ingredient_time
                                    ):
                                        logger.info(
                                            f"🔍 Found hop by name+use+time: {ingredient_name} {ingredient_use} {ingredient_time}min"
                                        )
                                        found = True
                                        break
                                    elif (
                                        ingredient_use
                                        and ing.get("use") == ingredient_use
                                    ):
                                        logger.info(
                                            f"🔍 Found hop by name+use: {ingredient_name} {ingredient_use}"
                                        )
                                        found = True
                                        break
                                    elif not ingredient_use and not ingredient_time:
                                        # No specific use/time specified, take first match
                                        logger.info(
                                            f"🔍 Found hop by name only: {ingredient_name}"
                                        )
                                        found = True
                                        break
                                    else:
                                        logger.info(
                                            f"🔍 Hop match rejected: {ingredient_name} - use/time mismatch"
                                        )
                                else:
                                    # Non-hop ingredient, name match is sufficient
                                    logger.info(
                                        f"🔍 Found {ingredient_type} by name: {ingredient_name}"
                                    )
                                    found = True
                                    break

                                if found:
                                    old_value = ing.get(field)

                                    # Special handling for yeast strain changes - replace entire yeast ingredient
                                    if (
                                        change.get("is_yeast_strain_change")
                                        and field == "ingredient_id"
                                    ):
                                        new_yeast_data = change.get("new_yeast_data")
                                        if new_yeast_data:
                                            # Replace the entire yeast ingredient with database yeast data
                                            ing["ingredient_id"] = new_yeast_data.get(
                                                "id"
                                            )
                                            ing["name"] = new_yeast_data.get("name")
                                            ing["attenuation"] = new_yeast_data.get(
                                                "attenuation"
                                            )
                                            ing["type"] = new_yeast_data.get("type")
                                            logger.info(
                                                f"🔍 Replaced yeast ingredient (found by name): {old_value} → {new_yeast_data.get('name')} (attenuation: {new_yeast_data.get('attenuation')}%)"
                                            )
                                        else:
                                            # Fallback: just change the field
                                            ing[field] = new_value
                                    else:
                                        # Regular field change
                                        ing[field] = new_value
                                        logger.info(f"✅ Successfully updated (by name) {ing.get('name')}: {field} = {old_value} -> {new_value}")

                                    found = True
                                    break

                if not found:
                    logger.warning(
                        f"⚠️ Could not find ingredient with id {ingredient_id} or name {change.get('ingredient_name')} to modify"
                    )
                    logger.warning(f"⚠️ Change details: {change}")
                    logger.warning(f"⚠️ Available ingredient names: {[ing.get('name') for ing in modified_ingredients]}")
                    logger.warning(f"⚠️ Available ingredient IDs: {[ing.get('ingredient_id') for ing in modified_ingredients]}")

        modified_recipe["ingredients"] = modified_ingredients
        return modified_recipe

    def _calculate_metrics(self, recipe_data: Dict) -> Dict:
        """Calculate recipe metrics using existing calculation functions"""
        return {
            "og": calculate_og_preview(recipe_data),
            "fg": calculate_fg_preview(recipe_data),
            "abv": calculate_abv_preview(recipe_data),
            "ibu": calculate_ibu_preview(recipe_data),
            "srm": calculate_srm_preview(recipe_data),
        }
