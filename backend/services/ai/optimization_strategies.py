"""
Optimization strategies for flowchart-based AI system.

This module provides concrete implementations of optimization strategies
that can be executed by the FlowchartEngine workflow nodes.
"""

import logging
import math
from copy import deepcopy
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:

    class RecipeContext:
        pass


logger = logging.getLogger(__name__)


class OptimizationStrategy:
    """Base class for optimization strategies."""

    def __init__(self, context: "RecipeContext"):
        self.context = context
        self.recipe = context.recipe
        self.metrics = context.metrics
        self.style_guidelines = context.style_guidelines

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute the optimization strategy."""
        raise NotImplementedError

    def _normalize_ingredient_amount(self, ingredient: Dict[str, Any]) -> float:
        """
        Normalize ingredient amount to base units for consistent calculations.

        This ensures that whether ingredients are stored in large units (kg/lb)
        or base units (g/oz), we work with consistent values.

        Returns amount in base units (grams for metric, ounces for imperial).
        """
        from utils.unit_conversions import UnitConverter

        amount = ingredient.get("amount", 0)
        unit = ingredient.get("unit", "g")

        # Detect unit system from the unit
        unit_lower = unit.lower()
        if unit_lower in ["g", "kg"]:
            # Metric system - normalize to grams
            return UnitConverter.convert_weight(amount, unit, "g")
        elif unit_lower in ["oz", "lb", "lbs"]:
            # Imperial system - normalize to ounces
            return UnitConverter.convert_weight(amount, unit, "oz")
        else:
            # Unknown unit - return as-is
            return amount

    def _denormalize_ingredient_amount(
        self, normalized_amount: float, original_ingredient: Dict[str, Any]
    ) -> float:
        """
        Convert normalized amount back to the original ingredient's unit.

        This ensures we return amounts in the same unit system as the original.
        """
        from utils.unit_conversions import UnitConverter

        original_unit = original_ingredient.get("unit", "g")
        unit_lower = original_unit.lower()

        if unit_lower in ["g", "kg"]:
            # Metric system - convert from grams back to original unit
            return UnitConverter.convert_weight(normalized_amount, "g", original_unit)
        elif unit_lower in ["oz", "lb", "lbs"]:
            # Imperial system - convert from ounces back to original unit
            return UnitConverter.convert_weight(normalized_amount, "oz", original_unit)
        else:
            # Unknown unit - return as-is
            return normalized_amount

    def _get_base_unit_for_ingredient(self, ingredient: Dict[str, Any]) -> str:
        """Get the appropriate base unit for an ingredient based on its current unit."""
        unit = ingredient.get("unit", "g")
        unit_lower = unit.lower()

        if unit_lower in ["g", "kg"]:
            return "g"  # Metric base unit
        elif unit_lower in ["oz", "lb", "lbs"]:
            return "oz"  # Imperial base unit
        else:
            return unit  # Keep unknown units as-is

    def _get_minimum_amount_in_base_units(
        self, ingredient_type: str, unit_system: str
    ) -> float:
        """Get minimum practical amount in base units for an ingredient type."""
        if unit_system == "metric":
            # Metric minimums (in grams)
            if ingredient_type == "grain":
                return 25.0  # 25g minimum
            elif ingredient_type == "hop":
                return 5.0  # 5g minimum
            else:
                return 10.0  # 10g general minimum
        else:
            # Imperial minimums (in ounces)
            if ingredient_type == "grain":
                return 0.5  # 0.5oz minimum
            elif ingredient_type == "hop":
                return 0.25  # 0.25oz minimum
            else:
                return 0.1  # 0.1oz general minimum

    def _get_increment_in_base_units(
        self, ingredient_type: str, unit_system: str
    ) -> float:
        """Get standard increment in base units for an ingredient type."""
        if unit_system == "metric":
            # Metric increments (in grams)
            if ingredient_type == "grain":
                return 25.0  # 25g increments
            elif ingredient_type == "hop":
                return 5.0  # 5g increments
            else:
                return 10.0  # 10g general increment
        else:
            # Imperial increments (in ounces)
            if ingredient_type == "grain":
                return 0.5  # 0.5oz increments
            elif ingredient_type == "hop":
                return 0.25  # 0.25oz increments
            else:
                return 0.1  # 0.1oz general increment

    def _find_ingredients_by_type(self, ingredient_type: str) -> List[Dict[str, Any]]:
        """Find all ingredients of a specific type."""
        ingredients = self.recipe.get("ingredients", [])
        return [ing for ing in ingredients if ing.get("type") == ingredient_type]

    def _find_ingredients_by_name_contains(
        self, name_parts: List[str]
    ) -> List[Dict[str, Any]]:
        """Find ingredients whose name contains any of the specified parts."""
        ingredients = self.recipe.get("ingredients", [])
        found = []
        for ingredient in ingredients:
            name = ingredient.get("name", "").lower()
            if any(part.lower() in name for part in name_parts):
                found.append(ingredient)
        return found

    def _get_style_range(self, metric: str) -> Optional[Dict[str, float]]:
        """Get style range for a specific metric."""
        if not self.style_guidelines:
            return None
        return self.style_guidelines.get("ranges", {}).get(metric)

    def _is_metric_in_range(self, metric: str) -> bool:
        """Check if a metric is within style range."""
        style_range = self._get_style_range(metric)
        if not style_range:
            return True

        current_value = self.metrics.get(metric, 0)
        return style_range.get("min", 0) <= current_value <= style_range.get("max", 999)

    def _calculate_target_from_style(
        self, metric: str, offset_percentage: float = 0
    ) -> float:
        """Calculate target value for a metric based on style guidelines."""
        style_range = self._get_style_range(metric)
        if not style_range:
            return self.metrics.get(metric, 0)

        min_val = style_range.get("min", 0)
        max_val = style_range.get("max", 999)

        if offset_percentage:
            # Calculate target as percentage offset from max (negative means below max)
            target = max_val + (max_val - min_val) * (offset_percentage / 100)
        else:
            # Default to middle of range
            target = (min_val + max_val) / 2

        return target


class BaseMaltOGOnlyStrategy(OptimizationStrategy):
    """Strategy for increasing base malt amounts to raise OG when SRM is already acceptable."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Proportionally increase all base malts to raise OG to target (25% above style minimum)."""
        parameters = parameters or {}
        increase_percentage = parameters.get("increase_percentage", 0.15)

        changes = []
        grains = self._find_ingredients_by_type("grain")
        base_malts = [g for g in grains if g.get("grain_type") == "base_malt"]

        if not base_malts:
            return changes

        # Calculate target OG (25% above style minimum)
        target_og = self._calculate_target_from_style("OG", 25)
        current_og = self.metrics.get("OG", 1.050)

        if current_og >= target_og:
            return changes  # Already at target

        # Calculate required increase percentage based on OG target
        og_points_current = (current_og - 1.0) * 1000
        og_points_target = (target_og - 1.0) * 1000

        # Handle edge case where current OG is essentially 1.0 (no grain contribution)
        if og_points_current <= 0.1:  # Very low or zero OG points
            required_increase = 2.0  # Default to 200% increase as a fallback
        else:
            required_increase = (og_points_target / og_points_current) - 1

        # Apply proportional increase to all base malts
        for grain in base_malts:
            current_amount = grain.get("amount", 0)

            # Normalize to base units for consistent calculations
            normalized_current = self._normalize_ingredient_amount(grain)
            normalized_new = normalized_current * (1 + required_increase)

            # Convert back to original units
            new_amount = self._denormalize_ingredient_amount(normalized_new, grain)

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": grain.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": grain.get("unit"),
                    "change_reason": f'Increased {grain.get("name")} proportionally to raise OG to target',
                }
            )

        return changes


class BaseMaltOGandSRMStrategy(OptimizationStrategy):
    """Strategy for increasing both OG and SRM by focusing on Munich Dark malt."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Increase OG and SRM by adding or increasing Munich Dark malt."""
        parameters = parameters or {}

        changes = []
        grains = self._find_ingredients_by_type("grain")
        base_malts = [g for g in grains if g.get("grain_type") == "base_malt"]

        if not base_malts:
            return changes

        # Calculate target OG (25% above style minimum)
        target_og = self._calculate_target_from_style("OG", 25)
        current_og = self.metrics.get("OG", 1.050)

        if current_og >= target_og:
            return changes  # Already at target

        # Search for existing Munich Dark in recipe
        munich_dark_grain = None
        for grain in base_malts:
            name = grain.get("name", "").lower()
            if "munich dark" in name:
                munich_dark_grain = grain
                break

        if munich_dark_grain:
            # Increase existing Munich Dark by a modest amount (let workflow iterate)
            current_amount = munich_dark_grain.get("amount", 0)

            # Use conservative 25% increase to avoid massive jumps
            increase_percentage = 0.25

            # Normalize to base units for consistent calculations
            normalized_current = self._normalize_ingredient_amount(munich_dark_grain)
            normalized_new = normalized_current * (1 + increase_percentage)

            # Convert back to original units
            new_amount = self._denormalize_ingredient_amount(
                normalized_new, munich_dark_grain
            )

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": munich_dark_grain.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": munich_dark_grain.get("unit"),
                    "change_reason": f"Increased Munich Dark by {increase_percentage*100:.0f}% to raise both OG and SRM",
                }
            )
        else:
            # Add Munich Dark as new ingredient
            from services.ingredient_lookup_service import get_ingredient_lookup_service

            lookup_service = get_ingredient_lookup_service()
            db_ingredient = lookup_service.find_ingredient_by_name("Munich Dark")

            if not db_ingredient:
                # Try alternative names if exact match fails
                alternative_names = ["Munich Malt", "Munich", "Munich Dark Malt"]
                for alt_name in alternative_names:
                    db_ingredient = lookup_service.find_ingredient_by_name(alt_name)
                    if db_ingredient:
                        break

            if db_ingredient:
                # Calculate Munich Dark amount needed - use conservative approach
                # Use normalized amounts for consistent calculation regardless of units
                total_grain_weight_normalized = sum(
                    self._normalize_ingredient_amount(g) for g in grains
                )

                # Determine the unit system from existing grains
                sample_grain = grains[0] if grains else {}
                grain_unit = sample_grain.get("unit", "lb")
                unit_system = (
                    "metric" if grain_unit.lower() in ["g", "kg"] else "imperial"
                )

                # Calculate amount in base units (5% of total or minimum, whichever is larger)
                munich_amount_normalized = max(
                    total_grain_weight_normalized * 0.05,
                    self._get_minimum_amount_in_base_units("grain", unit_system),
                )

                # Convert to appropriate display unit for the recipe
                if unit_system == "metric":
                    # Convert to grams or kg based on amount size
                    if munich_amount_normalized >= 500:
                        munich_amount = munich_amount_normalized / 1000
                        target_unit = "kg"
                    else:
                        munich_amount = munich_amount_normalized
                        target_unit = "g"
                else:
                    # Convert to ounces or pounds based on amount size
                    if munich_amount_normalized >= 8:
                        munich_amount = munich_amount_normalized / 16
                        target_unit = "lb"
                    else:
                        munich_amount = munich_amount_normalized
                        target_unit = "oz"

                changes.append(
                    {
                        "type": "ingredient_added",
                        "ingredient_name": db_ingredient.get("name", "Munich Dark"),
                        "ingredient_data": {
                            "ingredient_id": db_ingredient.get("ingredient_id"),
                            "name": db_ingredient.get("name", "Munich Dark"),
                            "type": db_ingredient.get("type", "grain"),
                            "grain_type": db_ingredient.get("grain_type", "base_malt"),
                            "amount": munich_amount,
                            "unit": target_unit,
                            "potential": db_ingredient.get("potential", 37),
                            "color": db_ingredient.get("color", 12),
                            "use": "mash",
                            "time": 0,
                        },
                        "change_reason": "Added Munich Dark to increase both OG and SRM",
                    }
                )
            else:
                logger.warning(
                    "Could not find Munich Dark ingredient in database for BaseMaltOGandSRMStrategy"
                )

        return changes


class BaseMaltIncreaseStrategy(OptimizationStrategy):
    """Legacy strategy for increasing base malt amounts to raise OG (maintained for backward compatibility)."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Increase base malt amounts to raise OG."""
        # Default to OG-only strategy for backward compatibility
        strategy = BaseMaltOGOnlyStrategy(self.context)
        return strategy.execute(parameters)


class BaseMaltReductionStrategy(OptimizationStrategy):
    """Strategy for reducing base malt amounts to lower OG."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Reduce base malt amounts to lower OG."""
        parameters = parameters or {}
        reduction_target = parameters.get(
            "reduction_target", "25_percent_below_style_max"
        )
        maintain_malt_ratios = parameters.get("maintain_malt_ratios", True)

        changes = []
        grains = self._find_ingredients_by_type("grain")
        base_malts = [g for g in grains if g.get("grain_type") == "base_malt"]

        if not base_malts:
            return changes

        # Calculate target OG
        target_og = self._calculate_target_og(reduction_target)
        current_og = self.metrics.get("OG", 1.050)

        if target_og >= current_og:
            return changes  # No reduction needed

        # Calculate reduction percentage needed
        # Simplified approximation: OG reduction is roughly proportional to base malt reduction
        og_reduction_needed = current_og - target_og
        current_og_points = (current_og - 1.0) * 1000
        target_og_points = (target_og - 1.0) * 1000
        reduction_percentage = 1 - (target_og_points / current_og_points)

        if maintain_malt_ratios:
            # Reduce all base malts proportionally
            for grain in base_malts:
                current_amount = grain.get("amount", 0)

                # Normalize to base units for consistent calculations
                normalized_current = self._normalize_ingredient_amount(grain)
                normalized_new = normalized_current * (1 - reduction_percentage)

                # Determine unit system and apply appropriate minimum
                unit_system = (
                    "metric"
                    if grain.get("unit", "").lower() in ["g", "kg"]
                    else "imperial"
                )
                min_amount_normalized = self._get_minimum_amount_in_base_units(
                    "grain", unit_system
                )

                # Ensure we don't go below practical minimum
                normalized_new = max(normalized_new, min_amount_normalized)

                # Convert back to original units
                new_amount = self._denormalize_ingredient_amount(normalized_new, grain)

                changes.append(
                    {
                        "type": "ingredient_modified",
                        "ingredient_name": grain.get("name"),
                        "field": "amount",
                        "current_value": current_amount,
                        "new_value": new_amount,
                        "unit": grain.get("unit"),
                        "change_reason": f'Reduced {grain.get("name")} to target OG 25% below style maximum',
                    }
                )

        return changes

    def _calculate_target_og(self, reduction_target: str) -> float:
        """Calculate target OG based on reduction strategy."""
        og_range = self._get_style_range("OG")
        if not og_range:
            return self.metrics.get("OG", 1.050)

        max_og = og_range.get("max", 1.070)
        min_og = og_range.get("min", 1.040)

        if reduction_target == "25_percent_below_style_max":
            # Target 25% below style maximum
            range_size = max_og - min_og
            return max_og - (range_size * 0.25)
        else:
            # Default to middle of range
            return (min_og + max_og) / 2


class ABVTargetedStrategy(OptimizationStrategy):
    """Strategy for adjusting base malts to target a specific ABV (usually midpoint of style range)."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Adjust base malts to target ABV - only if outside style range."""
        parameters = parameters or {}
        direction = parameters.get("direction", "decrease")  # "increase" or "decrease"

        changes = []
        grains = self._find_ingredients_by_type("grain")
        base_malts = [g for g in grains if g.get("grain_type") == "base_malt"]

        if not base_malts:
            return changes

        current_abv = self.metrics.get("ABV", 5.0)
        current_og = self.metrics.get("OG", 1.050)
        current_fg = self.metrics.get("FG", 1.010)

        # Check if ABV is already within style range
        style_ranges = self.style_guidelines.get("ranges", {})
        abv_range = style_ranges.get("ABV", {})
        abv_min = abv_range.get("min", 0)
        abv_max = abv_range.get("max", 20)

        # Only adjust if ABV is outside the style range
        if abv_min <= current_abv <= abv_max:
            return changes  # ABV is within range, no adjustment needed

        # Calculate target ABV (midpoint of style range) only if out of range
        target_abv = self._calculate_target_abv_midpoint()

        if abs(current_abv - target_abv) < 0.1:  # Within 0.1% tolerance
            return changes

        # Calculate required OG to achieve target ABV
        # ABV = (OG - FG) × 131.25, so OG = (ABV / 131.25) + FG
        target_og = (target_abv / 131.25) + current_fg

        if abs(current_og - target_og) < 0.001:  # Within 1 gravity point
            return changes

        # Calculate required adjustment percentage
        og_points_current = (current_og - 1.0) * 1000
        og_points_target = (target_og - 1.0) * 1000

        if og_points_current <= 0.1:
            return changes  # Avoid division by zero

        adjustment_factor = (og_points_target / og_points_current) - 1

        # Cap adjustment to prevent massive changes
        max_adjustment = 0.15  # 15% max change per iteration
        adjustment_factor = max(-max_adjustment, min(max_adjustment, adjustment_factor))

        # Apply adjustment to all base malts proportionally
        for grain in base_malts:
            current_amount = grain.get("amount", 0)

            # Normalize to base units for consistent calculations
            normalized_current = self._normalize_ingredient_amount(grain)
            normalized_new = normalized_current * (1 + adjustment_factor)

            # Determine unit system and apply appropriate minimum
            unit_system = (
                "metric" if grain.get("unit", "").lower() in ["g", "kg"] else "imperial"
            )
            min_amount_normalized = self._get_minimum_amount_in_base_units(
                "grain", unit_system
            )

            # Ensure we don't go below practical minimum
            normalized_new = max(normalized_new, min_amount_normalized)

            # Convert back to original units
            new_amount = self._denormalize_ingredient_amount(normalized_new, grain)

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": grain.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": grain.get("unit"),
                    "change_reason": f'Adjusted {grain.get("name")} to target ABV {target_abv:.1f}%',
                }
            )

        return changes

    def _calculate_target_abv_midpoint(self) -> float:
        """Calculate target ABV as midpoint of style range."""
        abv_range = self._get_style_range("ABV")
        if not abv_range:
            return self.metrics.get("ABV", 5.0)

        min_abv = abv_range.get("min", 4.0)
        max_abv = abv_range.get("max", 6.0)

        return (min_abv + max_abv) / 2


class RoastedMaltIncreaseStrategy(OptimizationStrategy):
    """Strategy for increasing roasted malt amounts to raise SRM when no caramel malts are available."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Increase or add roasted malt amounts to raise SRM to target (25% above style minimum)."""
        parameters = parameters or {}

        changes = []
        grains = self._find_ingredients_by_type("grain")
        roasted_malts = [g for g in grains if g.get("grain_type") == "roasted"]

        # Calculate target SRM (25% above style minimum)
        target_srm = self._calculate_target_from_style("SRM", 25)
        current_srm = self.metrics.get("SRM", 10)

        if current_srm >= target_srm:
            return changes  # Already at or above target

        if roasted_malts:
            # Increase existing roasted malt quantities
            for grain in roasted_malts:
                current_amount = grain.get("amount", 0)
                # Calculate required increase to reach target SRM
                # Simplified: increase by percentage that should bring SRM to target
                srm_increase_needed = target_srm - current_srm
                increase_factor = min(
                    srm_increase_needed / current_srm, 0.5
                )  # Cap at 50% increase

                # Normalize to base units for consistent calculations
                normalized_current = self._normalize_ingredient_amount(grain)
                normalized_new = normalized_current * (1 + increase_factor)

                # Convert back to original units
                new_amount = self._denormalize_ingredient_amount(normalized_new, grain)

                changes.append(
                    {
                        "type": "ingredient_modified",
                        "ingredient_name": grain.get("name"),
                        "field": "amount",
                        "current_value": current_amount,
                        "new_value": new_amount,
                        "unit": grain.get("unit"),
                        "change_reason": f'Increased {grain.get("name")} to raise SRM to target',
                    }
                )
        else:
            # No roasted malts exist - add the darkest roasted grain from database
            from services.ingredient_lookup_service import get_ingredient_lookup_service

            lookup_service = get_ingredient_lookup_service()
            darkest_roasted = lookup_service.find_darkest_roasted_grain()

            if darkest_roasted:
                # Calculate minimum amount needed - use conservative approach
                # Use normalized amounts for consistent calculation regardless of units
                total_grain_weight_normalized = sum(
                    self._normalize_ingredient_amount(g) for g in grains
                )

                # Determine the unit system from existing grains
                sample_grain = grains[0] if grains else {}
                grain_unit = sample_grain.get("unit", "lb")
                unit_system = (
                    "metric" if grain_unit.lower() in ["g", "kg"] else "imperial"
                )

                # Calculate amount in base units (1% of total or minimum, whichever is larger)
                roasted_amount_normalized = max(
                    total_grain_weight_normalized * 0.01,
                    self._get_minimum_amount_in_base_units("grain", unit_system),
                )

                # Convert to appropriate display unit for the recipe
                if unit_system == "metric":
                    # For roasted grains, usually keep in grams
                    roasted_amount = roasted_amount_normalized
                    target_unit = "g"
                else:
                    # For imperial, use ounces for small amounts
                    roasted_amount = roasted_amount_normalized
                    target_unit = "oz"

                changes.append(
                    {
                        "type": "ingredient_added",
                        "ingredient_name": darkest_roasted.get(
                            "name", "Midnight Wheat"
                        ),
                        "ingredient_data": {
                            "ingredient_id": darkest_roasted.get("ingredient_id"),
                            "name": darkest_roasted.get("name", "Midnight Wheat"),
                            "type": darkest_roasted.get("type", "grain"),
                            "grain_type": darkest_roasted.get("grain_type", "roasted"),
                            "amount": roasted_amount,
                            "unit": target_unit,
                            "potential": darkest_roasted.get("potential", 25),
                            "color": darkest_roasted.get("color", 550),
                            "use": "mash",
                            "time": 0,
                        },
                        "change_reason": f'Added {darkest_roasted.get("name", "darkest roasted grain")} to increase SRM',
                    }
                )
            else:
                logger.warning(
                    "Could not find darkest roasted grain in database for RoastedMaltIncreaseStrategy"
                )

        return changes


class RoastedMaltDecreaseStrategy(OptimizationStrategy):
    """Strategy for reducing roasted malt amounts to lower SRM when no caramel malts are available."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Reduce or remove roasted malt amounts to lower SRM to target (25% below style maximum)."""
        parameters = parameters or {}

        changes = []
        grains = self._find_ingredients_by_type("grain")
        roasted_malts = [g for g in grains if g.get("grain_type") == "roasted"]

        if not roasted_malts:
            return changes  # No roasted malts to reduce

        # Calculate target SRM (25% below style maximum)
        target_srm = self._calculate_target_from_style("SRM", -25)
        current_srm = self.metrics.get("SRM", 10)

        if current_srm <= target_srm:
            return changes  # Already at or below target

        # Reduce roasted malt quantities
        for grain in roasted_malts:
            current_amount = grain.get("amount", 0)

            # Calculate required reduction to reach target SRM
            srm_reduction_needed = current_srm - target_srm
            reduction_factor = min(
                srm_reduction_needed / current_srm, 0.8
            )  # Cap reduction

            # Normalize to base units for consistent calculations
            normalized_current = self._normalize_ingredient_amount(grain)
            normalized_new = normalized_current * (1 - reduction_factor)

            # Determine unit system for minimum amount checking
            unit_system = (
                "metric" if grain.get("unit", "").lower() in ["g", "kg"] else "imperial"
            )
            min_amount_normalized = self._get_minimum_amount_in_base_units(
                "grain", unit_system
            )

            # Allow reduction to very small amounts
            normalized_new = max(
                normalized_new, min_amount_normalized * 0.1
            )  # 10% of minimum

            # If reducing to very small amount, remove completely
            if normalized_new < min_amount_normalized * 0.5:  # Less than 50% of minimum
                changes.append(
                    {
                        "type": "ingredient_removed",
                        "ingredient_name": grain.get("name"),
                        "change_reason": f'Removed {grain.get("name")} to reduce SRM to target',
                    }
                )
            else:
                # Convert back to original units
                new_amount = self._denormalize_ingredient_amount(normalized_new, grain)

                changes.append(
                    {
                        "type": "ingredient_modified",
                        "ingredient_name": grain.get("name"),
                        "field": "amount",
                        "current_value": current_amount,
                        "new_value": new_amount,
                        "unit": grain.get("unit"),
                        "change_reason": f'Reduced {grain.get("name")} to lower SRM to target',
                    }
                )

        return changes


class CaramelMaltSwapStrategy(OptimizationStrategy):
    """Strategy for swapping caramel malts to adjust SRM using database lookup."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Swap caramel malts for SRM adjustment using proper database substitution."""
        parameters = parameters or {}
        direction = parameters.get("direction", "lighter_to_darker")

        changes = []

        # Import IngredientLookupService
        from services.ingredient_lookup_service import get_ingredient_lookup_service

        lookup_service = get_ingredient_lookup_service()

        caramel_names = [
            "caramel",
            "crystal",
            "cara",
        ]
        caramel_malts = self._find_ingredients_by_name_contains(caramel_names)

        if not caramel_malts:
            return changes

        for caramel in caramel_malts:
            # Get the full ingredient data from database
            ingredient_id = caramel.get("ingredient_id")
            if not ingredient_id:
                continue

            # Find the actual database ingredient
            db_ingredient = lookup_service.find_ingredient_by_id(ingredient_id)
            if not db_ingredient:
                continue

            # Find similar caramel malts in the desired direction
            similar_malts = lookup_service.find_similar_caramel_malts(
                db_ingredient, direction=direction
            )

            if similar_malts:
                # Take the best match (first in sorted list)
                best_substitute = similar_malts[0]

                # Create recipe context from current ingredient
                recipe_context = {
                    "amount": caramel.get("amount"),
                    "unit": caramel.get("unit"),
                    "use": caramel.get("use"),
                    "time": caramel.get("time"),
                }

                # Calculate confidence based on color difference
                current_color = db_ingredient.get("color", 40)
                new_color = best_substitute.get("color", 40)
                color_diff = abs(new_color - current_color)
                confidence = max(
                    0.5, 1.0 - (color_diff / 100)
                )  # Scale confidence by color difference

                substitution_reason = f"Adjust SRM {direction.replace('_', ' ')} (color: {current_color}L → {new_color}L)"

                # Create proper substitution change
                substitution_change = lookup_service.create_substitution_change(
                    old_ingredient=db_ingredient,
                    new_ingredient=best_substitute,
                    recipe_context=recipe_context,
                    substitution_reason=substitution_reason,
                    confidence_score=confidence,
                )

                changes.append(substitution_change)

        return changes


class HopIBUAdjustmentStrategy(OptimizationStrategy):
    """Strategy for adjusting hop quantities and timing to meet IBU targets."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Adjust hop quantities and timing for IBU targets."""
        parameters = parameters or {}
        strategy_type = parameters.get("strategy", "increase_time_then_amount")

        # Use recipe's actual boil time as the maximum time limit, not hardcoded value
        recipe_boil_time = self.recipe.get("boil_time", 60)
        max_time = min(parameters.get("max_time", 60), recipe_boil_time)

        min_amount = parameters.get("min_amount", 0.25)
        amount_increment = parameters.get("amount_increment", 0.25)

        changes = []
        hops = self._find_ingredients_by_type("hop")

        # Only consider boil hops for timing adjustments
        # Whirlpool, dry hop, and other usage types should not have their timing modified
        bittering_hops = [
            h for h in hops if h.get("use") == "boil" and h.get("time", 0) >= 30
        ]

        if not bittering_hops:
            # If no boil hops available, try to adjust amounts of other hop types without changing timing
            other_hops = [h for h in hops if h.get("use") != "boil"]
            if other_hops and strategy_type in [
                "increase_time_then_amount",
                "reduce_amount_then_time",
            ]:
                # Find highest contributing non-boil hop using simple amount * alpha_acid calculation
                # (no time factor since these aren't boil hops)
                highest_other_hop = self._find_highest_non_boil_hop(other_hops)
                if highest_other_hop:
                    current_ibu = self.metrics.get("IBU", 0)
                    target_ibu = self._calculate_target_ibu()

                    if (
                        strategy_type == "increase_time_then_amount"
                        and current_ibu < target_ibu
                    ):
                        changes.extend(
                            self._increase_hop_amount_only(
                                highest_other_hop, amount_increment
                            )
                        )
                    elif (
                        strategy_type == "reduce_amount_then_time"
                        and current_ibu > target_ibu
                    ):
                        changes.extend(
                            self._reduce_hop_amount_only(highest_other_hop, min_amount)
                        )
            return changes

        # Find the hop with highest IBU contribution
        highest_ibu_hop = self._find_highest_ibu_hop(bittering_hops)
        if not highest_ibu_hop:
            return changes

        # SAFETY CHECK: Ensure we only modify boil hops
        if highest_ibu_hop.get("use") != "boil":
            logger.warning(
                f"HopIBUAdjustmentStrategy: Attempted to modify non-boil hop {highest_ibu_hop.get('name')} ({highest_ibu_hop.get('use')}). Skipping."
            )
            return changes

        current_ibu = self.metrics.get("IBU", 0)
        target_ibu = self._calculate_target_ibu()

        if strategy_type == "increase_time_then_amount":
            if current_ibu < target_ibu:
                changes.extend(
                    self._increase_hop_ibu(
                        highest_ibu_hop, target_ibu, max_time, amount_increment
                    )
                )

        elif strategy_type == "reduce_amount_then_time":
            if current_ibu > target_ibu:
                changes.extend(
                    self._reduce_hop_ibu(highest_ibu_hop, target_ibu, min_amount)
                )

        return changes

    def _find_highest_ibu_hop(
        self, hops: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Find the hop with highest IBU contribution among BOIL HOPS ONLY.

        This function should ONLY be called with boil hops.
        Whirlpool, dry hop, and other usage types have different IBU calculations
        and should not be processed by this function.
        """
        if not hops:
            return None

        # Filter to ensure we only process boil hops - safety check
        boil_hops = [h for h in hops if h.get("use") == "boil"]
        if not boil_hops:
            return None

        # Simplified IBU contribution calculation for BOIL HOPS ONLY
        best_hop = None
        best_contribution = 0

        for hop in boil_hops:
            amount = hop.get("amount", 0)
            alpha_acid = hop.get("alpha_acid", 5.0)
            time = hop.get("time", 60)

            # Boil time utilization approximation (only valid for boil hops)
            time_factor = min(time / 60, 1.0)
            contribution = amount * alpha_acid * time_factor

            if contribution > best_contribution:
                best_contribution = contribution
                best_hop = hop

        return best_hop

    def _find_highest_non_boil_hop(
        self, hops: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Find the hop with highest IBU contribution among NON-BOIL HOPS.

        This uses a simplified calculation since whirlpool/dry hop IBU contribution
        is calculated differently than boil hops.
        """
        if not hops:
            return None

        # Simplified IBU contribution calculation for NON-BOIL HOPS
        best_hop = None
        best_contribution = 0

        for hop in hops:
            amount = hop.get("amount", 0)
            alpha_acid = hop.get("alpha_acid", 5.0)

            # For non-boil hops, use simple amount * alpha_acid
            # (no time factor since these have different IBU contribution models)
            contribution = amount * alpha_acid

            if contribution > best_contribution:
                best_contribution = contribution
                best_hop = hop

        return best_hop

    def _calculate_target_ibu(self) -> float:
        """Calculate target IBU from style guidelines."""
        ibu_range = self._get_style_range("IBU")
        if not ibu_range:
            return self.metrics.get("IBU", 20)

        # Target middle of range
        return (ibu_range.get("min", 10) + ibu_range.get("max", 40)) / 2

    def _increase_hop_ibu(
        self,
        hop: Dict[str, Any],
        target_ibu: float,
        max_time: int,
        amount_increment: float,
    ) -> List[Dict[str, Any]]:
        """Increase hop IBU contribution."""
        changes = []
        current_time = hop.get("time", 60)
        current_amount = hop.get("amount", 0)
        hop_use = hop.get("use", "boil")
        hop_name = hop.get("name", "unknown")

        # CRITICAL SAFETY CHECK: This function should ONLY receive boil hops
        if hop_use != "boil":
            logger.error(
                f"_increase_hop_ibu called with non-boil hop: {hop_name} ({hop_use}). This should never happen!"
            )
            return changes

        # Only increase time for boil hops - never modify timing for whirlpool, dry hop, etc.
        if current_time < max_time and hop_use == "boil":
            new_time = min(current_time + 15, max_time)  # Increase by 15 minutes
            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "time",
                    "current_value": current_time,
                    "new_value": new_time,
                    "unit": "min",
                    "change_reason": f'Increased {hop.get("name")} boil time to {new_time} min for higher IBU',
                }
            )
        else:
            # Increase amount (for both boil hops at max time and non-boil hops)
            # Normalize to base units for consistent calculations
            normalized_current = self._normalize_ingredient_amount(hop)
            unit_system = (
                "metric" if hop.get("unit", "").lower() in ["g"] else "imperial"
            )
            increment_normalized = self._get_increment_in_base_units("hop", unit_system)
            normalized_new = normalized_current + increment_normalized

            # Convert back to original units
            new_amount = self._denormalize_ingredient_amount(normalized_new, hop)

            # Preserve timing context for non-boil hops
            if hop_use != "boil":
                hop_time = hop.get("time", "")
                timing_info = f"{hop_time} min" if hop_time else ""
                change_reason = f'Increased {hop.get("name")} amount to {new_amount} {hop.get("unit")} for higher IBU (timing preserved: {hop_use} {timing_info})'
            else:
                change_reason = f'Increased {hop.get("name")} amount to {new_amount} {hop.get("unit")} for higher IBU'

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": hop.get("unit"),
                    "change_reason": change_reason,
                }
            )

        return changes

    def _reduce_hop_ibu(
        self, hop: Dict[str, Any], target_ibu: float, min_amount: float
    ) -> List[Dict[str, Any]]:
        """Reduce hop IBU contribution."""
        changes = []
        current_amount = hop.get("amount", 0)
        current_time = hop.get("time", 60)
        hop_use = hop.get("use", "boil")
        hop_name = hop.get("name", "unknown")
        unit_system = hop.get("unit", "oz")

        # CRITICAL SAFETY CHECK: This function should ONLY receive boil hops
        if hop_use != "boil":
            logger.error(
                f"_reduce_hop_ibu called with non-boil hop: {hop_name} ({hop_use}). This should never happen!"
            )
            return changes
        # Normalize to base units for consistent calculations
        normalized_current = self._normalize_ingredient_amount(hop)
        unit_system_detected = (
            "metric" if hop.get("unit", "").lower() in ["g"] else "imperial"
        )
        increment_normalized = self._get_increment_in_base_units(
            "hop", unit_system_detected
        )
        min_amount_normalized = self._get_minimum_amount_in_base_units(
            "hop", unit_system_detected
        )

        # Try reducing amount first (if above minimum)
        if normalized_current > min_amount_normalized:
            normalized_new = max(
                normalized_current - increment_normalized, min_amount_normalized
            )
            new_amount = self._denormalize_ingredient_amount(normalized_new, hop)

            # Preserve timing context for non-boil hops
            if hop_use != "boil":
                hop_time = hop.get("time", "")
                timing_info = f"{hop_time} min" if hop_time else ""
                change_reason = f'Reduced {hop.get("name")} amount to {new_amount} {hop.get("unit")} for lower IBU (timing preserved: {hop_use} {timing_info})'
            else:
                change_reason = f'Reduced {hop.get("name")} amount to {new_amount} {hop.get("unit")} for lower IBU'

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": hop.get("unit"),
                    "change_reason": change_reason,
                }
            )
        elif current_time > 15 and hop_use == "boil":
            # Only reduce time for boil hops - never modify timing for whirlpool, dry hop, etc.
            new_time = max(current_time - 10, 15)
            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "time",
                    "current_value": current_time,
                    "new_value": new_time,
                    "unit": "min",
                    "change_reason": f'Reduced {hop.get("name")} boil time to {new_time} min for lower IBU',
                }
            )
        # If it's a non-boil hop at minimum amount, we can't reduce it further without changing usage type
        # which we should never do - just return empty changes

        return changes

    def _increase_hop_amount_only(
        self, hop: Dict[str, Any], amount_increment: float
    ) -> List[Dict[str, Any]]:
        """Increase hop amount without changing timing (for non-boil hops like whirlpool, dry hop)."""
        changes = []
        current_amount = hop.get("amount", 0)

        # Normalize to base units for consistent calculations
        normalized_current = self._normalize_ingredient_amount(hop)
        unit_system = "metric" if hop.get("unit", "").lower() in ["g"] else "imperial"
        increment_normalized = self._get_increment_in_base_units("hop", unit_system)
        normalized_new = normalized_current + increment_normalized

        # Convert back to original units
        new_amount = self._denormalize_ingredient_amount(normalized_new, hop)

        hop_use = hop.get("use", "unknown")
        hop_time = hop.get("time", "")
        timing_info = f"{hop_time} min" if hop_time else ""

        changes.append(
            {
                "type": "ingredient_modified",
                "ingredient_name": hop.get("name"),
                "field": "amount",
                "current_value": current_amount,
                "new_value": new_amount,
                "unit": hop.get("unit"),
                "change_reason": f'Increased {hop.get("name")} amount to {new_amount} {hop.get("unit")} for higher IBU (timing preserved: {hop_use} {timing_info})',
            }
        )
        return changes

    def _reduce_hop_amount_only(
        self, hop: Dict[str, Any], min_amount: float
    ) -> List[Dict[str, Any]]:
        """Reduce hop amount without changing timing (for non-boil hops like whirlpool, dry hop)."""
        changes = []
        current_amount = hop.get("amount", 0)

        # Normalize to base units for consistent calculations
        normalized_current = self._normalize_ingredient_amount(hop)
        unit_system = "metric" if hop.get("unit", "").lower() in ["g"] else "imperial"
        increment_normalized = self._get_increment_in_base_units("hop", unit_system)
        min_amount_normalized = self._get_minimum_amount_in_base_units(
            "hop", unit_system
        )

        normalized_new = max(
            normalized_current - increment_normalized, min_amount_normalized
        )

        if normalized_new != normalized_current:
            # Convert back to original units
            new_amount = self._denormalize_ingredient_amount(normalized_new, hop)

            hop_use = hop.get("use", "unknown")
            hop_time = hop.get("time", "")
            timing_info = f"{hop_time} min" if hop_time else ""

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": hop.get("unit"),
                    "change_reason": f'Reduced {hop.get("name")} amount to {new_amount} {hop.get("unit")} for lower IBU (timing preserved: {hop_use} {timing_info})',
                }
            )
        return changes


class YeastSubstitutionStrategy(OptimizationStrategy):
    """Strategy for substituting yeast to achieve target attenuation using database lookup."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Substitute yeast for target attenuation using proper database substitution."""
        parameters = parameters or {}
        target_attenuation = parameters.get("target_attenuation", "higher")
        maintain_style_compliance = parameters.get("maintain_style_compliance", True)
        target_yeast_type = parameters.get(
            "target_yeast_type"
        )  # Optional yeast type filter

        changes = []

        # Import IngredientLookupService
        from services.ingredient_lookup_service import get_ingredient_lookup_service

        lookup_service = get_ingredient_lookup_service()

        yeasts = self._find_ingredients_by_type("yeast")

        if not yeasts:
            return changes

        current_yeast = yeasts[0]  # Assume first yeast is primary
        current_attenuation = current_yeast.get("attenuation", 75)

        # Determine target attenuation percentage
        if target_attenuation == "higher":
            target_percent = min(current_attenuation + 5, 85)  # Increase by 5%, max 85%
        elif target_attenuation == "lower":
            target_percent = max(current_attenuation - 5, 65)  # Decrease by 5%, min 65%
        else:
            # If target_attenuation is a number, use it directly
            try:
                target_percent = float(target_attenuation)
            except (ValueError, TypeError):
                target_percent = current_attenuation

        # Get the full ingredient data from database
        ingredient_id = current_yeast.get("ingredient_id")
        if not ingredient_id:
            return changes

        db_ingredient = lookup_service.find_ingredient_by_id(ingredient_id)
        if not db_ingredient:
            return changes

        # Find similar yeasts with target attenuation and type
        style_requirements = {}
        if maintain_style_compliance:
            # Extract style requirements from context if available
            style_requirements = self.style_guidelines.get("requirements", {})

        similar_yeasts = lookup_service.find_similar_yeasts(
            current_yeast=db_ingredient,
            target_attenuation=target_percent,
            target_yeast_type=target_yeast_type,
            style_requirements=style_requirements,
        )

        if similar_yeasts:
            # Take the best match (highest confidence)
            best_substitute, confidence = similar_yeasts[0]

            # Only substitute if confidence is reasonable
            if confidence >= 0.4:
                # Create recipe context from current ingredient
                recipe_context = {
                    "amount": current_yeast.get("amount"),
                    "unit": current_yeast.get("unit"),
                    "use": current_yeast.get("use"),
                    "time": current_yeast.get("time"),
                }

                # Create substitution reason
                current_att = db_ingredient.get("attenuation", 75)
                new_att = best_substitute.get("attenuation", 75)
                current_type = db_ingredient.get("yeast_type", "unknown")
                new_type = best_substitute.get("yeast_type", "unknown")

                substitution_reason = f"Target attenuation {target_percent}% (current: {current_att}%, new: {new_att}%)"
                if current_type != new_type:
                    substitution_reason += f", yeast type: {current_type} → {new_type}"

                # Create proper substitution change
                substitution_change = lookup_service.create_substitution_change(
                    old_ingredient=db_ingredient,
                    new_ingredient=best_substitute,
                    recipe_context=recipe_context,
                    substitution_reason=substitution_reason,
                    confidence_score=confidence,
                )

                changes.append(substitution_change)

        return changes


class NormalizeAmountsStrategy(OptimizationStrategy):
    """Strategy for normalizing ingredient amounts to brewing-friendly increments."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Normalize ingredient amounts to brewing increments."""
        changes = []
        ingredients = self.recipe.get("ingredients", [])

        for ingredient in ingredients:
            current_amount = ingredient.get("amount", 0)
            unit = ingredient.get("unit", "lb")

            normalized_amount = self._normalize_amount(current_amount, unit)

            if normalized_amount != current_amount:
                changes.append(
                    {
                        "type": "ingredient_modified",
                        "ingredient_name": ingredient.get("name"),
                        "field": "amount",
                        "current_value": current_amount,
                        "new_value": normalized_amount,
                        "unit": unit,
                        "change_reason": f'Normalized {ingredient.get("name")} amount to brewing increment',
                    }
                )

        return changes

    def _normalize_amount(self, amount: float, unit: str) -> float:
        """Normalize amount to brewing-friendly increment."""
        if unit in ["lb", "lbs", "pound", "pounds"]:
            if amount < 1:
                return round(amount * 4) / 4  # Quarter pound increments
            else:
                return round(amount * 2) / 2  # Half pound increments

        elif unit in ["oz", "ounces"]:
            if amount < 2:
                return round(amount * 4) / 4  # Quarter ounce increments
            else:
                return round(amount * 2) / 2  # Half ounce increments

        elif unit in ["kg", "kilograms"]:
            if amount < 0.5:
                return round(amount * 20) / 20  # 50g increments
            else:
                return round(amount * 10) / 10  # 100g increments

        elif unit in ["g", "grams"]:
            if amount < 100:
                return round(amount / 25) * 25  # 25g increments
            else:
                return round(amount / 50) * 50  # 50g increments

        else:
            return round(amount, 2)


class MashTemperatureAdjustmentStrategy(OptimizationStrategy):
    """
    Research-backed strategy for adjusting mash temperature to achieve target FG through fermentability control.

    Based on scientific literature:
    - "Understanding Enzymes - Homebrew Science" (Brew Your Own Magazine)
    - John Palmer's "How to Brew"
    - JASBC papers on enzyme thermostability
    - "1% less attenuation for every degree above 151°F" (brewing literature)
    """

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Adjust mash temperature to influence wort fermentability and FG."""
        parameters = parameters or {}
        direction = parameters.get(
            "direction", "decrease"
        )  # "increase" or "decrease" FG
        target_fermentability = parameters.get(
            "target_fermentability", "higher"
        )  # "higher" or "lower"

        changes = []

        # Get current mash temperature from recipe
        current_temp = self.recipe.get("mash_temperature", 152.0)
        temp_unit = self.recipe.get("mash_temp_unit", "F")

        # If no explicit temperature or unit, infer from recipe's unit system
        if not self.recipe.get("mash_temperature") or not self.recipe.get(
            "mash_temp_unit"
        ):
            # Infer unit system from batch size unit
            batch_size_unit = self.recipe.get("batch_size_unit", "gal")
            if batch_size_unit.lower() in ["l", "liters"]:
                # Metric system
                if not self.recipe.get("mash_temperature"):
                    current_temp = 67.0  # Default metric temperature
                if not self.recipe.get("mash_temp_unit"):
                    temp_unit = "C"
            else:
                # Imperial system
                if not self.recipe.get("mash_temperature"):
                    current_temp = 152.0  # Default imperial temperature
                if not self.recipe.get("mash_temp_unit"):
                    temp_unit = "F"

        # Convert to Fahrenheit for consistent calculations
        if temp_unit == "C":
            current_temp_f = (current_temp * 9 / 5) + 32
        else:
            current_temp_f = current_temp

        # Determine new temperature based on direction
        if direction == "decrease" or target_fermentability == "higher":
            # Lower FG by reducing mash temperature (more fermentable)
            # Conservative 2-4°F reduction, staying within reasonable brewing bounds
            new_temp_f = max(148, current_temp_f - 3)
            change_desc = f"Lower mash temperature for higher fermentability (more β-amylase activity)"
            fermentability_effect = (
                "Increases fermentable sugar production, leading to lower FG"
            )
        else:
            # Raise FG by increasing mash temperature (less fermentable)
            # Conservative 2-4°F increase, staying within reasonable brewing bounds
            new_temp_f = min(158, current_temp_f + 3)
            change_desc = f"Raise mash temperature for lower fermentability (more α-amylase activity)"
            fermentability_effect = "Increases dextrin production, leading to higher FG"

        # Convert back to original unit if needed
        if temp_unit == "C":
            new_temp = round((new_temp_f - 32) * 5 / 9)
        else:
            new_temp = round(new_temp_f)

        # Only suggest change if temperature is different
        if abs(new_temp - current_temp) >= 1:
            changes.append(
                {
                    "type": "modify_recipe_parameter",
                    "parameter": "mash_temperature",
                    "old_value": current_temp,
                    "new_value": round(new_temp),
                    "unit": temp_unit,
                    "reason": change_desc,
                    "brewing_science": fermentability_effect,
                    "impact_type": "important",
                    "confidence": "high",  # Well-established brewing science
                    "category": "process_adjustment",
                }
            )

            # Always ensure mash_temp_unit is explicitly set in the optimized recipe
            # This prevents unit confusion in the frontend
            if (
                not self.recipe.get("mash_temp_unit")
                or self.recipe.get("mash_temp_unit") != temp_unit
            ):
                changes.append(
                    {
                        "type": "modify_recipe_parameter",
                        "parameter": "mash_temp_unit",
                        "old_value": self.recipe.get("mash_temp_unit"),
                        "new_value": temp_unit,
                        "reason": "Set mash temperature unit to match temperature value",
                        "impact_type": "minor",
                        "confidence": "high",
                        "category": "process_adjustment",
                    }
                )

        return changes


# Strategy registry for dynamic loading
STRATEGY_REGISTRY = {
    # Base malt strategies
    "base_malt_increase": BaseMaltIncreaseStrategy,  # Legacy - delegates to OG-only
    "base_malt_og_only": BaseMaltOGOnlyStrategy,
    "base_malt_og_and_srm": BaseMaltOGandSRMStrategy,
    "base_malt_reduction": BaseMaltReductionStrategy,
    "base_malt_adjustment": BaseMaltIncreaseStrategy,  # Alias for backward compatibility
    # Roasted grain strategies
    "roasted_malt_increase": RoastedMaltIncreaseStrategy,
    "roasted_malt_decrease": RoastedMaltDecreaseStrategy,
    "adjust_dark_malt_quantity": RoastedMaltIncreaseStrategy,  # Legacy alias
    # ABV strategies
    "abv_targeted": ABVTargetedStrategy,
    # Other strategies
    "caramel_malt_swap": CaramelMaltSwapStrategy,
    "hop_ibu_adjustment": HopIBUAdjustmentStrategy,
    "yeast_substitution": YeastSubstitutionStrategy,
    "normalize_amounts": NormalizeAmountsStrategy,
    # Mash temperature strategy
    "mash_temperature_adjustment": MashTemperatureAdjustmentStrategy,
}


def get_strategy(
    strategy_name: str, context: "RecipeContext", parameters: Dict[str, Any] = None
) -> Optional[OptimizationStrategy]:
    """Get a strategy instance by name."""
    parameters = parameters or {}

    # Special handling for legacy adjust_dark_malt_quantity strategy
    if strategy_name == "adjust_dark_malt_quantity":
        adjustment_type = parameters.get("adjustment_type", "increase")
        if adjustment_type == "reduce":
            strategy_class = RoastedMaltDecreaseStrategy
        else:
            strategy_class = RoastedMaltIncreaseStrategy
    else:
        strategy_class = STRATEGY_REGISTRY.get(strategy_name)

    if strategy_class:
        return strategy_class(context)
    else:
        logger.warning(f"Unknown strategy: {strategy_name}")
        return None
