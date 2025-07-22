"""
Recipe Analysis Engine

Main orchestrator for comprehensive recipe analysis and optimization.
Coordinates between style compliance analysis, suggestion generation, and effects calculation.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId

from models.mongo_models import BeerStyleGuide, Ingredient
from utils.brewing_calculation_core import (
    calc_abv_core,
    calc_fg_core,
    calc_ibu_core,
    calc_og_core,
    calc_srm_core,
    convert_to_ounces,
    convert_to_pounds,
)
from utils.recipe_api_calculator import (
    calculate_abv_preview,
    calculate_fg_preview,
    calculate_ibu_preview,
    calculate_og_preview,
    calculate_srm_preview,
)
from utils.unit_conversions import UnitConverter

from .cascading_effects_calculator import CascadingEffectsCalculator
from .style_compliance_analyzer import StyleComplianceAnalyzer
from .suggestion_generator import SuggestionGenerator

logger = logging.getLogger(__name__)


class RecipeAnalysisEngine:
    """Main engine for comprehensive recipe analysis and optimization"""

    def __init__(self):
        self.style_analyzer = StyleComplianceAnalyzer()
        self.suggestion_generator = SuggestionGenerator(self)
        self.effects_calculator = CascadingEffectsCalculator()
        # Cache for ingredient lookups
        self._ingredient_cache = None

    def _get_all_ingredients(self) -> List[Dict]:
        """Get all ingredients from database with caching"""
        if self._ingredient_cache is None:
            try:
                ingredients = Ingredient.objects()
                self._ingredient_cache = [
                    {
                        "id": str(ing.id),
                        "name": ing.name,
                        "type": ing.type,
                        "description": ing.description,
                        "color": ing.color,
                        "grain_type": ing.grain_type,
                        "potential": ing.potential,
                        "alpha_acid": ing.alpha_acid,
                        "attenuation": ing.attenuation,
                    }
                    for ing in ingredients
                ]
            except Exception as e:
                logger.error(f"Failed to fetch ingredients: {e}")
                self._ingredient_cache = []

        return self._ingredient_cache

    def _find_darkest_roasted_grain(self) -> Optional[Dict]:
        """Find the darkest roasted grain for color adjustment"""
        ingredients = self._get_all_ingredients()
        roasted_grains = [
            ing
            for ing in ingredients
            if ing.get("type") == "grain"
            and ing.get("grain_type") == "roasted"
            and ing.get("color") is not None
        ]

        if not roasted_grains:
            return None

        # Return the grain with highest color value
        darkest = max(roasted_grains, key=lambda x: x.get("color", 0))
        return darkest

    def _find_darkest_base_malt(self) -> Optional[Dict]:
        """Find the darkest base malt for color and gravity adjustment"""
        ingredients = self._get_all_ingredients()
        base_malts = [
            ing
            for ing in ingredients
            if ing.get("type") == "grain"
            and ing.get("grain_type") == "base_malt"
            and ing.get("color") is not None
        ]

        if not base_malts:
            return None

        # Return the base malt with highest color value
        darkest = max(base_malts, key=lambda x: x.get("color", 0))
        return darkest

    def _find_caramel_crystal_grains(self) -> List[Dict]:
        """Get all caramel/crystal grains sorted by color (Lovibond)"""
        ingredients = self._get_all_ingredients()
        caramel_crystal_grains = [
            ing
            for ing in ingredients
            if ing.get("type") == "grain"
            and ing.get("grain_type") == "caramel_crystal"
            and ing.get("color") is not None
        ]

        # Sort by color value (Lovibond) for easy selection
        caramel_crystal_grains.sort(key=lambda x: x.get("color", 0))
        return caramel_crystal_grains

    def _find_existing_caramel_crystal_in_recipe(
        self, recipe_data: Dict
    ) -> Optional[Dict]:
        """Find existing caramel/crystal grain in recipe"""
        ingredients = recipe_data.get("ingredients", [])

        # Get all caramel/crystal grains from database for reference
        caramel_crystal_grains = self._find_caramel_crystal_grains()
        caramel_crystal_ids = {
            grain["ingredient_id"] for grain in caramel_crystal_grains
        }

        # Find first caramel/crystal grain in recipe
        for ingredient in ingredients:
            if ingredient.get("ingredient_id") in caramel_crystal_ids:
                # Return the ingredient with database info merged
                db_grain = next(
                    (
                        grain
                        for grain in caramel_crystal_grains
                        if grain["ingredient_id"] == ingredient["ingredient_id"]
                    ),
                    None,
                )
                if db_grain:
                    # Merge recipe amount with database properties
                    return {
                        **db_grain,
                        "recipe_amount": ingredient.get("amount", 0),
                        "recipe_unit": ingredient.get("unit", "g"),
                        "recipe_use": ingredient.get("use", "mash"),
                        "recipe_ingredient": ingredient,  # Keep original for modifications
                    }

        return None

    def _find_best_caramel_crystal_substitute(
        self, current_grain: Dict, target_lovibond_delta: float
    ) -> Optional[Dict]:
        """Find optimal caramel/crystal substitute for SRM adjustment"""
        caramel_crystal_grains = self._find_caramel_crystal_grains()

        if not caramel_crystal_grains:
            return None

        current_color = current_grain.get("color", 0)
        target_color = current_color + target_lovibond_delta

        # Find grain with color closest to target
        best_substitute = None
        best_color_diff = float("inf")

        for grain in caramel_crystal_grains:
            grain_color = grain.get("color", 0)

            # Skip if it's the same grain
            if grain.get("ingredient_id") == current_grain.get("ingredient_id"):
                continue

            # Calculate color difference from target
            color_diff = abs(grain_color - target_color)

            # Prefer grains with similar potential (within 2 points)
            current_potential = current_grain.get("potential", 1.035)
            grain_potential = grain.get("potential", 1.035)
            potential_diff = abs(grain_potential - current_potential)

            # Penalize grains with very different potentials
            if potential_diff > 0.002:  # More than 2 points potential difference
                color_diff += potential_diff * 100  # Heavy penalty

            # Update best if this is closer to target
            if color_diff < best_color_diff:
                best_color_diff = color_diff
                best_substitute = grain

        return best_substitute

    def _prepare_grain_data_for_srm(
        self, recipe_data: Dict
    ) -> Tuple[List[Tuple], float]:
        """Extract grain colors and batch size for SRM calculation using Morey's method"""
        ingredients = recipe_data.get("ingredients", [])
        grain_colors = []

        # Extract grain data for SRM calculation
        for ing in ingredients:
            if ing.get("type") == "grain":
                # Convert grain weight to pounds
                amount = ing.get("amount", 0)
                unit = ing.get("unit", "g")
                weight_lb = convert_to_pounds(amount, unit)

                # Get grain color (Lovibond)
                color = ing.get("color", 0)

                # Add to grain colors list
                grain_colors.append((weight_lb, color))

        # Get batch size and convert to gallons
        batch_size = float(recipe_data.get("batch_size", 5))
        batch_size_unit = recipe_data.get("batch_size_unit", "gal")

        from utils.unit_conversions import UnitConverter

        batch_size_gal = UnitConverter.convert_volume(
            batch_size, batch_size_unit, "gal"
        )

        return grain_colors, batch_size_gal

    def _apply_final_brewing_increments_rounding(self, recipe_data: Dict, unit_system: str) -> Dict:
        """Apply final rounding to brewing increments for all ingredients in optimized recipe"""
        rounded_recipe = recipe_data.copy()
        rounded_ingredients = []
        
        for ingredient in recipe_data.get("ingredients", []):
            rounded_ingredient = ingredient.copy()
            
            # Round amount to brewing increments using standard UnitConverter logic
            current_amount = ingredient.get("amount", 0)
            ingredient_type = ingredient.get("type", "grain")
            
            # Apply standard brewing precision rounding for final result
            rounded_amount = UnitConverter.round_to_brewing_precision(
                current_amount, ingredient_type, unit_system
            )
            
            # Update the ingredient with rounded amount
            rounded_ingredient["amount"] = rounded_amount
            rounded_ingredients.append(rounded_ingredient)
            
            logger.info(f"🔄 Final rounding: {ingredient.get('name')} {current_amount:.1f} → {rounded_amount}")
        
        rounded_recipe["ingredients"] = rounded_ingredients
        return rounded_recipe

    def _calculate_accurate_srm_impact(
        self, recipe_data: Dict, old_grain: Dict, new_grain: Dict
    ) -> float:
        """Calculate accurate SRM impact using Morey's method for grain substitution"""
        try:
            # Get current grain data and batch size
            grain_colors, batch_size_gal = self._prepare_grain_data_for_srm(recipe_data)

            # Calculate current SRM
            current_srm = calc_srm_core(grain_colors, batch_size_gal)

            # Create modified grain colors list with substitution
            modified_grain_colors = []
            old_grain_id = old_grain["ingredient_id"]
            substitution_made = False

            for ing in recipe_data.get("ingredients", []):
                if ing.get("type") == "grain":
                    # Convert grain weight to pounds
                    amount = ing.get("amount", 0)
                    unit = ing.get("unit", "g")
                    weight_lb = convert_to_pounds(amount, unit)

                    # Check if this is the grain being substituted
                    if ing.get("ingredient_id") == old_grain_id:
                        # Use new grain color instead
                        color = new_grain.get("color", 0)
                        substitution_made = True
                    else:
                        # Use original grain color
                        color = ing.get("color", 0)

                    modified_grain_colors.append((weight_lb, color))

            # Calculate new SRM with substitution
            if substitution_made:
                new_srm = calc_srm_core(modified_grain_colors, batch_size_gal)
                srm_impact = new_srm - current_srm
                return round(srm_impact, 2)
            else:
                # Fallback if substitution couldn't be made
                return 0.0

        except Exception as e:
            logger.error(f"Error calculating accurate SRM impact: {str(e)}")
            # Fallback to rough approximation
            old_color = old_grain.get("color", 0)
            new_color = new_grain.get("color", 0)
            lovibond_delta = new_color - old_color
            return lovibond_delta * 0.1

    def _create_caramel_crystal_substitution_suggestion(
        self,
        old_grain: Dict,
        new_grain: Dict,
        amount: float,
        unit: str,
        recipe_data: Dict = None,
    ) -> Dict:
        """Create caramel/crystal substitution suggestion with accurate SRM impact using Morey's method"""
        old_color = old_grain.get("color", 0)
        new_color = new_grain.get("color", 0)
        lovibond_delta = new_color - old_color

        # Calculate accurate SRM impact using Morey's method
        if recipe_data:
            estimated_srm_impact = self._calculate_accurate_srm_impact(
                recipe_data, old_grain, new_grain
            )
        else:
            # Fallback to rough approximation if no recipe data
            estimated_srm_impact = lovibond_delta * 0.1

        return {
            "ingredient_id": old_grain["recipe_ingredient"][
                "id"
            ],  # Recipe ingredient ID
            "ingredient_name": old_grain["recipe_ingredient"]["name"],  # Current name
            "field": "ingredient_id",  # We're changing the ingredient itself
            "current_value": old_grain["ingredient_id"],  # Current ingredient DB ID
            "suggested_value": new_grain["ingredient_id"],  # New ingredient DB ID
            "unit": unit,
            "action": "substitute_ingredient",
            "is_caramel_crystal_substitution": True,
            "substitution_data": {
                "old_ingredient": {
                    "name": old_grain["name"],
                    "color": old_color,
                    "potential": old_grain.get("potential", 1.035),
                },
                "new_ingredient": {
                    "name": new_grain["name"],
                    "color": new_color,
                    "potential": new_grain.get("potential", 1.035),
                },
                "lovibond_delta": lovibond_delta,
                "estimated_srm_impact": estimated_srm_impact,
                "amount": amount,
                "unit": unit,
            },
            "reason": f"Substitute {old_grain['name']} ({old_color}°L) with {new_grain['name']} ({new_color}°L) to adjust beer color by approximately {estimated_srm_impact:+.1f} SRM points while maintaining similar fermentability",
        }

    def analyze_recipe(
        self,
        recipe_data: Dict,
        style_id: Optional[str] = None,
        unit_system: str = "imperial",
    ) -> Dict:
        """
        Perform comprehensive recipe analysis

        Args:
            recipe_data: Recipe data including ingredients, batch size, etc.
            style_id: Optional BJCP style ID for style compliance analysis
            unit_system: 'metric' or 'imperial' for user preferences

        Returns:
            Complete analysis including compliance, suggestions, and predicted effects
        """
        try:
            # Use enhanced iterative optimization system
            return self._optimize_recipe_internally(recipe_data, style_id, unit_system)

        except Exception as e:
            logger.error(f"⚠️ Iterative optimization failed: {str(e)}")
            # Fallback to single-pass if iterative fails
            return self.analyze_recipe_single_pass(recipe_data, style_id, unit_system)

    def _optimize_recipe_internally(
        self,
        recipe_data: Dict,
        style_id: Optional[str] = None,
        unit_system: str = "imperial",
        max_iterations: int = 200,  # Increased from 50 to 200 for aggressive optimization
    ) -> Dict:
        """
        Internal iterative optimization system that automatically applies suggestions
        until the recipe is FULLY COMPLIANT with ALL style metrics.
        Will continue iterating until complete compliance is achieved.
        """

        current_recipe = recipe_data.copy()
        optimization_history = []
        applied_suggestion_fingerprints = (
            set()
        )  # Track applied suggestions to prevent loops
        previous_metrics = None  # Track metric improvements
        stagnation_counter = 0  # Track iterations without progress to prevent infinite loops

        logger.info(f"🚀 Starting aggressive optimization - will iterate until ALL metrics are in spec (max {max_iterations} iterations)")

        for iteration in range(max_iterations):

            # Calculate current metrics
            current_metrics = self._calculate_recipe_metrics(current_recipe)

            # Style compliance analysis
            style_analysis = None
            if style_id:
                style_guide = BeerStyleGuide.objects(id=ObjectId(style_id)).first()
                if style_guide:
                    style_analysis = self.style_analyzer.analyze_compliance(
                        current_metrics, style_guide
                    )

            # Add current metrics to recipe data for advanced strategies
            enriched_recipe_data = current_recipe.copy()
            enriched_recipe_data["current_metrics"] = current_metrics
            enriched_recipe_data["style_analysis"] = style_analysis

            # Use more aggressive optimization stages
            if iteration >= max_iterations - 10:
                optimization_stage = "final"
            elif iteration >= max_iterations - 50:
                optimization_stage = "aggressive" 
            else:
                optimization_stage = "initial"
            
            # Generate suggestions
            suggestions = self.suggestion_generator.generate_suggestions(
                enriched_recipe_data, current_metrics, style_analysis, unit_system, optimization_stage
            )

            # ONLY STOP if recipe is FULLY COMPLIANT - no other early exits
            if self._is_recipe_fully_compliant(style_analysis, current_recipe):
                logger.info(
                    f"🎯 SUCCESS! Recipe is FULLY COMPLIANT after {iteration + 1} iterations"
                )
                break

            # Check for no suggestions available
            if not suggestions:
                # Reset fingerprints and try again with different stage to break deadlocks
                if stagnation_counter < 3:
                    stagnation_counter += 1
                    applied_suggestion_fingerprints.clear()  # Reset to allow re-trying suggestions
                    logger.info(f"🔄 No suggestions found, clearing suggestion history (attempt {stagnation_counter}/3)")
                    
                    # Try with final optimization stage if not already
                    if optimization_stage != "final":
                        final_suggestions = self.suggestion_generator.generate_suggestions(
                            enriched_recipe_data, current_metrics, style_analysis, unit_system, "final"
                        )
                        if final_suggestions:
                            suggestions = final_suggestions
                            logger.info(f"🎯 Final stage found {len(suggestions)} additional optimizations")
                    
                    if not suggestions:
                        continue  # Try next iteration with reset fingerprints
                else:
                    # We've tried multiple times - recipe may be at optimization limit
                    compliance_info = self._get_compliance_status(style_analysis)
                    logger.warning(
                        f"⚠️ Optimization stopped after {iteration + 1} iterations - no more suggestions available"
                    )
                    logger.warning(f"⚠️ Current compliance status: {compliance_info}")
                    break

            # Reset stagnation counter when we have suggestions
            stagnation_counter = 0

            # Apply the most important suggestion internally
            best_suggestion = self._select_best_suggestion_for_internal_optimization(
                suggestions, applied_suggestion_fingerprints
            )
            if best_suggestion:
                logger.info(
                    f"🔄 Iteration {iteration + 1} - Applying suggestion: {best_suggestion.get('title')}"
                )

                # Create suggestion fingerprint to prevent re-applying same suggestion
                suggestion_fingerprint = self._create_suggestion_fingerprint(
                    best_suggestion
                )
                applied_suggestion_fingerprints.add(suggestion_fingerprint)

                # Apply the suggestion to the recipe with error handling
                try:
                    updated_recipe = self._apply_suggestion_to_recipe(
                        current_recipe, best_suggestion
                    )

                    # Validate that the recipe was actually modified
                    if updated_recipe == current_recipe:
                        logger.warning(
                            f"🔄 Iteration {iteration + 1} - Recipe unchanged after applying suggestion"
                        )
                        # Don't break - try other suggestions or continue with reset fingerprints
                        continue

                except Exception as e:
                    logger.error(
                        f"🔄 Iteration {iteration + 1} - Error applying suggestion: {str(e)}"
                    )
                    logger.error(f"🔄 Suggestion details: {best_suggestion}")
                    # Don't break - try other suggestions
                    continue

                # Store the optimization step
                metrics_after = self._calculate_recipe_metrics(updated_recipe)
                optimization_history.append(
                    {
                        "iteration": iteration + 1,
                        "applied_suggestion": best_suggestion,
                        "metrics_before": current_metrics,
                        "metrics_after": metrics_after,
                    }
                )

                # Update for next iteration
                previous_metrics = current_metrics
                current_recipe = updated_recipe
            else:
                logger.info(
                    f"🛑 Iteration {iteration + 1} - No suitable suggestion found, stopping optimization loop"
                )
                break

        # Generate final analysis
        original_metrics = self._calculate_recipe_metrics(
            recipe_data
        )  # Original metrics
        final_metrics = self._calculate_recipe_metrics(
            current_recipe
        )  # Optimized metrics

        # Final style compliance analysis
        final_style_analysis = None
        if style_id:
            style_guide = BeerStyleGuide.objects(id=ObjectId(style_id)).first()
            if style_guide:
                final_style_analysis = self.style_analyzer.analyze_compliance(
                    final_metrics, style_guide
                )

        # Generate recipe transformation summary
        recipe_changes = self._generate_recipe_transformation_summary(
            recipe_data, current_recipe, optimization_history
        )

        # Check if significant optimization occurred
        optimization_occurred = len(optimization_history) > 0

        if optimization_occurred:
            logger.info(
                f"🎯 Optimization completed after {len(optimization_history)} iterations"
            )
            # Generate minimal remaining suggestions (should be few or none after optimization)
            enriched_final_recipe = current_recipe.copy()
            enriched_final_recipe["current_metrics"] = final_metrics
            enriched_final_recipe["style_analysis"] = final_style_analysis

            remaining_suggestions = self.suggestion_generator.generate_suggestions(
                enriched_final_recipe, final_metrics, final_style_analysis, unit_system
            )

            # Calculate predicted effects for remaining suggestions
            for suggestion in remaining_suggestions:
                suggestion["predicted_effects"] = (
                    self.effects_calculator.calculate_effects(
                        enriched_final_recipe, suggestion.get("changes", [])
                    )
                )

            # Apply final rounding to brewing increments for optimized recipe
            final_rounded_recipe = self._apply_final_brewing_increments_rounding(current_recipe, unit_system)

            return {
                "original_metrics": original_metrics,
                "optimized_metrics": final_metrics,
                "optimized_recipe": final_rounded_recipe,  # Complete optimized recipe with final rounding
                "recipe_changes": recipe_changes,  # Summary of all changes
                "style_analysis": final_style_analysis,
                "suggestions": remaining_suggestions,  # Should be minimal
                "optimization_history": optimization_history,
                "iterations_completed": len(optimization_history),
                "optimization_performed": True,
                "analysis_timestamp": "2024-01-01T00:00:00Z",
            }
        else:
            # No optimization occurred - fallback to original behavior
            logger.info(
                "🔄 No internal optimization needed - returning original analysis"
            )

            # Generate suggestions for manual application
            enriched_recipe = recipe_data.copy()
            enriched_recipe["current_metrics"] = original_metrics
            enriched_recipe["style_analysis"] = final_style_analysis

            manual_suggestions = self.suggestion_generator.generate_suggestions(
                enriched_recipe, original_metrics, final_style_analysis, unit_system
            )

            # Calculate predicted effects for manual suggestions
            for suggestion in manual_suggestions:
                suggestion["predicted_effects"] = (
                    self.effects_calculator.calculate_effects(
                        enriched_recipe, suggestion.get("changes", [])
                    )
                )

            return {
                "current_metrics": original_metrics,
                "style_analysis": final_style_analysis,
                "suggestions": manual_suggestions,
                "optimization_history": [],
                "iterations_completed": 0,
                "optimization_performed": False,
                "analysis_timestamp": "2024-01-01T00:00:00Z",
            }

    def _is_recipe_fully_compliant(
        self, style_analysis: Optional[Dict], recipe_data: Dict
    ) -> bool:
        """Check if recipe is fully compliant with style guidelines and brewing standards"""
        if not style_analysis:
            return False

        compliance = style_analysis.get("compliance", {})

        # Check if all metrics are in range or very close (allow small deviations)
        for metric, data in compliance.items():
            if not data.get("in_range", False):
                deviation = data.get("deviation", 0)
                # Allow small deviations that are within brewing tolerances
                if metric == "og" and deviation > 0.003:  # 0.003 OG points
                    return False
                elif metric == "fg" and deviation > 0.003:  # 0.003 FG points
                    return False
                elif metric == "abv" and deviation > 0.15:  # 0.15% ABV
                    return False
                elif metric == "ibu" and deviation > 1.5:  # 1.5 IBU
                    return False
                elif metric == "srm" and deviation > 1.0:  # 1.0 SRM
                    return False

        # Check base malt percentage (must be >= 55%)
        base_malt_percentage = (
            self.suggestion_generator._calculate_base_malt_percentage(recipe_data)
        )
        if base_malt_percentage < 55:
            return False

        return True

    def _is_recipe_reasonably_compliant(self, style_analysis: Optional[Dict]) -> bool:
        """Check if recipe is reasonably compliant (most metrics in range)"""
        if not style_analysis:
            return False
        compliance = style_analysis.get("compliance", {})
        in_range_count = 0
        total_count = 0

        for metric, data in compliance.items():
            total_count += 1
            if data.get("in_range", False):
                in_range_count += 1

        # Consider reasonably compliant if at least 80% of metrics are in range
        return (in_range_count / total_count) >= 0.8 if total_count > 0 else False

    def _generate_recipe_transformation_summary(
        self,
        original_recipe: Dict,
        optimized_recipe: Dict,
        optimization_history: List[Dict],
    ) -> List[Dict]:
        """Generate a summary of all changes made during internal optimization"""
        recipe_changes = []

        # Track ingredient changes by comparing original and optimized recipes
        original_ingredients = {
            ing.get("ingredient_id"): ing
            for ing in original_recipe.get("ingredients", [])
        }
        optimized_ingredients = {
            ing.get("ingredient_id"): ing
            for ing in optimized_recipe.get("ingredients", [])
        }

        # Find modified ingredients and consolidate multiple changes per ingredient
        for ing_id, optimized_ing in optimized_ingredients.items():
            if ing_id in original_ingredients:
                original_ing = original_ingredients[ing_id]

                # Collect all changes for this ingredient
                ingredient_changes = []

                # Check for amount changes
                if original_ing.get("amount") != optimized_ing.get("amount"):
                    ingredient_changes.append(
                        {
                            "field": "amount",
                            "original_value": original_ing.get("amount"),
                            "optimized_value": optimized_ing.get("amount"),
                            "unit": optimized_ing.get("unit"),
                            "change_reason": "Recipe optimization to meet style guidelines",
                        }
                    )

                # Check for time changes (hops)
                if original_ing.get("time") != optimized_ing.get("time"):
                    ingredient_changes.append(
                        {
                            "field": "time",
                            "original_value": original_ing.get("time"),
                            "optimized_value": optimized_ing.get("time"),
                            "unit": "min",
                            "change_reason": "Hop timing optimization for better brewing practice",
                        }
                    )

                # If there are multiple changes to the same ingredient, consolidate them
                if len(ingredient_changes) > 1:
                    # Create a consolidated change with multiple fields
                    consolidated_change = {
                        "type": "ingredient_modified",
                        "ingredient_name": optimized_ing.get("name"),
                        "ingredient_id": ing_id,
                        "ingredient_type": optimized_ing.get("type"),
                        "ingredient_use": optimized_ing.get("use"),
                        "ingredient_time": original_ing.get(
                            "time"
                        ),  # Use original time for matching
                        "changes": ingredient_changes,  # Multiple field changes
                        "change_reason": f"Multiple optimizations: {', '.join([c['change_reason'] for c in ingredient_changes])}",
                    }
                    recipe_changes.append(consolidated_change)
                elif len(ingredient_changes) == 1:
                    # Single change, create individual change object
                    single_change = ingredient_changes[0]
                    change_obj = {
                        "type": "ingredient_modified",
                        "ingredient_name": optimized_ing.get("name"),
                        "ingredient_id": ing_id,
                        "ingredient_type": optimized_ing.get("type"),
                        "ingredient_use": optimized_ing.get("use"),
                        "ingredient_time": original_ing.get(
                            "time"
                        ),  # Use original time for matching
                        "field": single_change["field"],
                        "original_value": single_change["original_value"],
                        "optimized_value": single_change["optimized_value"],
                        "unit": single_change["unit"],
                        "change_reason": single_change["change_reason"],
                    }
                    recipe_changes.append(change_obj)

                # Check for ingredient substitutions (yeast changes)
                if original_ing.get("name") != optimized_ing.get("name"):
                    recipe_changes.append(
                        {
                            "type": "ingredient_substituted",
                            "original_ingredient": original_ing.get("name"),
                            "optimized_ingredient": optimized_ing.get("name"),
                            "ingredient_type": optimized_ing.get("type"),
                            "change_reason": "Style-appropriate ingredient substitution",
                        }
                    )
            else:
                # New ingredient added during optimization
                recipe_changes.append(
                    {
                        "type": "ingredient_added",
                        "ingredient_name": optimized_ing.get("name"),
                        "amount": optimized_ing.get("amount"),
                        "unit": optimized_ing.get("unit"),
                        "ingredient_type": optimized_ing.get("type"),
                        "change_reason": "Added to meet style requirements",
                    }
                )

        # Find removed ingredients
        for ing_id, original_ing in original_ingredients.items():
            if ing_id not in optimized_ingredients:
                recipe_changes.append(
                    {
                        "type": "ingredient_removed",
                        "ingredient_name": original_ing.get("name"),
                        "amount": original_ing.get("amount"),
                        "unit": original_ing.get("unit"),
                        "ingredient_type": original_ing.get("type"),
                        "change_reason": "Removed during recipe optimization",
                    }
                )

        # Add summary from optimization history
        if optimization_history:
            recipe_changes.append(
                {
                    "type": "optimization_summary",
                    "iterations_completed": len(optimization_history),
                    "total_changes": sum(
                        len(hist.get("applied_changes", []))
                        for hist in optimization_history
                    ),
                    "final_compliance": "Recipe optimized to meet style guidelines",
                    "change_reason": f"Internal optimization completed in {len(optimization_history)} iterations",
                }
            )

        return recipe_changes

    def _select_best_suggestion_for_internal_optimization(
        self, suggestions: List[Dict], applied_fingerprints: set = None
    ) -> Optional[Dict]:
        """Select the best suggestion for internal optimization based on priority and impact"""
        if not suggestions:
            return None

        # Filter out already applied suggestions to prevent loops
        if applied_fingerprints:
            filtered_suggestions = []
            for suggestion in suggestions:
                fingerprint = self._create_suggestion_fingerprint(suggestion)
                if fingerprint not in applied_fingerprints:
                    filtered_suggestions.append(suggestion)
            suggestions = filtered_suggestions

        if not suggestions:
            return None

        # Sort by priority (higher priority first)
        suggestions.sort(key=lambda x: x.get("priority", 0), reverse=True)

        # Return the highest priority suggestion
        return suggestions[0]

    def _create_suggestion_fingerprint(self, suggestion: Dict) -> str:
        """Create a fingerprint for a suggestion to detect duplicates"""
        # Create a unique identifier based on suggestion type and target changes
        suggestion_type = suggestion.get("type", "unknown")
        changes = suggestion.get("changes", [])

        # Create fingerprint from key suggestion characteristics including values
        fingerprint_parts = [suggestion_type]
        for change in changes:
            ingredient_name = change.get("ingredient_name", "")
            field = change.get("field", "")
            current_value = change.get("current_value", "")
            suggested_value = change.get("suggested_value", "")
            # Include values in fingerprint to allow multiple adjustments to same ingredient
            fingerprint_parts.append(
                f"{ingredient_name}:{field}:{current_value}→{suggested_value}"
            )

        return "|".join(fingerprint_parts)

    def _calculate_metric_improvement(
        self, previous_metrics: Dict, current_metrics: Dict
    ) -> float:
        """Calculate the percentage improvement in metrics between iterations"""
        if not previous_metrics or not current_metrics:
            return 100.0  # First iteration has 100% improvement

        # Track key metrics that matter for optimization
        key_metrics = ["og", "fg", "abv", "ibu", "srm"]
        total_improvement = 0.0
        metric_count = 0

        for metric in key_metrics:
            prev_val = previous_metrics.get(metric, 0)
            curr_val = current_metrics.get(metric, 0)

            if prev_val > 0:  # Avoid division by zero
                improvement = abs(curr_val - prev_val) / prev_val * 100
                total_improvement += improvement
                metric_count += 1

        return total_improvement / metric_count if metric_count > 0 else 0.0

    def _apply_suggestion_to_recipe(self, recipe_data: Dict, suggestion: Dict) -> Dict:
        """Apply a suggestion's changes to the recipe data using enhanced cascading effects logic"""
        # Use the enhanced cascading effects logic from the effects calculator
        changes = suggestion.get("changes", [])
        return self.effects_calculator._apply_changes_to_recipe(recipe_data, changes)

    def analyze_recipe_single_pass(
        self,
        recipe_data: Dict,
        style_id: Optional[str] = None,
        unit_system: str = "imperial",
    ) -> Dict:
        """
        Original single-pass analysis (kept for backward compatibility)
        """
        try:
            # Calculate current recipe metrics
            current_metrics = self._calculate_recipe_metrics(recipe_data)

            # Style compliance analysis
            style_analysis = None
            if style_id:
                style_guide = BeerStyleGuide.objects(id=ObjectId(style_id)).first()
                if style_guide:
                    style_analysis = self.style_analyzer.analyze_compliance(
                        current_metrics, style_guide
                    )

            # Generate optimization suggestions
            # logger.info(f"🔍 AI Service - Current metrics: {current_metrics}")

            # Add current metrics to recipe data for advanced strategies
            enriched_recipe_data = recipe_data.copy()
            enriched_recipe_data["current_metrics"] = current_metrics
            enriched_recipe_data["style_analysis"] = style_analysis

            suggestions = self.suggestion_generator.generate_suggestions(
                enriched_recipe_data, current_metrics, style_analysis, unit_system
            )

            # Calculate predicted effects for each suggestion
            for suggestion in suggestions:
                suggestion["predicted_effects"] = (
                    self.effects_calculator.calculate_effects(
                        enriched_recipe_data, suggestion.get("changes", [])
                    )
                )

            return {
                "current_metrics": current_metrics,
                "style_analysis": style_analysis,
                "suggestions": suggestions,
                "analysis_timestamp": "2024-01-01T00:00:00Z",  # Add timestamp
            }

        except Exception as e:
            logger.error(f"Recipe analysis failed: {str(e)}")
            raise Exception(f"Recipe analysis failed: {str(e)}")

    def _calculate_recipe_metrics(self, recipe_data: Dict) -> Dict:
        """Calculate all recipe metrics using existing calculation functions"""

        return {
            "og": calculate_og_preview(recipe_data),
            "fg": calculate_fg_preview(recipe_data),
            "abv": calculate_abv_preview(recipe_data),
            "ibu": calculate_ibu_preview(recipe_data),
            "srm": calculate_srm_preview(recipe_data),
        }

    def _get_compliance_status(self, style_analysis: Optional[Dict]) -> str:
        """Get a readable compliance status summary for logging"""
        if not style_analysis:
            return "No style analysis available"
        
        compliance = style_analysis.get("compliance", {})
        if not compliance:
            return "No compliance data"
        
        total_metrics = len(compliance)
        compliant_metrics = sum(1 for data in compliance.values() if data.get("in_range", False))
        
        status_parts = [f"{compliant_metrics}/{total_metrics} metrics in range"]
        
        # Detail non-compliant metrics
        non_compliant = []
        for metric, data in compliance.items():
            if not data.get("in_range", False):
                current = data.get("current_value", 0)
                style_range = data.get("style_range", {})
                min_val = style_range.get("min", 0)
                max_val = style_range.get("max", 0)
                deviation = data.get("deviation", 0)
                non_compliant.append(f"{metric.upper()}={current:.3f} (need {min_val:.3f}-{max_val:.3f}, off by {deviation:.3f})")
        
        if non_compliant:
            status_parts.append(f"Non-compliant: {', '.join(non_compliant)}")
        
        return "; ".join(status_parts)
