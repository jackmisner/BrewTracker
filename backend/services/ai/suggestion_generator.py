"""
Suggestion Generator

Generates actionable brewing suggestions based on recipe analysis.
Handles ingredient optimization, style compliance corrections, and brewing improvements.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from models.mongo_models import Ingredient
from utils.brewing_calculation_core import (
    convert_to_ounces,
    convert_to_pounds,
)
from utils.unit_conversions import UnitConverter

logger = logging.getLogger(__name__)


class SuggestionGenerator:
    """Generates actionable brewing suggestions based on analysis"""

    def __init__(self, engine):
        """Initialize with reference to the main engine for ingredient lookups"""
        self.engine = engine

    def _find_caramel_crystal_grains(self) -> List[Dict]:
        """Get all caramel/crystal grains sorted by color (Lovibond)"""
        ingredients = self.engine._get_all_ingredients()
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
        caramel_crystal_ids = {grain["id"] for grain in caramel_crystal_grains}

        # Find first caramel/crystal grain in recipe
        for ingredient in ingredients:
            if ingredient.get("ingredient_id") in caramel_crystal_ids:
                # Return the ingredient with database info merged
                db_grain = next(
                    (
                        grain
                        for grain in caramel_crystal_grains
                        if grain["id"] == ingredient["ingredient_id"]
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
            if grain.get("id") == current_grain.get("id"):
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
            old_grain_id = old_grain.get("id")
            if not old_grain_id:
                # Fallback if ingredient_id is not available
                logger.warning("No id found in old_grain for SRM calculation")
                return 0.0
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
        logger.info(f"🔍 Creating caramel/crystal substitution suggestion")
        logger.info(
            f"🔍 old_grain keys: {list(old_grain.keys()) if old_grain else 'None'}"
        )
        logger.info(
            f"🔍 new_grain keys: {list(new_grain.keys()) if new_grain else 'None'}"
        )

        # Validate input parameters
        if not old_grain or not new_grain:
            logger.error("Invalid grain data for caramel/crystal substitution")
            return {}

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

        # Get recipe ingredient info - this should reference the recipe ingredient that needs to be changed
        recipe_ingredient = old_grain.get("recipe_ingredient", {})
        logger.info(
            f"🔍 recipe_ingredient keys: {list(recipe_ingredient.keys()) if recipe_ingredient else 'None'}"
        )

        result = {
            "ingredient_id": recipe_ingredient.get(
                "ingredient_id"
            ),  # Recipe ingredient's DB reference
            "ingredient_name": recipe_ingredient.get(
                "name", old_grain.get("name", "Unknown")
            ),  # Current name
            "field": "ingredient_id",  # We're changing the ingredient itself
            "current_value": recipe_ingredient.get(
                "ingredient_id"
            ),  # Current ingredient DB ID
            "suggested_value": new_grain.get("id"),  # New ingredient DB ID
            "unit": unit,
            "action": "substitute_ingredient",
            "is_caramel_crystal_substitution": True,
            "suggested_name": new_grain.get("name"),  # New grain name
            "new_grain_data": new_grain,  # Include full grain data for replacement
            "substitution_data": {
                "old_ingredient": {
                    "name": old_grain.get("name", "Unknown"),
                    "color": old_color,
                    "potential": old_grain.get("potential", 1.035),
                },
                "new_ingredient": {
                    "name": new_grain.get("name", "Unknown"),
                    "color": new_color,
                    "potential": new_grain.get("potential", 1.035),
                },
                "lovibond_delta": lovibond_delta,
                "estimated_srm_impact": estimated_srm_impact,
                "amount": amount,
                "unit": unit,
            },
            "reason": f"Substitute {old_grain.get('name', 'Unknown')} ({old_color}°L) with {new_grain.get('name', 'Unknown')} ({new_color}°L) to adjust beer color by approximately {estimated_srm_impact:+.1f} SRM points while maintaining similar fermentability",
        }

        logger.info(f"🔍 Created suggestion with keys: {list(result.keys())}")
        return result

    def generate_suggestions(
        self,
        recipe_data: Dict,
        metrics: Dict,
        style_analysis: Optional[Dict],
        unit_system: str,
    ) -> List[Dict]:
        """
        Generate unified brewing suggestions that address multiple metrics cohesively

        Args:
            recipe_data: Complete recipe data
            metrics: Current recipe metrics
            style_analysis: Style compliance analysis results
            unit_system: User's preferred unit system

        Returns:
            List of actionable suggestions with predicted effects
        """
        try:
            # Check if recipe is already compliant
            if self._is_recipe_compliant(style_analysis):
                return [
                    {
                        "type": "recipe_compliant",
                        "title": "Recipe Analysis Complete ✅",
                        "description": "Your recipe metrics are within style guidelines. Recipe looks well-balanced!",
                        "confidence": "high",
                        "changes": [],
                        "priority": 1,
                    }
                ]

            # Generate unified suggestion that addresses multiple metrics
            unified_suggestion = self._generate_unified_suggestion(
                recipe_data, metrics, style_analysis, unit_system
            )

            if unified_suggestion:
                return [unified_suggestion]

            # Fallback: generate individual suggestions if unified approach fails
            return self._generate_individual_suggestions(
                recipe_data, metrics, style_analysis, unit_system
            )

        except Exception as e:
            logger.error(f"Suggestion generation failed: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback

            logger.error(f"Traceback: {traceback.format_exc()}")
            return []

    def _is_recipe_compliant(self, style_analysis: Optional[Dict]) -> bool:
        """Check if recipe is compliant with style guidelines"""
        if not style_analysis or not style_analysis.get("compliance"):
            return False

        compliance = style_analysis["compliance"]

        # Check for any metrics that are out of range
        out_of_range_metrics = []
        for metric, metric_compliance in compliance.items():
            if not metric_compliance.get("in_range", False):
                deviation = metric_compliance.get("deviation", 0)
                out_of_range_metrics.append(
                    {
                        "metric": metric,
                        "deviation": deviation,
                        "current": metric_compliance.get("current_value", 0),
                    }
                )

        # If all metrics are in range, recipe is compliant
        if not out_of_range_metrics:
            return True

        # For close deviations (within 0.1% ABV or equivalent), still consider suggestions needed
        for out_metric in out_of_range_metrics:
            metric = out_metric["metric"]
            deviation = out_metric["deviation"]

            # ABV deviations > 0.1% need correction (0.1% ABV is meaningful in brewing)
            if metric == "abv" and deviation > 0.1:
                return False
            # OG deviations > 0.002 need correction
            elif metric == "og" and deviation > 0.002:
                return False
            # IBU deviations > 1 IBU need correction
            elif metric == "ibu" and deviation > 1.0:
                return False
            # SRM deviations > 0.5 need correction
            elif metric == "srm" and deviation > 0.5:
                return False
            # FG deviations > 0.002 need correction
            elif metric == "fg" and deviation > 0.002:
                return False

        # If all deviations are minor, consider recipe compliant
        return True

    def _generate_unified_suggestion(
        self,
        recipe_data: Dict,
        metrics: Dict,
        style_analysis: Optional[Dict],
        unit_system: str,
    ) -> Optional[Dict]:
        """Generate a single unified suggestion addressing multiple metrics"""
        if not style_analysis or not style_analysis.get("optimization_targets"):
            return None

        targets = style_analysis["optimization_targets"]
        if not targets:
            return None

        # Check for "all metrics at top end" scenario and suggest overall reduction
        overall_reduction_suggestion = self._check_for_overall_reduction_need(
            recipe_data, metrics, style_analysis, unit_system
        )
        if overall_reduction_suggestion:
            return overall_reduction_suggestion

        # Group targets by type and resolve conflicts
        resolved_targets = self._resolve_conflicting_targets(targets)

        # Generate unified changes
        unified_changes = []

        for target in resolved_targets:
            metric = target["metric"]

            if metric == "og":
                changes = self._get_og_adjustment_changes(
                    target, recipe_data, unit_system
                )
            elif metric == "srm":
                changes = self._get_srm_adjustment_changes(
                    target, recipe_data, unit_system
                )
            elif metric == "ibu":
                changes = self._get_ibu_adjustment_changes(
                    target, recipe_data, unit_system
                )
            elif metric == "fg":
                changes = self._get_fg_adjustment_changes(
                    target, recipe_data, unit_system
                )
            else:
                continue

            if changes:
                unified_changes.extend(changes)

        if not unified_changes:
            return None

        # Create unified suggestion
        if len(resolved_targets) <= 2:
            primary_metrics = [t["metric"].upper() for t in resolved_targets]
            title = f"Optimize Recipe for {' & '.join(primary_metrics)}"
        elif len(resolved_targets) == 3:
            primary_metrics = [t["metric"].upper() for t in resolved_targets]
            title = f"Optimize Recipe for {', '.join(primary_metrics[:-1])} & {primary_metrics[-1]}"
        else:
            # For 4+ metrics, use a more general title
            title = (
                f"Comprehensive Recipe Optimization ({len(resolved_targets)} metrics)"
            )

        return {
            "type": "unified_optimization",
            "title": title,
            "description": f"Coordinated adjustments to meet {style_analysis.get('style_name', 'style')} guidelines",
            "confidence": "high",
            "changes": unified_changes,
            "priority": 5,
            "targets_addressed": [t["metric"] for t in resolved_targets],
        }

    def _resolve_conflicting_targets(self, targets: List[Dict]) -> List[Dict]:
        """Resolve conflicts between optimization targets"""
        resolved = []

        # Group targets by type
        og_targets = [t for t in targets if t["metric"] == "og"]
        abv_targets = [t for t in targets if t["metric"] == "abv"]
        other_targets = [t for t in targets if t["metric"] not in ["og", "abv"]]

        # Resolve OG vs ABV conflict - prioritize OG since ABV follows from OG/FG
        if og_targets:
            resolved.append(og_targets[0])  # Take first OG target
        elif abv_targets:
            # Convert ABV target to OG target
            abv_target = abv_targets[0]
            og_target = self._convert_abv_target_to_og(abv_target)
            resolved.append(og_target)

        # Add other targets (FG, IBU, SRM)
        resolved.extend(other_targets)

        # Sort by priority
        resolved.sort(key=lambda x: x.get("priority", 0), reverse=True)

        return resolved  # Include ALL targets for comprehensive 1-cycle optimization

    def _convert_abv_target_to_og(self, abv_target: Dict) -> Dict:
        """Convert ABV optimization target to OG target"""
        abv_diff = abv_target["target_value"] - abv_target["current_value"]
        og_change = abv_diff * 0.007  # Rough conversion

        return {
            "metric": "og",
            "current_value": abv_target.get("current_og", 1.050),
            "target_value": abv_target.get("current_og", 1.050) + og_change,
            "priority": abv_target["priority"],
            "reasoning": f"Adjust OG to achieve target ABV of {abv_target['target_value']:.1f}%",
        }

    def _generate_individual_suggestions(
        self,
        recipe_data: Dict,
        metrics: Dict,
        style_analysis: Optional[Dict],
        unit_system: str,
    ) -> List[Dict]:
        """Fallback: generate individual suggestions (original behavior)"""
        suggestions = []

        # Generate style compliance suggestions
        if style_analysis and style_analysis.get("optimization_targets"):
            for target in style_analysis["optimization_targets"]:
                suggestion = self._generate_metric_suggestion(
                    target, recipe_data, metrics, unit_system
                )
                if suggestion:
                    suggestions.append(suggestion)

        # Generate general improvement suggestions
        general_suggestions = self._generate_general_suggestions(
            recipe_data, metrics, unit_system
        )
        suggestions.extend(general_suggestions)

        # Filter out suggestions with minimal impact
        meaningful_suggestions = self._filter_meaningful_suggestions(suggestions)

        return meaningful_suggestions[:3]  # Limit to top 3 suggestions

    def _generate_metric_suggestion(
        self, target: Dict, recipe_data: Dict, metrics: Dict, unit_system: str
    ) -> Optional[Dict]:
        """Generate a specific suggestion to address a metric target"""
        metric = target["metric"]
        current_value = target["current_value"]
        target_value = target["target_value"]

        if metric == "og":
            return self._suggest_og_adjustment(
                target_value, current_value, recipe_data, unit_system
            )
        elif metric == "srm":
            return self._suggest_srm_adjustment(
                target_value, current_value, recipe_data, unit_system
            )
        elif metric == "ibu":
            return self._suggest_ibu_adjustment(
                target_value, current_value, recipe_data, unit_system
            )
        elif metric == "fg":
            return self._suggest_fg_adjustment(
                target_value, current_value, recipe_data, unit_system
            )
        elif metric == "abv":
            return self._suggest_abv_adjustment(
                target_value, current_value, recipe_data, unit_system
            )

        return None

    def _suggest_og_adjustment(
        self, target_og: float, current_og: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Advanced OG adjustment with multi-strategy decision making"""
        og_difference = target_og - current_og

        # For OG reduction (when current > target), use advanced strategies
        if og_difference < 0:
            return self._suggest_og_reduction(
                target_og, current_og, recipe_data, unit_system
            )

        # For OG increase (when current < target), use traditional base malt increases
        return self._suggest_og_increase(
            target_og, current_og, recipe_data, unit_system
        )

    def _suggest_og_reduction(
        self, target_og: float, current_og: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Advanced OG/ABV reduction using multiple brewing strategies"""
        og_reduction_needed = current_og - target_og
        current_srm = recipe_data.get("current_metrics", {}).get("srm", 0)
        target_srm_info = self._get_target_srm_from_style(recipe_data)

        # Strategy selection decision tree
        strategy = self._select_og_reduction_strategy(
            og_reduction_needed, current_srm, target_srm_info, recipe_data, unit_system
        )

        if strategy == "high_impact_color_grains":
            return self._apply_high_impact_color_grain_strategy(
                og_reduction_needed,
                current_srm,
                target_srm_info,
                recipe_data,
                unit_system,
            )
        elif strategy == "base_malt_ratio_adjustment":
            return self._apply_base_malt_ratio_strategy(
                og_reduction_needed, recipe_data, unit_system
            )
        elif strategy == "combined_approach":
            return self._apply_combined_reduction_strategy(
                og_reduction_needed,
                current_srm,
                target_srm_info,
                recipe_data,
                unit_system,
            )
        else:
            # Fallback to traditional base malt reduction
            return self._apply_traditional_base_malt_reduction(
                target_og, current_og, recipe_data, unit_system
            )

    def _suggest_og_increase(
        self, target_og: float, current_og: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Traditional OG increase via base malt adjustments"""
        og_difference = target_og - current_og

        # Find base malts
        base_malts = [
            ing
            for ing in recipe_data.get("ingredients", [])
            if ing.get("type") == "grain" and ing.get("grain_type") == "base_malt"
        ]

        logger.info(
            f"🔍 ABV Increase: Target OG {target_og:.3f}, found {len(base_malts)} base malts"
        )

        if not base_malts:
            logger.warning("🔍 ABV Increase: No base malts found - cannot increase OG")
            return None

        changes = []

        # Distribute OG adjustment across base malts proportionally
        total_base_weight = sum(
            convert_to_pounds(ing.get("amount", 0), ing.get("unit", "lb"))
            for ing in base_malts
        )

        # Determine multiplier for small vs large OG changes
        multiplier = 25 if og_difference < 0.010 else 10
        logger.info(
            f"🔍 ABV Increase: Total base weight {total_base_weight:.2f}lbs, OG increase needed: {og_difference:.3f} (using {multiplier}x multiplier)"
        )

        for malt in base_malts:
            current_amount = malt.get("amount", 0)
            current_unit = malt.get("unit", "g")

            # Convert to base unit for the user's system
            current_amount_base, base_unit = self._convert_to_base_unit(
                current_amount, current_unit, unit_system
            )

            # Convert to pounds for brewing calculations
            if unit_system == "metric":
                current_weight_lb = current_amount_base / 453.592  # grams to pounds
            else:
                current_weight_lb = current_amount_base / 16  # ounces to pounds

            proportion = (
                current_weight_lb / total_base_weight if total_base_weight > 0 else 0
            )

            # Calculate needed adjustment using the determined multiplier
            adjustment_lb = (og_difference * multiplier) * proportion
            # Use minimum viable amount to prevent unintended ingredient removal
            minimum_viable = self._get_minimum_viable_amount("grain", unit_system)
            minimum_viable_lb = (
                minimum_viable / 453.592
                if unit_system == "metric"
                else minimum_viable / 16
            )
            new_weight_lb = max(minimum_viable_lb, current_weight_lb + adjustment_lb)

            # Convert back to base unit and round
            if unit_system == "metric":
                new_amount_base = new_weight_lb * 453.592  # pounds to grams
            else:
                new_amount_base = new_weight_lb * 16  # pounds to ounces

            new_amount_base = self._round_to_brewing_increments(
                new_amount_base, unit_system
            )
            min_change = self._get_minimum_change_for_system(unit_system)

            # Check if change is above minimum threshold
            change_amount = abs(new_amount_base - current_amount_base)
            if change_amount >= min_change:
                changes.append(
                    {
                        "ingredient_id": malt.get("ingredient_id"),
                        "ingredient_name": malt.get("name"),
                        "field": "amount",
                        "current_value": current_amount_base,  # In base unit (g or oz)
                        "suggested_value": new_amount_base,  # In base unit (g or oz)
                        "unit": base_unit,  # "g" for metric, "oz" for imperial
                        "reason": f"Increase base malt to reach target OG of {target_og:.3f}",
                    }
                )
                logger.info(
                    f"✅ ABV Increase: {malt.get('name')} {current_amount_base:.1f} -> {new_amount_base:.1f} {base_unit}"
                )
            else:
                logger.warning(
                    f"❌ ABV Increase: {malt.get('name')} change {change_amount:.1f}{base_unit} below minimum {min_change}"
                )

        if changes:
            logger.info(f"✅ ABV Increase: Generated {len(changes)} base malt changes")
            return {
                "type": "og_increase",
                "title": f"Increase Base Malts for Target OG ({target_og:.3f})",
                "description": f"Add base malt to achieve target original gravity",
                "confidence": "high",
                "changes": changes,
                "priority": 5,
            }

        logger.warning(
            "❌ ABV Increase: No viable changes generated - adjustments too small"
        )
        return None

    def _suggest_srm_adjustment(
        self, target_srm: float, current_srm: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Suggest color adjustments using specialty grains"""
        srm_difference = target_srm - current_srm

        changes = []

        if srm_difference > 0:
            # Need to increase color - adjust existing color-contributing grains first
            # Look for any grain that contributes color (specialty OR dark base malts)
            color_grains = [
                ing
                for ing in recipe_data.get("ingredients", [])
                if ing.get("type") == "grain"
                and ing.get("color", 0) > 10  # Any grain with color > 10 can contribute
                # and ing.get("grain_type")
                # in ["specialty", "base_malt"]  # Include dark base malts
            ]

            if color_grains:
                # Increase existing color-contributing grains proportionally
                for grain in color_grains:
                    current_amount = grain.get("amount", 0)
                    current_unit = grain.get("unit", "g")

                    # Convert to base unit for the user's system
                    current_amount_base, base_unit = self._convert_to_base_unit(
                        current_amount, current_unit, unit_system
                    )

                    # Calculate proportional increase (simplified)
                    increase_factor = min(
                        0.3, srm_difference / current_srm
                    )  # Max 30% increase
                    new_amount_base = current_amount_base * (1 + increase_factor)
                    new_amount_base = self._round_to_brewing_increments(
                        new_amount_base, unit_system
                    )

                    min_change = self._get_minimum_change_for_system(unit_system)

                    if abs(new_amount_base - current_amount_base) >= min_change:
                        changes.append(
                            {
                                "ingredient_id": grain.get("ingredient_id"),
                                "ingredient_name": grain.get("name"),
                                "field": "amount",
                                "current_value": current_amount_base,  # In base unit (g or oz)
                                "suggested_value": new_amount_base,  # In base unit (g or oz)
                                "unit": base_unit,  # "g" for metric, "oz" for imperial
                                "reason": f"Increase existing {grain.get('name')} to reach target SRM (preferred brewing practice)",
                            }
                        )
            else:
                # No existing specialty grains - suggest adding conservative amounts
                # Use smart grain selection based on color gap and style appropriateness
                grain_suggestions = self._get_smart_color_grain_suggestions(
                    srm_difference, current_srm, target_srm, recipe_data, unit_system
                )

                # Process the grain suggestions (now returns suggestion dictionaries)
                for grain_suggestion in grain_suggestions:
                    # The new method returns complete suggestion dictionaries
                    changes.append(grain_suggestion)

        elif srm_difference < 0:
            # Need to reduce color - reduce existing dark grains
            dark_grains = [
                ing
                for ing in recipe_data.get("ingredients", [])
                if ing.get("type") == "grain" and ing.get("color", 0) > 50
            ]

            for grain in dark_grains:
                current_amount = grain.get("amount", 0)
                current_unit = grain.get("unit", "g")

                # Convert to base unit for the user's system
                current_amount_base, base_unit = self._convert_to_base_unit(
                    current_amount, current_unit, unit_system
                )

                reduction_factor = min(
                    0.5, abs(srm_difference) / current_srm
                )  # Max 50% reduction
                # Use minimum viable amount to prevent unintended ingredient removal
                minimum_viable = self._get_minimum_viable_amount("grain", unit_system)
                new_amount_base = max(
                    minimum_viable, current_amount_base * (1 - reduction_factor)
                )
                new_amount_base = self._round_to_brewing_increments(
                    new_amount_base, unit_system
                )

                min_change = self._get_minimum_change_for_system(unit_system)

                if abs(new_amount_base - current_amount_base) >= min_change:
                    # Check if dramatic SRM reduction is needed and this is a small amount grain
                    dramatic_reduction_needed = (
                        abs(srm_difference) > 5
                    )  # More than 5 SRM units
                    is_small_amount = current_amount_base <= (
                        minimum_viable * 2
                    )  # Less than 2x minimum viable

                    if dramatic_reduction_needed and is_small_amount:
                        # Suggest explicit removal for dramatic SRM reduction
                        changes.append(
                            {
                                "ingredient_id": grain.get("ingredient_id"),
                                "ingredient_name": grain.get("name"),
                                "field": "amount",
                                "current_value": current_amount_base,
                                "suggested_value": 0,  # Explicit removal
                                "unit": base_unit,
                                "action": "remove",  # Mark as intentional removal
                                "reason": f"Remove {grain.get('name')} for dramatic SRM reduction (from {current_srm:.1f} to {target_srm:.1f})",
                            }
                        )
                    else:
                        # Regular reduction (not removal)
                        changes.append(
                            {
                                "ingredient_id": grain.get("ingredient_id"),
                                "ingredient_name": grain.get("name"),
                                "field": "amount",
                                "current_value": current_amount_base,  # In base unit (g or oz)
                                "suggested_value": new_amount_base,  # In base unit (g or oz)
                                "unit": base_unit,  # "g" for metric, "oz" for imperial
                                "reason": f"Reduce {grain.get('name')} to achieve target SRM",
                            }
                        )

        if changes:
            return {
                "type": "srm_adjustment",
                "title": f"Adjust Color for Target SRM ({target_srm:.1f})",
                "description": f"Modify specialty grains to achieve target color",
                "confidence": "high",
                "changes": changes,
                "priority": 3,
            }

        return None

    def _suggest_ibu_adjustment(
        self, target_ibu: float, current_ibu: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Suggest hop adjustments for target IBU"""
        ibu_difference = target_ibu - current_ibu

        # Find all boil hops (only boil hops, not whirlpool/dry hop)
        all_hops = [
            ing
            for ing in recipe_data.get("ingredients", [])
            if ing.get("type") == "hop"
        ]

        # DEBUG: Log all hops and their use types
        logger.info(f"🔍 DEBUG: All hops in recipe ({len(all_hops)}):")
        for hop in all_hops:
            logger.info(
                f"  - {hop.get('name', 'Unknown')}: use='{hop.get('use')}', time={hop.get('time', 0)}, alpha_acid={hop.get('alpha_acid', 0)}"
            )

        boil_hops = [
            ing
            for ing in all_hops
            if ing.get("use") == "boil"
            and ing.get("time", 0) > 0
            and ing.get("alpha_acid") is not None
            and ing.get("alpha_acid") > 0
        ]

        # DEBUG: Log filtered boil hops
        logger.info(f"🔍 DEBUG: Filtered boil hops ({len(boil_hops)}):")
        for hop in boil_hops:
            logger.info(
                f"  - {hop.get('name', 'Unknown')}: use='{hop.get('use')}', time={hop.get('time', 0)}, alpha_acid={hop.get('alpha_acid', 0)}"
            )

        if not boil_hops:
            logger.info(f"🔍 DEBUG: No boil hops found, returning None")
            return None

        # Calculate individual IBU contribution for each hop to find the most impactful one
        hop_contributions = []
        batch_size = float(recipe_data.get("batch_size", 5))
        batch_size_unit = recipe_data.get("batch_size_unit", "gal")

        # Convert batch size to gallons for IBU calculation
        from utils.unit_conversions import UnitConverter

        batch_size_gal = UnitConverter.convert_volume(
            batch_size, batch_size_unit, "gal"
        )

        for hop in boil_hops:
            # Calculate individual IBU contribution using simplified Tinseth formula
            amount_oz = UnitConverter.convert_to_ounces(
                hop.get("amount", 0), hop.get("unit", "oz")
            )
            alpha_acid = float(hop.get("alpha_acid", 0))
            time_min = int(hop.get("time", 0))

            # Simplified IBU calculation for this single hop
            if time_min > 0 and alpha_acid > 0 and amount_oz > 0:
                # Basic utilization factor (simplified)
                if hop.get("use") == "whirlpool":
                    utilization = min(
                        0.30, time_min * 0.01
                    )  # Lower utilization for whirlpool
                else:
                    utilization = min(
                        0.30, time_min * 0.006
                    )  # Standard boil utilization

                ibu_contribution = (
                    amount_oz * alpha_acid * utilization * 75
                ) / batch_size_gal
                hop_contributions.append(
                    {
                        "hop": hop,
                        "ibu_contribution": ibu_contribution,
                        "amount_oz": amount_oz,
                        "time_min": time_min,
                        "alpha_acid": alpha_acid,
                    }
                )

        if not hop_contributions:
            return None

        # Sort by IBU contribution (highest first)
        hop_contributions.sort(key=lambda x: x["ibu_contribution"], reverse=True)

        # Use the hop with highest IBU contribution as primary target
        primary_hop_data = hop_contributions[0]
        primary_hop = primary_hop_data["hop"]

        changes = []

        # Determine if we need to increase or decrease IBU
        need_to_reduce = current_ibu > target_ibu

        current_amount = primary_hop.get("amount", 0)
        current_unit = primary_hop.get("unit", "g")
        current_time = primary_hop.get("time", 60)

        # Convert to base unit for the user's system
        current_amount_base, base_unit = self._convert_to_base_unit(
            current_amount, current_unit, unit_system
        )

        # Get recipe boil time to respect the maximum
        recipe_boil_time = recipe_data.get("boil_time", 60)  # Default to 60 minutes

        # Two-phase approach for IBU increases: timing optimization first, then amount adjustment
        if not need_to_reduce:  # Only for IBU increases
            # Phase 1: Timing optimization to full boil time
            if current_time < recipe_boil_time and current_time >= 15:
                # Calculate IBU contribution at current timing
                current_amount_oz = UnitConverter.convert_to_ounces(
                    primary_hop.get("amount", 0), primary_hop.get("unit", "oz")
                )

                # Calculate OG from recipe ingredients
                from utils.brewing_calculation_core import (
                    calc_og_core,
                    convert_to_pounds,
                )

                # Calculate grain points from ingredients
                total_points = 0
                for ing in recipe_data.get("ingredients", []):
                    if ing.get("type") == "grain":
                        amount = float(ing.get("amount", 0))
                        unit = ing.get("unit", "g")
                        potential = float(ing.get("potential", 0))

                        weight_lb = convert_to_pounds(amount, unit)
                        points_contribution = weight_lb * potential
                        total_points += points_contribution

                og = calc_og_core(
                    total_points,
                    batch_size_gal,
                    float(recipe_data.get("efficiency", 75)),
                )

                current_ibu_contribution = self._calculate_hop_ibu_contribution(
                    primary_hop, current_amount_oz, current_time, og, batch_size_gal
                )

                # Calculate IBU contribution at full boil time
                optimized_ibu_contribution = self._calculate_hop_ibu_contribution(
                    primary_hop, current_amount_oz, recipe_boil_time, og, batch_size_gal
                )

                # Calculate the IBU gain from timing optimization
                timing_ibu_gain = optimized_ibu_contribution - current_ibu_contribution

                # Phase 1: Timing optimization
                changes.append(
                    {
                        "ingredient_id": primary_hop.get("ingredient_id"),
                        "ingredient_name": primary_hop.get("name"),
                        "ingredient_type": primary_hop.get("type", "hop"),
                        "ingredient_use": primary_hop.get("use"),
                        "ingredient_time": primary_hop.get("time"),
                        "field": "time",
                        "current_value": current_time,
                        "suggested_value": recipe_boil_time,
                        "unit": "min",
                        "reason": f"Phase 1: Optimize {primary_hop.get('name')} timing to full boil time ({recipe_boil_time} min) for maximum hop utilization (+{timing_ibu_gain:.1f} IBU)",
                    }
                )

                # Phase 2: Amount adjustment for remaining IBU gap
                remaining_ibu_gap = ibu_difference - timing_ibu_gain
                if remaining_ibu_gap > 0.5:  # If there's still a meaningful gap
                    # Calculate amount adjustment needed for remaining gap
                    if optimized_ibu_contribution > 0:
                        amount_adjustment_factor = 1.0 + (
                            remaining_ibu_gap / optimized_ibu_contribution
                        )
                        amount_adjustment_factor = max(0.1, amount_adjustment_factor)

                        new_amount_base = current_amount_base * amount_adjustment_factor
                        new_amount_base = self._round_to_brewing_increments(
                            new_amount_base, unit_system, "hop"
                        )

                        # Ensure minimum change threshold
                        min_change = self._get_minimum_change_for_system(unit_system)
                        if abs(new_amount_base - current_amount_base) >= min_change:
                            changes.append(
                                {
                                    "ingredient_id": primary_hop.get("ingredient_id"),
                                    "ingredient_name": primary_hop.get("name"),
                                    "ingredient_type": primary_hop.get("type", "hop"),
                                    "ingredient_use": primary_hop.get("use"),
                                    "ingredient_time": primary_hop.get("time"),
                                    "field": "amount",
                                    "current_value": current_amount_base,
                                    "suggested_value": new_amount_base,
                                    "unit": base_unit,
                                    "reason": f"Phase 2: Increase {primary_hop.get('name')} amount to reach target IBU (+{remaining_ibu_gap:.1f} IBU remaining)",
                                }
                            )
            else:
                # Fallback: Direct amount adjustment (when timing can't be optimized)
                if current_ibu > 0:
                    primary_contribution = primary_hop_data["ibu_contribution"]
                    if primary_contribution > 0:
                        adjustment_factor = 1.0 + (
                            ibu_difference / primary_contribution
                        )
                        adjustment_factor = max(0.1, adjustment_factor)

                        new_amount_base = current_amount_base * adjustment_factor
                        new_amount_base = self._round_to_brewing_increments(
                            new_amount_base, unit_system, "hop"
                        )

                        min_change = self._get_minimum_change_for_system(unit_system)
                        if abs(new_amount_base - current_amount_base) >= min_change:
                            changes.append(
                                {
                                    "ingredient_id": primary_hop.get("ingredient_id"),
                                    "ingredient_name": primary_hop.get("name"),
                                    "ingredient_type": primary_hop.get("type", "hop"),
                                    "ingredient_use": primary_hop.get("use"),
                                    "ingredient_time": primary_hop.get("time"),
                                    "field": "amount",
                                    "current_value": current_amount_base,
                                    "suggested_value": new_amount_base,
                                    "unit": base_unit,
                                    "reason": f"Increase {primary_hop.get('name')} amount to reach target IBU of {target_ibu:.1f} (timing already optimized)",
                                }
                            )
        else:
            # For IBU reductions, use the simpler approach
            # Strategy 1: Adjust hop amount (proportional to IBU difference)
            if current_ibu > 0:
                primary_contribution = primary_hop_data["ibu_contribution"]
                if primary_contribution > 0:
                    adjustment_factor = 1.0 + (ibu_difference / primary_contribution)
                    adjustment_factor = max(0.1, adjustment_factor)

                    new_amount_base = current_amount_base * adjustment_factor
                    new_amount_base = self._round_to_brewing_increments(
                        new_amount_base, unit_system, "hop"
                    )

                    min_change = self._get_minimum_change_for_system(unit_system)
                    if abs(new_amount_base - current_amount_base) >= min_change:
                        changes.append(
                            {
                                "ingredient_id": primary_hop.get("ingredient_id"),
                                "ingredient_name": primary_hop.get("name"),
                                "ingredient_type": primary_hop.get("type", "hop"),
                                "ingredient_use": primary_hop.get("use"),
                                "ingredient_time": primary_hop.get("time"),
                                "field": "amount",
                                "current_value": current_amount_base,
                                "suggested_value": new_amount_base,
                                "unit": base_unit,
                                "reason": f"Reduce {primary_hop.get('name')} amount to reach target IBU of {target_ibu:.1f}",
                            }
                        )

            # Strategy 2: Adjust boil time for reductions
            if current_time >= 15:
                time_reduction_factor = (
                    target_ibu / current_ibu if current_ibu > 0 else 0.8
                )
                new_time = max(5, current_time * time_reduction_factor)
                new_time = self._round_to_5_minute_interval(new_time, recipe_boil_time)

                if abs(new_time - current_time) >= 5:
                    changes.append(
                        {
                            "ingredient_id": primary_hop.get("ingredient_id"),
                            "ingredient_name": primary_hop.get("name"),
                            "ingredient_type": primary_hop.get("type", "hop"),
                            "ingredient_use": primary_hop.get("use"),
                            "ingredient_time": primary_hop.get("time"),
                            "field": "time",
                            "current_value": current_time,
                            "suggested_value": new_time,
                            "unit": "min",
                            "reason": f"Alternative: Reduce {primary_hop.get('name')} boil time to {new_time} minutes to achieve target IBU",
                        }
                    )

        if changes:
            action = "Reduce" if need_to_reduce else "Increase"
            return {
                "type": "ibu_adjustment",
                "title": f"{action} Hop Bitterness for Target IBU ({target_ibu:.0f})",
                "description": f"Current IBU ({current_ibu:.0f}) is {'too high' if need_to_reduce else 'too low'} for style",
                "confidence": "medium",
                "changes": changes,
                "priority": 2,
            }

        return None

    def _suggest_fg_adjustment(
        self, target_fg: float, current_fg: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Suggest yeast strain changes for target FG"""
        fg_difference = target_fg - current_fg

        # Find current yeast
        current_yeast = next(
            (
                ing
                for ing in recipe_data.get("ingredients", [])
                if ing.get("type") == "yeast"
            ),
            None,
        )

        if not current_yeast:
            return None

        changes = []

        if abs(fg_difference) > 0.003:  # Only suggest for meaningful FG differences
            current_attenuation = current_yeast.get("attenuation", 75)

            if fg_difference > 0:
                # Need higher FG (lower attenuation yeast)
                target_attenuation = max(65, current_attenuation - 10)
                yeast_recommendations = self._get_yeast_recommendations(
                    target_attenuation, "lower", recipe_data
                )
                action = "lower attenuation"
            else:
                # Need lower FG (higher attenuation yeast)
                target_attenuation = min(85, current_attenuation + 10)
                yeast_recommendations = self._get_yeast_recommendations(
                    target_attenuation, "higher", recipe_data
                )
                action = "higher attenuation"

            if yeast_recommendations:
                for yeast in yeast_recommendations:
                    yeast_name = yeast.get("name")
                    attenuation = yeast.get("attenuation")
                    reason = f"Switch to {yeast_name} ({attenuation}% attenuation) to achieve target FG of {target_fg:.3f}"

                    changes.append(
                        {
                            "ingredient_id": current_yeast.get("ingredient_id"),
                            "ingredient_name": current_yeast.get("name"),
                            "field": "ingredient_id",  # Actually replace the yeast ingredient
                            "current_value": current_yeast.get("ingredient_id"),
                            "suggested_value": yeast.get(
                                "id"
                            ),  # Use the database yeast's ID
                            "suggested_name": yeast_name,  # Also change the name
                            "suggested_attenuation": attenuation,
                            "reason": reason,
                            "is_yeast_strain_change": True,
                            "action": "substitute",  # Mark as substitution, not removal
                            "new_yeast_data": yeast,  # Include full yeast data for replacement
                        }
                    )
            else:
                # Fallback: generic advice without specific strain recommendation
                reason = f"Consider switching to a {action} yeast strain to achieve target FG of {target_fg:.3f}"
                changes.append(
                    {
                        "ingredient_id": current_yeast.get("ingredient_id"),
                        "ingredient_name": current_yeast.get("name"),
                        "field": "strain_type",
                        "current_value": f"{current_attenuation}% attenuation",
                        "suggested_value": f"{action} yeast strain",
                        "reason": reason,
                        "is_yeast_strain_change": True,
                    }
                )

        if changes:
            return {
                "type": "yeast_substitution",
                "title": f"Yeast Substitution for Target FG ({target_fg:.3f})",
                "description": f"Replace yeast strain - current FG ({current_fg:.3f}) requires different yeast attenuation",
                "confidence": "medium",
                "changes": changes,
                "priority": 2,
            }

        return None

    def _get_yeast_style_family(self, yeast: Dict) -> str:
        """Determine yeast style family from name and description"""
        name = yeast.get("name", "").lower()
        description = yeast.get("description", "").lower()

        # Check for lager indicators
        lager_keywords = [
            "lager",
            "pilsner",
            "pils",
            "german",
            "czech",
            "munich",
            "bavarian",
            "saflager",
            "w34",
            "saaz",
        ]
        if any(keyword in name for keyword in lager_keywords) or any(
            keyword in description for keyword in lager_keywords
        ):
            return "lager"

        # Check for ale indicators
        ale_keywords = [
            "ale",
            "ipa",
            "wheat",
            "weizen",
            "wit",
            "belgian",
            "english",
            "american",
            "safale",
            "saison",
            "abbey",
            "trappist",
        ]
        if any(keyword in name for keyword in ale_keywords) or any(
            keyword in description for keyword in ale_keywords
        ):
            return "ale"

        # Check for specialty/wild indicators
        specialty_keywords = ["wild", "brett", "sour", "lambic", "lacto", "pedio"]
        if any(keyword in name for keyword in specialty_keywords) or any(
            keyword in description for keyword in specialty_keywords
        ):
            return "specialty"

        # Default to ale if uncertain
        return "ale"

    def _get_yeast_recommendations(
        self, target_attenuation: float, direction: str, recipe_data: Dict
    ) -> List[Dict]:
        """Get specific yeast strain recommendations based on target attenuation from database"""
        # Get all yeast ingredients from database
        all_ingredients = self.engine._get_all_ingredients()
        yeast_ingredients = [
            ing
            for ing in all_ingredients
            if ing.get("type") == "yeast" and ing.get("attenuation") is not None
        ]

        if not yeast_ingredients:
            logger.warning("No yeast ingredients found in database")
            return []

        # Find current yeast to determine style compatibility
        current_yeast = next(
            (
                ing
                for ing in recipe_data.get("ingredients", [])
                if ing.get("type") == "yeast"
            ),
            None,
        )

        current_yeast_style = "ale"  # Default fallback
        if current_yeast:
            # Create a mock yeast dict for style analysis
            current_yeast_dict = {
                "name": current_yeast.get("name", ""),
                "description": current_yeast.get("description", ""),
            }
            current_yeast_style = self._get_yeast_style_family(current_yeast_dict)

        suitable_yeasts = []
        tolerance = 5  # ±5% attenuation tolerance

        for yeast in yeast_ingredients:
            yeast_attenuation = yeast.get("attenuation")
            yeast_style = self._get_yeast_style_family(yeast)

            # Check attenuation suitability
            attenuation_suitable = False
            if (
                direction == "lower"
                and yeast_attenuation <= target_attenuation + tolerance
            ):
                attenuation_suitable = True
            elif (
                direction == "higher"
                and yeast_attenuation >= target_attenuation - tolerance
            ):
                attenuation_suitable = True

            # Only include yeasts that are both attenuation-suitable and style-compatible
            if attenuation_suitable and yeast_style == current_yeast_style:
                suitable_yeasts.append(yeast)

        # Sort by how close to target attenuation and return top 2-3 options
        suitable_yeasts.sort(
            key=lambda x: abs(x.get("attenuation", 0) - target_attenuation)
        )

        # If no style-compatible yeasts found, return empty
        if not suitable_yeasts:
            return []

        return suitable_yeasts[:3]

    def _convert_to_base_unit(
        self, amount: float, unit: str, unit_system: str
    ) -> tuple:
        """
        Return ingredient amount as-is since all recipes are now stored in base units.

        After database migration, all recipes store ingredients in base units:
        - Metric recipes: grams (g)
        - Imperial recipes: ounces (oz)
        """
        # Ingredients are already in base units after migration
        if unit_system == "metric":
            return amount, "g"
        else:
            return amount, "oz"

    def _check_for_overall_reduction_need(
        self, recipe_data: Dict, metrics: Dict, style_analysis: Dict, unit_system: str
    ) -> Optional[Dict]:
        """Check if multiple key metrics are at top end and suggest overall grain reduction"""
        if not style_analysis.get("style_guide"):
            return None

        style_guide = style_analysis["style_guide"]

        # Define key metrics that indicate recipe strength
        key_metrics = ["og", "fg", "abv", "ibu"]
        top_end_metrics = []

        for metric in key_metrics:
            current_value = metrics.get(metric)
            min_val = getattr(style_guide, f"{metric}_min", None)
            max_val = getattr(style_guide, f"{metric}_max", None)

            if (
                current_value is not None
                and min_val is not None
                and max_val is not None
            ):
                # Check if metric is in top 15% of style range (lacks breathing room)
                range_size = max_val - min_val
                position = (current_value - min_val) / range_size

                if position > 0.85:  # In top 15% of range
                    top_end_metrics.append(
                        {
                            "metric": metric,
                            "value": current_value,
                            "max": max_val,
                            "position": position,
                        }
                    )

        # If 3+ key metrics are at top end, suggest overall reduction
        if len(top_end_metrics) >= 3:
            logger.info(
                f"🔍 Overall Reduction Check - {len(top_end_metrics)} metrics at top end: {[m['metric'] for m in top_end_metrics]}"
            )

            # Focus on OG-related reduction since it affects OG, FG, and ABV
            base_malts = [
                ing
                for ing in recipe_data.get("ingredients", [])
                if ing.get("type") == "grain" and ing.get("grain_type") == "base"
            ]

            if not base_malts:
                return None

            changes = []
            reduction_amount = 50  # Reduce each base malt by 50g as you suggested

            for malt in base_malts:
                current_amount = malt.get("amount", 0)
                current_unit = malt.get("unit", "g")

                # Convert to user's preferred unit system
                current_amount_base, base_unit = self._convert_to_base_unit(
                    current_amount, current_unit, unit_system
                )

                # Apply reduction (50g or equivalent in oz)
                reduction_in_base_unit = 50 if base_unit == "g" else 1.76  # ~50g in oz
                new_amount = max(
                    100, current_amount_base - reduction_in_base_unit
                )  # Minimum 100g

                # Round to brewing-friendly amounts
                new_amount = self._round_to_brewing_increments(new_amount, unit_system)

                if abs(new_amount - current_amount_base) >= (
                    25 if base_unit == "g" else 0.88
                ):  # Meaningful change
                    changes.append(
                        {
                            "ingredient_id": malt.get("ingredient_id"),
                            "ingredient_name": malt.get("name"),
                            "field": "amount",
                            "current_value": current_amount_base,
                            "suggested_value": new_amount,
                            "unit": base_unit,
                            "reason": f"Reduce {malt.get('name')} to provide breathing room - multiple metrics are at top of style range",
                        }
                    )

            if changes:
                top_metrics_str = ", ".join(
                    [f"{m['metric'].upper()}" for m in top_end_metrics]
                )
                return {
                    "type": "overall_reduction",
                    "title": "Provide Style Breathing Room",
                    "description": f"Multiple key metrics ({top_metrics_str}) are at the top end of style guidelines. Reduce base malt amounts to provide better breathing room within the style range.",
                    "confidence": "high",
                    "changes": changes,
                    "priority": 6,  # High priority for this scenario
                    "impactType": "important",
                    "styleImpact": f"Moves {top_metrics_str} away from style maximums for better balance",
                }

        return None

    def _round_to_5_minute_interval(
        self, time_minutes: float, max_boil_time: float = 90
    ) -> int:
        """Round hop timing to nearest 5-minute interval for brewing convenience"""
        # Round to nearest 5-minute interval
        rounded = round(time_minutes / 5) * 5
        # Ensure minimum of 5 minutes and maximum of recipe boil time
        return max(5, min(int(max_boil_time), int(rounded)))

    def _round_to_brewing_increments(
        self, amount: float, unit_system: str, ingredient_type: str = "grain"
    ) -> float:
        """Round amount to brewing-friendly increments"""
        from utils.unit_conversions import UnitConverter

        return UnitConverter.round_to_brewing_precision(
            amount, ingredient_type, unit_system
        )

    def _get_minimum_change_for_system(self, unit_system: str) -> float:
        """Get minimum meaningful change for the unit system"""
        if unit_system == "metric":
            return 25  # 25g minimum change
        else:
            return 0.25  # 0.25oz minimum change

    def _get_minimum_viable_amount(
        self, ingredient_type: str, unit_system: str
    ) -> float:
        """Get minimum viable amount to prevent ingredient removal based on measurement capability"""
        if ingredient_type == "hop":
            # Hops: smallest measurable amount
            if unit_system == "metric":
                return 5  # 5g minimum
            else:
                return 0.25  # 0.25oz minimum
        elif ingredient_type == "grain":
            # Grains: smallest measurable amount
            if unit_system == "metric":
                return 25  # 25g minimum (1oz equivalent)
            else:
                return 1.0  # 1oz minimum
        else:
            # Other ingredients: use grain defaults
            if unit_system == "metric":
                return 25  # 25g minimum
            else:
                return 1.0  # 1oz minimum

    def _calculate_hop_ibu_contribution(
        self,
        hop: Dict,
        amount_oz: float,
        time_min: int,
        og: float,
        batch_size_gal: float,
    ) -> float:
        """Calculate IBU contribution for a specific hop at given amount and timing"""
        alpha_acid = float(hop.get("alpha_acid", 0))

        if time_min <= 0 or alpha_acid <= 0 or amount_oz <= 0:
            return 0.0

        # Basic utilization factor (simplified Tinseth formula)
        if hop.get("use") == "whirlpool":
            utilization = min(0.30, time_min * 0.01)  # Lower utilization for whirlpool
        else:
            utilization = min(0.30, time_min * 0.006)  # Standard boil utilization

        # IBU calculation: (amount_oz * alpha_acid * utilization * 75) / batch_size_gal
        ibu_contribution = (amount_oz * alpha_acid * utilization * 75) / batch_size_gal
        return ibu_contribution

    def _get_og_adjustment_changes(
        self, target: Dict, recipe_data: Dict, unit_system: str
    ) -> List[Dict]:
        """Extract OG adjustment changes for unified suggestion"""
        suggestion = self._suggest_og_adjustment(
            target["target_value"], target["current_value"], recipe_data, unit_system
        )
        return suggestion.get("changes", []) if suggestion else []

    def _get_srm_adjustment_changes(
        self, target: Dict, recipe_data: Dict, unit_system: str
    ) -> List[Dict]:
        """Extract SRM adjustment changes for unified suggestion"""
        suggestion = self._suggest_srm_adjustment(
            target["target_value"], target["current_value"], recipe_data, unit_system
        )
        return suggestion.get("changes", []) if suggestion else []

    def _get_ibu_adjustment_changes(
        self, target: Dict, recipe_data: Dict, unit_system: str
    ) -> List[Dict]:
        """Extract IBU adjustment changes for unified suggestion"""
        logger.info(
            f"🔍 IBU adjustment requested: target={target['target_value']}, current={target['current_value']}"
        )
        suggestion = self._suggest_ibu_adjustment(
            target["target_value"], target["current_value"], recipe_data, unit_system
        )
        changes = suggestion.get("changes", []) if suggestion else []
        logger.info(f"🔍 IBU adjustment changes generated: {len(changes)} changes")
        for i, change in enumerate(changes):
            logger.info(
                f"🔍   Change {i+1}: {change.get('ingredient_name')} ({change.get('ingredient_type')}) use='{change.get('ingredient_use')}' time={change.get('ingredient_time')} - {change.get('field')} from {change.get('current_value')} to {change.get('suggested_value')}"
            )
        return changes

    def _get_fg_adjustment_changes(
        self, target: Dict, recipe_data: Dict, unit_system: str
    ) -> List[Dict]:
        """Extract FG adjustment changes for unified suggestion"""
        suggestion = self._suggest_fg_adjustment(
            target["target_value"], target["current_value"], recipe_data, unit_system
        )
        return suggestion.get("changes", []) if suggestion else []

    def _determine_color_adjustment_strategy(
        self,
        style_analysis: Dict,
        current_metrics: Dict,
        srm_difference: float,
        recipe_data: Dict = None,
    ) -> str:
        """Use style compliance to determine the best color adjustment strategy"""

        # PRIORITY 1: Check for caramel/crystal substitution opportunity
        if recipe_data:
            existing_caramel_crystal = self._find_existing_caramel_crystal_in_recipe(
                recipe_data
            )
            if existing_caramel_crystal:
                # Calculate Lovibond delta needed for SRM adjustment
                # Rough approximation: 1 SRM ≈ 10 Lovibond for crystal malts
                lovibond_delta = srm_difference * 10

                # Check if we can find a suitable substitute
                substitute = self._find_best_caramel_crystal_substitute(
                    existing_caramel_crystal, lovibond_delta
                )
                if substitute:
                    return "caramel_crystal_substitution"

        if not style_analysis or not style_analysis.get("compliance"):
            # Fallback to conservative strategy if no style data
            return "base_malt" if srm_difference <= 5 else "mixed"

        compliance = style_analysis.get("compliance", {})
        og_compliance = compliance.get("og", {})
        abv_compliance = compliance.get("abv", {})

        og_in_range = og_compliance.get("in_range", False)
        abv_in_range = abv_compliance.get("in_range", False)
        current_og = current_metrics.get("og", 1.050)

        # Strategy 1: If OG/ABV are in style range, use high-impact roasted grains
        # This avoids affecting gravity while achieving color goals
        if og_in_range and abv_in_range and srm_difference > 3:
            logger.info(
                f"🔍 Using roasted grain strategy: OG/ABV in range, SRM difference ({srm_difference:.1f})"
            )
            return "roasted_grain"

        # Strategy 2: If OG is below style range, use base malt for dual benefit
        # This increases both color and gravity
        elif not og_in_range:
            og_min = og_compliance.get("style_range", {}).get("min", 1.050)
            if current_og < og_min:
                logger.info(
                    f"🔍 Using base malt strategy: OG ({current_og:.3f}) below style min ({og_min:.3f})"
                )
                return "base_malt"

        # Strategy 3: Mixed approach for large adjustments
        if srm_difference > 5:
            logger.info(
                f"🔍 Using mixed strategy: large SRM difference ({srm_difference:.1f})"
            )
            return "mixed"

        # Default: use base malt for moderate adjustments
        logger.info(
            f"🔍 Using default base malt strategy: moderate SRM difference ({srm_difference:.1f})"
        )
        return "base_malt"

    def _calculate_grain_amount(
        self,
        srm_difference: float,
        grain_color: float,
        recipe_data: Dict,
        unit_system: str,
        strategy: str,
    ) -> float:
        """Calculate grain amount based on color impact and recipe parameters"""
        # Get actual batch size from recipe
        batch_size = float(recipe_data.get("batch_size", 5))
        batch_size_unit = recipe_data.get("batch_size_unit", "gal")

        # Convert to gallons for consistent calculation
        from utils.unit_conversions import UnitConverter

        batch_size_gal = UnitConverter.convert_volume(
            batch_size, batch_size_unit, "gal"
        )

        # Use actual recipe efficiency
        efficiency = recipe_data.get("efficiency", 75) / 100.0

        # Calculate amount based on brewing science
        # Formula: amount = (srm_difference * batch_size_gal) / (grain_color * efficiency)
        base_amount = (srm_difference * batch_size_gal) / (grain_color * efficiency)

        # Apply strategy-specific adjustments
        if strategy == "roasted_grain":
            # Roasted grains are very potent - use smaller amounts
            base_amount *= 0.3
        elif strategy == "base_malt":
            # Base malts are less potent for color - use more
            base_amount *= 1.5

        # Round to brewing-friendly amounts in user's preferred unit system
        if unit_system == "metric":
            return max(25, round(base_amount / 25) * 25)  # 25g increments
        else:
            return max(0.5, round(base_amount * 2) / 2)  # 0.5oz increments

    def _create_new_ingredient_suggestion(
        self, ingredient_data: Dict, amount: float, unit: str
    ) -> Dict:
        """Create complete new ingredient suggestion using database properties"""
        return {
            "ingredient_name": ingredient_data["name"],
            "field": "amount",
            "current_value": 0,
            "suggested_value": amount,
            "unit": unit,
            "is_new_ingredient": True,
            "new_ingredient_data": {
                "name": ingredient_data["name"],
                "type": ingredient_data["type"],
                "grain_type": ingredient_data["grain_type"],  # From database
                "color": ingredient_data["color"],  # From database
                "potential": ingredient_data["potential"],  # From database
                "amount": amount,
                "unit": unit,
                "use": "mash",
            },
            "reason": f"Add {ingredient_data['name']} to help achieve target color. Amount calculated based on recipe parameters and grain color impact.",
        }

    def _get_smart_color_grain_suggestions(
        self,
        srm_difference: float,
        current_srm: float,
        target_srm: float,
        recipe_data: Dict,
        unit_system: str,
    ) -> List[tuple]:
        """Get smart grain suggestions using style-aware strategy and database ingredients"""
        suggestions = []

        # Get style analysis for intelligent strategy selection
        style_analysis = recipe_data.get("style_analysis", {})
        current_metrics = recipe_data.get("current_metrics", {})

        # Determine strategy based on style compliance, not hardcoded values
        strategy = self._determine_color_adjustment_strategy(
            style_analysis, current_metrics, srm_difference, recipe_data
        )

        # Base unit for user's system
        base_unit = "g" if unit_system == "metric" else "oz"

        # Get appropriate grains from database based on strategy
        logger.info(f"🔍 Color strategy selected: {strategy}")
        if strategy == "caramel_crystal_substitution":
            # Use caramel/crystal substitution for SRM adjustment
            logger.info("🔍 Executing caramel/crystal substitution strategy")
            existing_caramel_crystal = self._find_existing_caramel_crystal_in_recipe(
                recipe_data
            )
            logger.info(
                f"🔍 Found existing caramel/crystal: {existing_caramel_crystal is not None}"
            )
            if existing_caramel_crystal:
                # Calculate Lovibond delta needed for SRM adjustment
                lovibond_delta = srm_difference * 10  # Rough approximation

                substitute = self._find_best_caramel_crystal_substitute(
                    existing_caramel_crystal, lovibond_delta
                )
                if substitute:
                    # Use same amount as existing ingredient
                    amount = existing_caramel_crystal["recipe_amount"]
                    unit = existing_caramel_crystal["recipe_unit"]

                    # Create substitution suggestion
                    try:
                        change = self._create_caramel_crystal_substitution_suggestion(
                            existing_caramel_crystal,
                            substitute,
                            amount,
                            unit,
                            recipe_data,
                        )
                        suggestions.append(change)
                        logger.info(
                            f"🔍 Successfully created caramel/crystal substitution suggestion"
                        )
                    except Exception as e:
                        logger.error(
                            f"🔍 Error creating caramel/crystal substitution suggestion: {str(e)}"
                        )
                        import traceback

                        logger.error(f"🔍 Traceback: {traceback.format_exc()}")

        elif strategy == "roasted_grain":
            # Use darkest roasted grain for color correction
            darkest_roasted = self.engine._find_darkest_roasted_grain()
            if darkest_roasted:
                # Calculate amount using recipe-aware calculation
                amount = self._calculate_grain_amount(
                    darkest_roasted["color"],
                    srm_difference,
                    recipe_data,
                    unit_system,
                    strategy,
                )

                # Create suggestion with complete database ingredient data
                change = self._create_new_ingredient_suggestion(
                    darkest_roasted, amount, base_unit
                )
                suggestions.append(change)
                logger.info(
                    f"🔍 Roasted grain suggestion: {darkest_roasted['name']} ({amount} {base_unit})"
                )

        elif strategy == "base_malt":
            # Use darkest base malt for color and gravity adjustment
            darkest_base_malt = self.engine._find_darkest_base_malt()
            if darkest_base_malt:
                # Calculate amount using recipe-aware calculation
                amount = self._calculate_grain_amount(
                    darkest_base_malt["color"],
                    srm_difference,
                    recipe_data,
                    unit_system,
                    strategy,
                )

                # Create suggestion with complete database ingredient data
                change = self._create_new_ingredient_suggestion(
                    darkest_base_malt, amount, base_unit
                )
                suggestions.append(change)
                logger.info(
                    f"🔍 Base malt suggestion: {darkest_base_malt['name']} ({amount} {base_unit})"
                )

        # Fallback: if no suitable grains found, provide generic suggestions
        if not suggestions:
            logger.warning(
                "🔍 No suitable grains found in database, using fallback suggestions"
            )
            # Try to find Munich malt from database as fallback
            all_ingredients = self.engine._get_all_ingredients()
            munich_malt = None
            for ingredient in all_ingredients:
                if (
                    "munich" in ingredient["name"].lower()
                    and ingredient["type"] == "grain"
                    and ingredient["grain_type"] == "base_malt"
                ):
                    munich_malt = ingredient
                    break

            if munich_malt:
                # Calculate amount using recipe-aware calculation
                amount = self._calculate_grain_amount(
                    munich_malt["color"],
                    srm_difference,
                    recipe_data,
                    unit_system,
                    "base_malt",
                )

                # Create suggestion with complete database ingredient data
                change = self._create_new_ingredient_suggestion(
                    munich_malt, amount, base_unit
                )
                suggestions.append(change)
                logger.info(
                    f"🔍 Fallback Munich malt suggestion: {munich_malt['name']} ({amount} {base_unit})"
                )

        logger.info(
            f"🔍 Color grain suggestions generated: {len(suggestions)} suggestions"
        )
        return suggestions

    def _suggest_abv_adjustment(
        self, target_abv: float, current_abv: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Advanced ABV adjustment with OG and FG optimization"""
        abv_difference = target_abv - current_abv
        logger.info(
            f"🔍 Advanced ABV Adjustment - Current: {current_abv:.1f}%, Target: {target_abv:.1f}%, Difference: {abv_difference:.1f}%"
        )

        # Get current metrics
        current_og = recipe_data.get("current_metrics", {}).get("og", 1.050)
        current_fg = recipe_data.get("current_metrics", {}).get("fg", 1.012)

        # For ABV reduction, choose strategy based on current recipe state
        if abv_difference < 0:
            # Get style analysis to check if OG is in range
            style_analysis = recipe_data.get("style_analysis", {})
            og_compliance = style_analysis.get("compliance", {}).get("og", {})
            og_in_range = og_compliance.get("in_range", False)

            logger.info(
                f"🔍 ABV Adjustment - OG in range: {og_in_range}, Current OG: {current_og:.3f}"
            )

            # If OG is already in range, prefer FG adjustment via yeast change
            if og_in_range and abs(abv_difference) <= 0.5:
                logger.info(
                    f"🔍 ABV Adjustment - Using yeast attenuation strategy (OG in range)"
                )
                return self._suggest_abv_via_yeast_adjustment(
                    target_abv,
                    current_abv,
                    current_og,
                    current_fg,
                    recipe_data,
                    unit_system,
                )

            # Otherwise, use OG reduction strategy
            # Calculate target OG assuming same FG
            # ABV ≈ (OG - FG) * 131.25, so OG ≈ ABV/131.25 + FG
            target_og = (target_abv / 131.25) + current_fg

            # Ensure target OG is reasonable (not below 1.030)
            target_og = max(1.030, target_og)

            logger.info(
                f"🔍 ABV Adjustment - Using OG reduction strategy, target OG: {target_og:.3f}"
            )

            # For small ABV adjustments (<0.5%), use more sensitive OG reduction
            if abs(abv_difference) < 0.5:
                return self._suggest_small_abv_adjustment(
                    target_og, current_og, abv_difference, recipe_data, unit_system
                )

            return self._suggest_og_adjustment(
                target_og, current_og, recipe_data, unit_system
            )
        else:
            # For ABV increase, prefer OG increase (traditional approach)
            logger.info(
                f"🔍 ABV Adjustment - Processing ABV increase from {current_abv:.1f}% to {target_abv:.1f}%"
            )

            # Check if OG is in range to understand constraints
            style_analysis = recipe_data.get("style_analysis", {})
            og_compliance = style_analysis.get("compliance", {}).get("og", {})
            og_in_range = og_compliance.get("in_range", False)
            og_style_range = og_compliance.get("style_range", {})

            logger.info(
                f"🔍 ABV Adjustment - Current OG: {current_og:.3f}, OG in range: {og_in_range}, Style range: {og_style_range}"
            )

            estimated_og_change = abv_difference * 0.007
            target_og = current_og + estimated_og_change

            logger.info(
                f"🔍 ABV Adjustment - Estimated OG change: {estimated_og_change:.3f}, Target OG: {target_og:.3f}"
            )

            return self._suggest_og_adjustment(
                target_og, current_og, recipe_data, unit_system
            )

    def _generate_general_suggestions(
        self, recipe_data: Dict, metrics: Dict, unit_system: str
    ) -> List[Dict]:
        """Generate general brewing improvement suggestions"""
        suggestions = []

        # Base malt percentage check
        base_malt_percentage = self._calculate_base_malt_percentage(recipe_data)
        if base_malt_percentage < 55:
            suggestions.append(
                {
                    "type": "base_malt_percentage",
                    "title": "Increase Base Malt Percentage",
                    "description": f"Base malts make up only {base_malt_percentage:.1f}% of grain bill. Consider increasing to at least 55%.",
                    "confidence": "medium",
                    "changes": [],
                    "priority": 1,
                }
            )

        return suggestions

    # ========== ADVANCED OG/ABV REDUCTION METHODS ==========

    def _get_target_srm_from_style(self, recipe_data: Dict) -> Optional[Dict]:
        """Extract target SRM range from style guidelines"""
        try:
            # Get style analysis from recipe data if available
            style_analysis = recipe_data.get("style_analysis")
            if style_analysis and style_analysis.get("compliance", {}).get("srm"):
                srm_compliance = style_analysis["compliance"]["srm"]
                return {
                    "min": srm_compliance["style_range"]["min"],
                    "max": srm_compliance["style_range"]["max"],
                    "target": (
                        srm_compliance["style_range"]["min"]
                        + srm_compliance["style_range"]["max"]
                    )
                    / 2,
                }

            # Fallback: reasonable defaults based on current SRM
            current_srm = recipe_data.get("current_metrics", {}).get("srm", 8)
            return {
                "min": max(2, current_srm - 2),
                "max": current_srm + 2,
                "target": current_srm,
            }
        except Exception:
            return None

    def _select_og_reduction_strategy(
        self,
        og_reduction_needed: float,
        current_srm: float,
        target_srm_info: Optional[Dict],
        recipe_data: Dict,
        unit_system: str,
    ) -> str:
        """Strategic decision tree for OG reduction approach"""

        # Strategy 1: High-impact color grains (Blackprinz, Midnight Wheat)
        # Use when SRM is too low AND we need OG reduction
        if target_srm_info and current_srm < target_srm_info["min"]:
            return "high_impact_color_grains"

        # Strategy 2: Base malt ratio adjustment
        # Use when we have high-gravity specialty malts we can swap out
        dark_specialty_malts = self._find_dark_specialty_malts(recipe_data)
        if dark_specialty_malts and og_reduction_needed > 0.010:
            return "base_malt_ratio_adjustment"

        # Strategy 3: Combined approach
        # Use for significant gravity reduction needs
        if og_reduction_needed > 0.015:
            return "combined_approach"

        # Fallback: Traditional base malt reduction
        return "traditional_base_malt_reduction"

    def _apply_high_impact_color_grain_strategy(
        self,
        og_reduction_needed: float,
        current_srm: float,
        target_srm_info: Dict,
        recipe_data: Dict,
        unit_system: str,
    ) -> Dict:
        """Strategy: Use high-impact color grains (Blackprinz, Midnight Wheat) to increase SRM with minimal OG impact"""
        changes = []

        # Reduce base malts proportionally to lower OG
        base_malt_reduction = self._reduce_base_malts_proportionally(
            og_reduction_needed * 0.7,
            recipe_data,
            unit_system,  # Use 70% of reduction via base malt
        )
        changes.extend(base_malt_reduction)

        # Add high-impact color grains to reach target SRM
        srm_increase_needed = target_srm_info["target"] - current_srm
        color_grain_additions = self._add_high_impact_color_grains(
            srm_increase_needed, recipe_data, unit_system
        )
        changes.extend(color_grain_additions)

        if changes:
            return {
                "type": "og_reduction_color_strategy",
                "title": f"Reduce OG with High-Impact Color Adjustment",
                "description": f"Use Blackprinz/Midnight Wheat to maintain color while reducing base malts for lower OG/ABV",
                "confidence": "high",
                "changes": changes,
                "priority": 5,
            }

        return None

    def _apply_base_malt_ratio_strategy(
        self, og_reduction_needed: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Strategy: Replace high-gravity specialty malts with lower-gravity alternatives"""
        changes = []

        # Find dark specialty malts that can be replaced
        dark_specialty_malts = self._find_dark_specialty_malts(recipe_data)

        for malt in dark_specialty_malts:
            # Replace with lower-gravity alternative
            replacement = self._get_lower_gravity_replacement(malt)
            if replacement:
                current_amount = malt.get("amount", 0)
                current_unit = malt.get("unit", "g")

                # Convert to base unit
                current_amount_base, base_unit = self._convert_to_base_unit(
                    current_amount, current_unit, unit_system
                )

                changes.append(
                    {
                        "ingredient_id": malt.get("ingredient_id"),
                        "ingredient_name": malt.get("name"),
                        "field": "name",
                        "current_value": malt.get("name"),
                        "suggested_value": replacement["name"],
                        "reason": f"Replace {malt.get('name')} with {replacement['name']} to reduce OG while maintaining similar color",
                        "is_grain_type_change": True,
                        "new_potential": replacement["potential"],
                    }
                )

        # Also reduce base malts slightly if needed
        remaining_reduction = (
            og_reduction_needed * 0.3
        )  # Use 30% for base malt reduction
        if remaining_reduction > 0.005:
            base_malt_reduction = self._reduce_base_malts_proportionally(
                remaining_reduction, recipe_data, unit_system
            )
            changes.extend(base_malt_reduction)

        if changes:
            return {
                "type": "og_reduction_ratio_strategy",
                "title": f"Optimize Grain Ratio for Lower OG",
                "description": f"Replace high-gravity specialty malts with lower-gravity alternatives",
                "confidence": "medium",
                "changes": changes,
                "priority": 4,
            }

        return None

    def _apply_combined_reduction_strategy(
        self,
        og_reduction_needed: float,
        current_srm: float,
        target_srm_info: Dict,
        recipe_data: Dict,
        unit_system: str,
    ) -> Dict:
        """Strategy: Combine multiple approaches for significant OG reduction"""
        changes = []

        # 1. Reduce base malts (50% of reduction)
        base_malt_reduction = self._reduce_base_malts_proportionally(
            og_reduction_needed * 0.5, recipe_data, unit_system
        )
        changes.extend(base_malt_reduction)

        # 2. Replace specialty malts (30% of reduction)
        dark_specialty_malts = self._find_dark_specialty_malts(recipe_data)
        if dark_specialty_malts:
            for malt in dark_specialty_malts[:2]:  # Limit to 2 replacements
                replacement = self._get_lower_gravity_replacement(malt)
                if replacement:
                    changes.append(
                        {
                            "ingredient_id": malt.get("ingredient_id"),
                            "ingredient_name": malt.get("name"),
                            "field": "name",
                            "current_value": malt.get("name"),
                            "suggested_value": replacement["name"],
                            "reason": f"Replace with lower-gravity alternative to reduce OG",
                            "is_grain_type_change": True,
                            "new_potential": replacement["potential"],
                        }
                    )

        # 3. Add high-impact color grains if SRM needs adjustment (20% focus)
        if target_srm_info and current_srm < target_srm_info["min"]:
            srm_increase_needed = min(
                3, target_srm_info["target"] - current_srm
            )  # Conservative color addition
            color_grain_additions = self._add_high_impact_color_grains(
                srm_increase_needed, recipe_data, unit_system
            )
            changes.extend(color_grain_additions)

        if changes:
            return {
                "type": "og_reduction_combined_strategy",
                "title": f"Multi-Strategy OG Reduction",
                "description": f"Comprehensive approach: reduce base malts, optimize specialty grain ratios, and adjust color",
                "confidence": "high",
                "changes": changes,
                "priority": 5,
            }

        return None

    def _apply_traditional_base_malt_reduction(
        self, target_og: float, current_og: float, recipe_data: Dict, unit_system: str
    ) -> Dict:
        """Fallback: Traditional proportional base malt reduction"""
        og_reduction_needed = current_og - target_og

        changes = self._reduce_base_malts_proportionally(
            og_reduction_needed, recipe_data, unit_system
        )

        if changes:
            return {
                "type": "og_reduction_traditional",
                "title": f"Reduce Base Malts for Target OG ({target_og:.3f})",
                "description": f"Traditional approach: proportionally reduce base malt amounts",
                "confidence": "medium",
                "changes": changes,
                "priority": 3,
            }

        return None

    def _reduce_base_malts_proportionally(
        self, og_reduction_needed: float, recipe_data: Dict, unit_system: str
    ) -> List[Dict]:
        """Reduce base malts proportionally to achieve OG reduction"""
        changes = []

        # Find base malts
        base_malts = [
            ing
            for ing in recipe_data.get("ingredients", [])
            if ing.get("type") == "grain" and ing.get("grain_type") == "base_malt"
        ]

        if not base_malts:
            return changes

        # Calculate reduction factor (simplified brewing math)
        reduction_factor = min(0.3, og_reduction_needed * 2)  # Max 30% reduction

        for malt in base_malts:
            current_amount = malt.get("amount", 0)
            current_unit = malt.get("unit", "g")

            # Convert to base unit
            current_amount_base, base_unit = self._convert_to_base_unit(
                current_amount, current_unit, unit_system
            )

            # Calculate new amount
            new_amount_base = current_amount_base * (1 - reduction_factor)
            new_amount_base = self._round_to_brewing_increments(
                new_amount_base, unit_system
            )

            # Ensure minimum change threshold
            min_change = self._get_minimum_change_for_system(unit_system)
            if abs(new_amount_base - current_amount_base) >= min_change:
                changes.append(
                    {
                        "ingredient_id": malt.get("ingredient_id"),
                        "ingredient_name": malt.get("name"),
                        "field": "amount",
                        "current_value": current_amount_base,
                        "suggested_value": new_amount_base,
                        "unit": base_unit,
                        "reason": f"Reduce {malt.get('name')} to lower OG",
                    }
                )

        return changes

    def _find_dark_specialty_malts(self, recipe_data: Dict) -> List[Dict]:
        """Find dark specialty malts that can be replaced with lower-gravity alternatives"""
        dark_specialty_malts = []

        for ing in recipe_data.get("ingredients", []):
            if (
                ing.get("type") == "grain"
                and ing.get("grain_type") == "specialty"
                and ing.get("color", 0) > 40  # Dark specialty malts
                and ing.get("potential", 1.035) > 1.035
            ):  # Higher-gravity malts
                dark_specialty_malts.append(ing)

        return dark_specialty_malts

    def _get_lower_gravity_replacement(self, malt: Dict) -> Optional[Dict]:
        """Get lower-gravity replacement for a specialty malt"""
        malt_name = malt.get("name", "").lower()
        color = malt.get("color", 0)

        # Replacement mapping for common dark specialty malts
        replacements = {
            "munich dark": {"name": "Munich Light", "potential": 1.037, "color": 6},
            "chocolate malt": {"name": "Blackprinz", "potential": 1.025, "color": 450},
            "chocolate wheat": {
                "name": "Midnight Wheat",
                "potential": 1.025,
                "color": 550,
            },
            "carafa ii": {"name": "Carafa I", "potential": 1.025, "color": 337},
            "black patent": {"name": "Blackprinz", "potential": 1.025, "color": 450},
            "roasted barley": {"name": "Blackprinz", "potential": 1.025, "color": 450},
        }

        # Find appropriate replacement
        for key, replacement in replacements.items():
            if key in malt_name:
                return replacement

        # Fallback: if it's a very dark malt (>200L), suggest Blackprinz
        if color > 200:
            return {"name": "Blackprinz", "potential": 1.025, "color": 450}

        return None

    def _add_high_impact_color_grains(
        self, srm_increase_needed: float, recipe_data: Dict, unit_system: str
    ) -> List[Dict]:
        """Add high-impact color grains (Blackprinz, Midnight Wheat) for SRM adjustment with minimal OG impact"""
        changes = []

        if srm_increase_needed <= 0:
            return changes

        # Choose grain based on SRM increase needed
        if srm_increase_needed <= 3:
            # Small color adjustment - use Midnight Wheat (550L)
            grain_name = "Midnight Wheat"
            grain_color = 550
            # Conservative amounts
            base_amount = 25 if unit_system == "metric" else 1.0  # 25g or 1oz
        else:
            # Larger color adjustment - use Blackprinz (450L)
            grain_name = "Blackprinz"
            grain_color = 450
            # Slightly larger amounts for bigger color impact
            base_amount = 50 if unit_system == "metric" else 1.8  # 50g or 1.8oz

        # Scale amount based on SRM increase needed
        amount_multiplier = min(2.0, srm_increase_needed / 2)  # Max 2x multiplier
        final_amount = base_amount * amount_multiplier

        # Round to brewing increments
        final_amount = self._round_to_brewing_increments(final_amount, unit_system)
        base_unit = "g" if unit_system == "metric" else "oz"

        changes.append(
            {
                "ingredient_name": grain_name,
                "field": "amount",
                "current_value": 0,
                "suggested_value": final_amount,
                "unit": base_unit,
                "is_new_ingredient": True,
                "new_ingredient_data": {
                    "name": grain_name,
                    "type": "grain",
                    "grain_type": "specialty",
                    "color": grain_color,
                    "potential": 1.025,  # Very low gravity impact
                    "use": "mash",
                    "amount": final_amount,
                    "unit": base_unit,
                },
                "reason": f"Add {grain_name} for color adjustment with minimal OG impact",
            }
        )

        return changes

    def _suggest_small_abv_adjustment(
        self,
        target_og: float,
        current_og: float,
        abv_difference: float,
        recipe_data: Dict,
        unit_system: str,
    ) -> Dict:
        """Handle small ABV adjustments with fine-grained OG reduction"""
        og_reduction_needed = current_og - target_og
        logger.info(
            f"🔍 Small ABV Adjustment - OG reduction needed: {og_reduction_needed:.4f}"
        )

        # Find base malts
        base_malts = [
            ing
            for ing in recipe_data.get("ingredients", [])
            if ing.get("type") == "grain" and ing.get("grain_type") == "base_malt"
        ]

        if not base_malts:
            return None

        changes = []

        # For small adjustments, use a more sensitive approach
        # Target the highest-gravity base malt first for maximum efficiency
        base_malts_sorted = sorted(
            base_malts, key=lambda x: x.get("potential", 35), reverse=True
        )

        # Start with the highest-gravity base malt
        primary_malt = base_malts_sorted[0]
        current_amount = primary_malt.get("amount", 0)
        current_unit = primary_malt.get("unit", "g")

        # Convert to base unit
        current_amount_base, base_unit = self._convert_to_base_unit(
            current_amount, current_unit, unit_system
        )

        # Calculate a small but meaningful reduction
        # For 0.3% ABV reduction, try reducing highest-gravity malt by 2-5%
        if abs(abv_difference) <= 0.2:
            reduction_percent = 0.02  # 2% reduction
        elif abs(abv_difference) <= 0.4:
            reduction_percent = 0.03  # 3% reduction
        else:
            reduction_percent = 0.05  # 5% reduction

        new_amount_base = current_amount_base * (1 - reduction_percent)
        new_amount_base = self._round_to_brewing_increments(
            new_amount_base, unit_system
        )

        # Ensure minimum change threshold
        min_change = self._get_minimum_change_for_system(unit_system)
        if abs(new_amount_base - current_amount_base) >= min_change:
            changes.append(
                {
                    "ingredient_id": primary_malt.get("ingredient_id"),
                    "ingredient_name": primary_malt.get("name"),
                    "field": "amount",
                    "current_value": current_amount_base,
                    "suggested_value": new_amount_base,
                    "unit": base_unit,
                    "reason": f"Small reduction in {primary_malt.get('name')} to fine-tune ABV from {6.6:.1f}% to target range",
                }
            )

            logger.info(
                f"🔍 Small ABV Adjustment - Generated change: {primary_malt.get('name')} {current_amount_base} → {new_amount_base} {base_unit}"
            )
        else:
            logger.info(
                f"🔍 Small ABV Adjustment - Change too small: {abs(new_amount_base - current_amount_base)} < {min_change}"
            )

            # If single malt change is too small, try reducing multiple malts slightly
            for i, malt in enumerate(base_malts_sorted[:2]):  # Top 2 base malts
                current_amount = malt.get("amount", 0)
                current_unit = malt.get("unit", "g")

                current_amount_base, base_unit = self._convert_to_base_unit(
                    current_amount, current_unit, unit_system
                )

                # Use smaller reduction across multiple malts
                small_reduction = 0.015  # 1.5% reduction each
                new_amount_base = current_amount_base * (1 - small_reduction)
                new_amount_base = self._round_to_brewing_increments(
                    new_amount_base, unit_system
                )

                if abs(new_amount_base - current_amount_base) >= min_change:
                    changes.append(
                        {
                            "ingredient_id": malt.get("ingredient_id"),
                            "ingredient_name": malt.get("name"),
                            "field": "amount",
                            "current_value": current_amount_base,
                            "suggested_value": new_amount_base,
                            "unit": base_unit,
                            "reason": f"Fine-tune {malt.get('name')} amount for precise ABV control",
                        }
                    )

        if changes:
            return {
                "type": "abv_fine_tuning",
                "title": f"Fine-Tune ABV to Style Range",
                "description": f"Small base malt adjustments to bring ABV from 6.6% into Märzen range (≤6.3%)",
                "confidence": "high",
                "changes": changes,
                "priority": 4,
            }

        logger.info(f"🔍 Small ABV Adjustment - No meaningful changes possible")
        return None

    def _suggest_abv_via_yeast_adjustment(
        self,
        target_abv: float,
        current_abv: float,
        current_og: float,
        current_fg: float,
        recipe_data: Dict,
        unit_system: str,
    ) -> Dict:
        """Suggest yeast strain changes to adjust ABV via FG manipulation"""
        abv_difference = target_abv - current_abv  # Negative for reduction

        # Calculate target FG needed to achieve target ABV
        # ABV ≈ (OG - FG) * 131.25, so FG = OG - ABV/131.25
        target_fg = current_og - (target_abv / 131.25)

        # Calculate required attenuation change
        # Attenuation = (OG - FG) / (OG - 1.000) * 100
        current_attenuation = ((current_og - current_fg) / (current_og - 1.000)) * 100
        target_attenuation = ((current_og - target_fg) / (current_og - 1.000)) * 100
        attenuation_change = target_attenuation - current_attenuation

        # Find current yeast
        current_yeast = None
        for ing in recipe_data.get("ingredients", []):
            if ing.get("type") == "yeast":
                current_yeast = ing
                break

        if not current_yeast:
            return None

        current_yeast_attenuation = current_yeast.get("attenuation", 75)
        target_yeast_attenuation = current_yeast_attenuation + attenuation_change

        # Find appropriate yeast strain
        direction = "lower" if abv_difference < 0 else "higher"
        yeast_recommendations = self._get_yeast_recommendations(
            target_yeast_attenuation, direction, recipe_data
        )

        if not yeast_recommendations:
            return None

        changes = []

        # Recommend the best yeast option
        best_yeast = yeast_recommendations[0]
        best_yeast_name = best_yeast.get("name")
        best_yeast_attenuation = best_yeast.get("attenuation")

        # Calculate expected ABV with new yeast
        expected_fg = current_og - (
            (best_yeast_attenuation / 100) * (current_og - 1.000)
        )
        expected_abv = (current_og - expected_fg) * 131.25

        reason = (
            f"Switch from {current_yeast.get('name')} ({current_yeast_attenuation}% attenuation) "
            f"to {best_yeast_name} ({best_yeast_attenuation}% attenuation) to reduce ABV from "
            f"{current_abv:.1f}% to ~{target_abv:.1f}%"
        )

        changes.append(
            {
                "ingredient_id": current_yeast.get("ingredient_id"),
                "ingredient_name": current_yeast.get("name"),
                "field": "ingredient_id",  # Actually replace the yeast ingredient
                "current_value": current_yeast.get("ingredient_id"),
                "suggested_value": best_yeast.get("id"),  # Use the database yeast's ID
                "suggested_name": best_yeast_name,  # Also change the name
                "current_attenuation": current_yeast_attenuation,
                "suggested_attenuation": best_yeast_attenuation,
                "expected_abv": expected_abv,
                "reason": reason,
                "is_yeast_strain_change": True,
                "action": "substitute",  # Mark as substitution, not removal
                "new_yeast_data": best_yeast,  # Include full yeast data for replacement
            }
        )

        return {
            "type": "yeast_substitution",
            "title": f"Yeast Substitution for Target ABV ({target_abv:.1f}%)",
            "description": f"Replace yeast strain - use lower attenuation yeast to raise FG and reduce ABV while keeping OG in style range",
            "confidence": "high",
            "changes": changes,
            "priority": 5,
            "brewing_rationale": "Since OG is already in style range, adjusting yeast attenuation is the most appropriate way to fine-tune ABV",
        }

    def _calculate_base_malt_percentage(self, recipe_data: Dict) -> float:
        """Calculate what percentage of the grain bill is base malt"""
        ingredients = recipe_data.get("ingredients", [])
        total_grain_weight = 0
        base_malt_weight = 0

        for ing in ingredients:
            if ing.get("type") == "grain":
                weight_lb = convert_to_pounds(
                    ing.get("amount", 0), ing.get("unit", "lb")
                )
                total_grain_weight += weight_lb

                if ing.get("grain_type") == "base_malt":
                    base_malt_weight += weight_lb

        return (
            (base_malt_weight / total_grain_weight * 100)
            if total_grain_weight > 0
            else 0
        )

    def _filter_meaningful_suggestions(self, suggestions: List[Dict]) -> List[Dict]:
        """Filter out suggestions with minimal brewing impact and apply conservative limits"""
        meaningful = []

        for suggestion in suggestions:
            changes = suggestion.get("changes", [])
            has_meaningful_change = False

            # Apply conservative limits to all changes
            filtered_changes = []

            for change in changes:
                # Apply conservative change limits
                limited_change = self._apply_conservative_limits(change)
                if not limited_change:
                    continue

                current = limited_change.get("current_value", 0)
                suggested = limited_change.get("suggested_value", 0)
                unit = limited_change.get("unit", "lb")

                min_change = self._get_minimum_change(unit)

                # Only check numerical changes - skip for string values like yeast names
                if isinstance(suggested, (int, float)) and isinstance(
                    current, (int, float)
                ):
                    if abs(suggested - current) >= min_change:
                        has_meaningful_change = True
                        filtered_changes.append(limited_change)
                else:
                    # Non-numeric changes (like yeast names) are always meaningful
                    has_meaningful_change = True
                    filtered_changes.append(limited_change)

            # Update suggestion with filtered changes
            if has_meaningful_change or not changes:
                suggestion["changes"] = filtered_changes
                meaningful.append(suggestion)

        return meaningful

    def _apply_conservative_limits(self, change: Dict) -> Optional[Dict]:
        """Apply conservative brewing limits to ingredient changes"""
        field = change.get("field", "")
        current_value = change.get("current_value", 0)
        suggested_value = change.get("suggested_value", 0)
        unit = change.get("unit", "lb")

        # Skip non-amount changes (like yeast strain changes)
        if field not in ["amount", "time"]:
            return change

        if field == "amount":
            # Apply conservative grain addition limits (working in grams internally)
            # Only apply limits if we have numeric values
            if isinstance(suggested_value, (int, float)) and isinstance(
                current_value, (int, float)
            ):
                if change.get("is_new_ingredient", False):
                    # New ingredient - cap at reasonable brewing amounts (always in grams)
                    max_addition = 1000  # Max 1kg new grain (1000g)
                    suggested_value = min(suggested_value, max_addition)
                else:
                    # Existing ingredient - limit percentage change (working in grams)
                    if current_value > 0:
                        max_change_factor = 1.5  # Max 50% increase
                        min_change_factor = 0.5  # Max 50% decrease

                        max_suggested = current_value * max_change_factor
                        min_suggested = current_value * min_change_factor

                        suggested_value = max(
                            min_suggested, min(suggested_value, max_suggested)
                        )

        elif field == "time":
            # Limit hop time changes to reasonable ranges
            # Only apply limits if we have numeric values
            if isinstance(suggested_value, (int, float)):
                suggested_value = max(15, min(suggested_value, 90))  # 15-90 minutes

        # Ensure the change is still meaningful after limits
        # Only check numerical changes - skip for string values like yeast names
        if isinstance(suggested_value, (int, float)) and isinstance(
            current_value, (int, float)
        ):
            if abs(suggested_value - current_value) < self._get_minimum_change(unit):
                return None

        # Update the change with limited values
        limited_change = change.copy()
        limited_change["suggested_value"] = suggested_value

        # Add conservative brewing note
        if change.get("is_new_ingredient", False) and field == "amount":
            limited_change[
                "reason"
            ] += " (Conservative amount - you can always add more if needed)"

        return limited_change

    def _get_minimum_change(self, unit: str) -> float:
        """Get minimum meaningful change for different units (assuming grams internally)"""
        # Since we're working in grams internally, return gram-based minimums
        unit_minimums = {
            "g": 25,  # 25g minimum for meaningful grain changes
            "kg": 25,  # Still 25g minimum (stored as grams internally)
            "oz": 25,  # Still 25g minimum (stored as grams internally)
            "lb": 25,  # Still 25g minimum (stored as grams internally)
            "pkg": 1,  # 1 package minimum (for yeast)
            "tsp": 0.5,  # 0.5 tsp minimum (for other ingredients)
            "tbsp": 0.25,  # 0.25 tbsp minimum (for other ingredients)
        }
        return unit_minimums.get(unit.lower(), 25)

    def _convert_from_pounds(self, weight_lb: float, unit_system: str) -> float:
        """Convert weight from pounds to user's preferred unit system"""
        if unit_system == "metric":
            # Always use grams for consistency - avoids mixing g/kg in same recipe
            weight_g = weight_lb * 453.592
            return round(weight_g / 25) * 25  # Round to 25g increments
        else:
            # Imperial system
            if weight_lb < 0.25:
                return round(weight_lb * 16, 2)  # Convert to ounces
            else:
                return round(weight_lb, 2)

    def _get_preferred_unit(self, unit_system: str, weight_lb: float) -> str:
        """Get the preferred unit for display based on weight and system"""
        if unit_system == "metric":
            # Always use grams for consistency
            return "g"
        else:
            return "oz" if weight_lb < 0.25 else "lb"

    def _normalize_amount(self, amount: float, unit_system: str) -> float:
        """Normalize amount to brewing-friendly increments"""
        if unit_system == "metric":
            # Round to 25g increments for grams, 0.05kg for kg
            if amount < 1:  # Assuming kg
                return round(amount * 20) / 20  # 0.05kg increments
            else:  # Assuming grams
                return round(amount / 25) * 25  # 25g increments
        else:
            # Round to 0.25oz or 0.05lb increments
            if amount < 1:  # Assuming pounds
                return round(amount * 20) / 20  # 0.05lb increments
            else:  # Assuming ounces
                return round(amount * 4) / 4  # 0.25oz increments
