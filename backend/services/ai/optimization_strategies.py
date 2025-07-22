"""
Optimization strategies for flowchart-based AI system.

This module provides concrete implementations of optimization strategies
that can be executed by the FlowchartEngine workflow nodes.
"""

import logging
import math
from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

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


class BaseMaltIncreaseStrategy(OptimizationStrategy):
    """Strategy for increasing base malt amounts to raise OG."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Increase base malt amounts to raise OG."""
        parameters = parameters or {}
        target_malts = parameters.get("target_malts", ["munich_dark", "maris_otter"])
        increase_percentage = parameters.get("increase_percentage", 0.15)
        fallback_action = parameters.get("fallback_action", "add_munich_dark")

        changes = []
        grains = self._find_ingredients_by_type("grain")
        base_malts = [g for g in grains if g.get("grain_type") == "base"]

        # Try to find preferred dark base malts to increase
        target_malts_found = []
        for grain in base_malts:
            name = grain.get("name", "").lower()
            if any(target.lower() in name for target in target_malts):
                target_malts_found.append(grain)

        if target_malts_found:
            # Increase existing preferred base malts
            for grain in target_malts_found:
                current_amount = grain.get("amount", 0)
                new_amount = current_amount * (1 + increase_percentage)
                new_amount = self._round_to_brewing_increment(
                    new_amount, grain.get("unit", "lb")
                )

                changes.append(
                    {
                        "type": "ingredient_modified",
                        "ingredient_name": grain.get("name"),
                        "field": "amount",
                        "current_value": current_amount,
                        "new_value": new_amount,
                        "unit": grain.get("unit"),
                        "change_reason": f'Increased {grain.get("name")} by {increase_percentage*100:.0f}% to raise OG',
                    }
                )

        elif fallback_action == "add_munich_dark" and base_malts:
            # Add Munich Dark as a small percentage of total grain bill
            total_grain_weight = sum(g.get("amount", 0) for g in grains)
            munich_amount = total_grain_weight * 0.1  # 10% of grain bill
            munich_amount = self._round_to_brewing_increment(munich_amount, "lb")

            changes.append(
                {
                    "type": "ingredient_added",
                    "ingredient_name": "Munich Dark",
                    "ingredient_data": {
                        "name": "Munich Dark",
                        "type": "grain",
                        "grain_type": "base",
                        "amount": munich_amount,
                        "unit": "lb",
                        "potential": 1.037,
                        "color": 9.0,
                    },
                    "change_reason": "Added Munich Dark to increase OG and add complexity",
                }
            )

        else:
            # Increase all base malts proportionally
            for grain in base_malts:
                current_amount = grain.get("amount", 0)
                new_amount = current_amount * (
                    1 + increase_percentage * 0.5
                )  # Smaller increase for all
                new_amount = self._round_to_brewing_increment(
                    new_amount, grain.get("unit", "lb")
                )

                changes.append(
                    {
                        "type": "ingredient_modified",
                        "ingredient_name": grain.get("name"),
                        "field": "amount",
                        "current_value": current_amount,
                        "new_value": new_amount,
                        "unit": grain.get("unit"),
                        "change_reason": f'Increased {grain.get("name")} proportionally to raise OG',
                    }
                )

        return changes

    def _round_to_brewing_increment(self, amount: float, unit: str) -> float:
        """Round amounts to brewing-friendly increments."""
        if unit in ["lb", "lbs", "pound", "pounds"]:
            # Round to nearest 0.25 lb for amounts < 2 lb, 0.5 lb for larger
            if amount < 2:
                return round(amount * 4) / 4
            else:
                return round(amount * 2) / 2
        elif unit in ["kg", "kilograms"]:
            # Round to nearest 0.1 kg for amounts < 1 kg, 0.25 kg for larger
            if amount < 1:
                return round(amount * 10) / 10
            else:
                return round(amount * 4) / 4
        else:
            # Default to 2 decimal places
            return round(amount, 2)


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
        base_malts = [g for g in grains if g.get("grain_type") == "base"]

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
            total_base_weight = sum(g.get("amount", 0) for g in base_malts)

            for grain in base_malts:
                current_amount = grain.get("amount", 0)
                new_amount = current_amount * (1 - reduction_percentage)
                new_amount = self._round_to_brewing_increment(
                    new_amount, grain.get("unit", "lb")
                )

                # Ensure minimum amount
                min_amount = 0.25 if grain.get("unit") in ["lb", "lbs"] else 0.1
                new_amount = max(new_amount, min_amount)

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


class CaramelMaltSwapStrategy(OptimizationStrategy):
    """Strategy for swapping caramel malts to adjust SRM."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Swap caramel malts for SRM adjustment."""
        parameters = parameters or {}
        direction = parameters.get("direction", "lighter_to_darker")
        swap_ratios = parameters.get("swap_ratios", {})

        changes = []
        caramel_names = ["caramel", "crystal", "cara"]
        caramel_malts = self._find_ingredients_by_name_contains(caramel_names)

        if not caramel_malts:
            return changes

        # Default swap ratios if not provided
        if not swap_ratios:
            if direction == "lighter_to_darker":
                swap_ratios = {
                    "crystal 40": "crystal 60",
                    "crystal 60": "crystal 80",
                    "crystal 80": "crystal 120",
                    "caramel 40": "caramel 60",
                    "caramel 60": "caramel 80",
                }
            else:  # darker_to_lighter
                swap_ratios = {
                    "crystal 120": "crystal 80",
                    "crystal 80": "crystal 60",
                    "crystal 60": "crystal 40",
                    "caramel 80": "caramel 60",
                    "caramel 60": "caramel 40",
                }

        for caramel in caramel_malts:
            name = caramel.get("name", "").lower()

            # Find matching swap
            for old_name, new_name in swap_ratios.items():
                if old_name.lower() in name:
                    changes.append(
                        {
                            "type": "ingredient_modified",
                            "ingredient_name": caramel.get("name"),
                            "field": "name",
                            "current_value": caramel.get("name"),
                            "new_value": new_name.title(),
                            "change_reason": f'Swapped {caramel.get("name")} to {new_name.title()} for SRM adjustment',
                        }
                    )

                    # Also update color value if we have it
                    color_map = {
                        "crystal 40": 40,
                        "crystal 60": 60,
                        "crystal 80": 80,
                        "crystal 120": 120,
                        "caramel 40": 40,
                        "caramel 60": 60,
                        "caramel 80": 80,
                    }
                    if new_name.lower() in color_map:
                        changes.append(
                            {
                                "type": "ingredient_modified",
                                "ingredient_name": caramel.get("name"),
                                "field": "color",
                                "current_value": caramel.get("color", 0),
                                "new_value": color_map[new_name.lower()],
                                "change_reason": f"Updated color value for {new_name.title()}",
                            }
                        )
                    break

        return changes


class HopIBUAdjustmentStrategy(OptimizationStrategy):
    """Strategy for adjusting hop quantities and timing to meet IBU targets."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Adjust hop quantities and timing for IBU targets."""
        parameters = parameters or {}
        strategy_type = parameters.get("strategy", "increase_time_then_amount")
        max_time = parameters.get("max_time", 60)
        min_amount = parameters.get("min_amount", 0.25)
        amount_increment = parameters.get("amount_increment", 0.25)

        changes = []
        hops = self._find_ingredients_by_type("hop")
        bittering_hops = [
            h for h in hops if h.get("use") == "boil" and h.get("time", 0) >= 30
        ]

        if not bittering_hops:
            return changes

        # Find the hop with highest IBU contribution
        highest_ibu_hop = self._find_highest_ibu_hop(bittering_hops)
        if not highest_ibu_hop:
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
        """Find the hop with highest IBU contribution."""
        if not hops:
            return None

        # Simplified IBU contribution calculation
        best_hop = None
        best_contribution = 0

        for hop in hops:
            amount = hop.get("amount", 0)
            alpha_acid = hop.get("alpha_acid", 5.0)
            time = hop.get("time", 60)

            # Simplified contribution: amount * alpha_acid * time_factor
            time_factor = min(time / 60, 1.0)  # Boil time utilization approximation
            contribution = amount * alpha_acid * time_factor

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

        # Try increasing time first (if under max)
        if current_time < max_time:
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
            # Increase amount
            new_amount = current_amount + amount_increment
            new_amount = self._round_to_brewing_increment(
                new_amount, hop.get("unit", "oz")
            )
            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": hop.get("unit"),
                    "change_reason": f'Increased {hop.get("name")} amount to {new_amount} {hop.get("unit")} for higher IBU',
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

        # Try reducing amount first (if above minimum)
        if current_amount > min_amount:
            new_amount = max(current_amount - 0.25, min_amount)
            new_amount = self._round_to_brewing_increment(
                new_amount, hop.get("unit", "oz")
            )
            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": hop.get("name"),
                    "field": "amount",
                    "current_value": current_amount,
                    "new_value": new_amount,
                    "unit": hop.get("unit"),
                    "change_reason": f'Reduced {hop.get("name")} amount to {new_amount} {hop.get("unit")} for lower IBU',
                }
            )
        elif current_time > 15:
            # Reduce time if amount at minimum
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

        return changes


class YeastSubstitutionStrategy(OptimizationStrategy):
    """Strategy for substituting yeast to achieve target attenuation."""

    def execute(self, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Substitute yeast for target attenuation."""
        parameters = parameters or {}
        target_attenuation = parameters.get("target_attenuation", "higher")
        maintain_style_compliance = parameters.get("maintain_style_compliance", True)

        changes = []
        yeasts = self._find_ingredients_by_type("yeast")

        if not yeasts:
            return changes

        current_yeast = yeasts[0]  # Assume first yeast is primary
        current_attenuation = current_yeast.get("attenuation", 75)

        # Determine target attenuation percentage
        if target_attenuation == "higher":
            target_percent = min(current_attenuation + 5, 85)  # Increase by 5%, max 85%
        else:  # lower
            target_percent = max(current_attenuation - 5, 65)  # Decrease by 5%, min 65%

        # Find suitable yeast substitute (this would need a yeast database lookup)
        new_yeast_name = self._find_suitable_yeast(
            target_percent, maintain_style_compliance
        )

        if new_yeast_name and new_yeast_name != current_yeast.get("name"):
            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": current_yeast.get("name"),
                    "field": "name",
                    "current_value": current_yeast.get("name"),
                    "new_value": new_yeast_name,
                    "change_reason": f"Substituted yeast for {target_attenuation} attenuation ({target_percent}%)",
                }
            )

            changes.append(
                {
                    "type": "ingredient_modified",
                    "ingredient_name": current_yeast.get("name"),
                    "field": "attenuation",
                    "current_value": current_attenuation,
                    "new_value": target_percent,
                    "change_reason": f"Updated attenuation for {new_yeast_name}",
                }
            )

        return changes

    def _find_suitable_yeast(
        self, target_attenuation: float, maintain_style: bool
    ) -> Optional[str]:
        """Find a suitable yeast substitute (placeholder implementation)."""
        # This would need integration with yeast database
        # For now, return generic names based on attenuation range
        if target_attenuation >= 80:
            return "Safale US-05 (American Ale)"
        elif target_attenuation >= 75:
            return "Wyeast 1056 (American Ale)"
        elif target_attenuation >= 70:
            return "Wyeast 1968 (London ESB)"
        else:
            return "Wyeast 1318 (London Ale III)"


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


# Strategy registry for dynamic loading
STRATEGY_REGISTRY = {
    "base_malt_increase": BaseMaltIncreaseStrategy,
    "base_malt_reduction": BaseMaltReductionStrategy,
    "base_malt_adjustment": BaseMaltIncreaseStrategy,  # Alias
    "adjust_dark_malt_quantity": BaseMaltIncreaseStrategy,  # Similar strategy
    "caramel_malt_swap": CaramelMaltSwapStrategy,
    "hop_ibu_adjustment": HopIBUAdjustmentStrategy,
    "yeast_substitution": YeastSubstitutionStrategy,
    "normalize_amounts": NormalizeAmountsStrategy,
}


def get_strategy(
    strategy_name: str, context: "RecipeContext"
) -> Optional[OptimizationStrategy]:
    """Get a strategy instance by name."""
    strategy_class = STRATEGY_REGISTRY.get(strategy_name)
    if strategy_class:
        return strategy_class(context)
    else:
        logger.warning(f"Unknown strategy: {strategy_name}")
        return None
