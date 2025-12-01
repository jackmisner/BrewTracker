"""
Recipe Context for flowchart-based AI system.

This module provides the RecipeContext class that maintains recipe state
throughout workflow execution and handles condition evaluation and strategy execution.
"""

import logging
from copy import deepcopy
from typing import Any, Dict, List, Optional

from .unit_mappings import TEMP_UNIT_FIELDS

logger = logging.getLogger(__name__)


class RecipeContext:
    """
    Context object that maintains recipe state throughout workflow execution.

    This class serves as the central hub for:
    - Recipe data and current metrics
    - Style guideline information
    - Condition evaluation
    - Strategy execution
    - Change tracking
    """

    def __init__(
        self,
        recipe_data: Dict[str, Any],
        style_guidelines: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize recipe context.

        Args:
            recipe_data: Recipe data including ingredients, batch size, efficiency, etc.
            style_guidelines: Optional style guidelines for compliance checking
        """
        self.original_recipe = deepcopy(recipe_data)
        self.recipe = recipe_data
        self.style_guidelines = style_guidelines or {}
        logger.info(
            f"Initialized RecipeContext with Style Guidelines: {self.style_guidelines}"
        )

        # Current calculated metrics
        self.metrics = self._calculate_metrics()

        # Track all changes made during workflow execution
        self.changes_made: List[Dict[str, Any]] = []

        # Execution trail for debugging
        self.execution_trail: List[Dict[str, Any]] = []

        # Registries for conditions and strategies
        self.condition_evaluators = {}
        self.strategy_handlers = {}

        # Strategy loader reference (set in _register_builtin_strategies)
        self._get_strategy = None

        # Initialize built-in condition evaluators
        self._register_builtin_conditions()

        # Initialize built-in strategy handlers
        self._register_builtin_strategies()

    def _calculate_metrics(self) -> Dict[str, Any]:
        """Calculate current recipe metrics using the established brewing calculation system."""
        try:
            # Use the existing recipe API calculator (no wrapper needed)
            from utils.recipe_api_calculator import calculate_all_metrics_preview

            metrics = calculate_all_metrics_preview(self.recipe)

            # Calculate attenuation from yeast ingredients
            attenuation = 75.0  # Default attenuation
            yeast_ingredients = [
                ing
                for ing in self.recipe.get("ingredients", [])
                if ing.get("type") == "yeast"
            ]
            if yeast_ingredients:
                attenuations = [
                    float(ing.get("attenuation", 75.0)) for ing in yeast_ingredients
                ]
                attenuation = sum(attenuations) / len(attenuations)

            # Convert to expected format (uppercase keys)
            formatted_metrics = {
                "OG": round(metrics.get("og", 1.000), 3),
                "FG": round(metrics.get("fg", 1.000), 3),
                "ABV": round(metrics.get("abv", 0.0), 1),
                "IBU": round(metrics.get("ibu", 0.0), 1),
                "SRM": round(metrics.get("srm", 0.0), 1),
                "attenuation": round(attenuation, 1),
            }

            logger.info(formatted_metrics)
            return formatted_metrics

        except Exception as e:
            logger.error(f"Error calculating metrics: {e}")
            # Return default empty metrics if calculation fails
            return {
                "OG": 1.000,
                "FG": 1.000,
                "ABV": 0.0,
                "IBU": 0.0,
                "SRM": 0.0,
                "attenuation": 75.0,
            }

    def _register_builtin_conditions(self):
        """Register built-in condition evaluators."""
        self.condition_evaluators.update(
            {
                "all_metrics_in_style": self._evaluate_all_metrics_in_style,
                "og_in_range": self._evaluate_metric_in_range("OG"),
                "fg_in_range": self._evaluate_metric_in_range("FG"),
                "abv_in_range": self._evaluate_metric_in_range("ABV"),
                "ibu_in_range": self._evaluate_metric_in_range("IBU"),
                "srm_in_range": self._evaluate_metric_in_range("SRM"),
                "og_too_low": self._evaluate_metric_too_low("OG"),
                "og_too_high": self._evaluate_metric_too_high("OG"),
                "fg_too_low": self._evaluate_metric_too_low("FG"),
                "fg_too_high": self._evaluate_metric_too_high("FG"),
                "abv_too_low": self._evaluate_metric_too_low("ABV"),
                "abv_too_high": self._evaluate_metric_too_high("ABV"),
                "ibu_too_low": self._evaluate_metric_too_low("IBU"),
                "ibu_too_high": self._evaluate_metric_too_high("IBU"),
                "srm_too_low": self._evaluate_metric_too_low("SRM"),
                "srm_too_high": self._evaluate_metric_too_high("SRM"),
                "srm_also_too_low": self._evaluate_metric_too_low("SRM"),
                "srm_still_too_low": self._evaluate_metric_too_low("SRM"),
                "amounts_normalized": self._evaluate_amounts_normalized,
                "caramel_malts_in_recipe": self._evaluate_caramel_malts_in_recipe,
                "roasted_grains_in_recipe": self._evaluate_roasted_grains_in_recipe,
                # Mash temperature conditions for workflow
                "mash_temp_available_and_high": self._evaluate_mash_temp_available_and_high,
                "mash_temp_available_and_low": self._evaluate_mash_temp_available_and_low,
                "yeast_substitution_available": self._evaluate_yeast_substitution_available,
                # Unit conversion conditions
                "recipe_uses_metric": self._evaluate_recipe_uses_metric,
                "target_system_is_metric": self._evaluate_target_system_is_metric,
                "target_system_is_imperial": self._evaluate_target_system_is_imperial,
            }
        )

    def _register_builtin_strategies(self):
        """Register built-in strategy handlers."""
        # Import here to avoid circular imports
        from .optimization_strategies import get_strategy

        # Dynamic strategy loading
        self._get_strategy = get_strategy

        # Legacy handlers for backward compatibility
        self.strategy_handlers.update(
            {
                "base_malt_increase": self._execute_strategy_dynamic,
                "base_malt_reduction": self._execute_strategy_dynamic,
                "adjust_dark_malt_quantity": self._execute_strategy_dynamic,
                "caramel_malt_swap": self._execute_strategy_dynamic,
                "add_roasted_grains": self._execute_strategy_dynamic,
                "normalize_amounts": self._execute_strategy_dynamic,
                "yeast_substitution": self._execute_strategy_dynamic,
                "hop_timing_optimization": self._execute_strategy_dynamic,
                "hop_ibu_adjustment": self._execute_strategy_dynamic,
                "increase_roasted_grains": self._execute_strategy_dynamic,
                "reduce_roasted_grains": self._execute_strategy_dynamic,
                "reduce_darkest_base_malt": self._execute_strategy_dynamic,
                "mash_temperature_adjustment": self._execute_strategy_dynamic,
            }
        )

    def evaluate_condition(
        self, condition_name: str, config: Dict[str, Any] = None
    ) -> bool:
        """
        Evaluate a named condition against current recipe state.

        Args:
            condition_name: Name of the condition to evaluate
            config: Optional configuration parameters for the condition

        Returns:
            Boolean result of the condition evaluation
        """
        if condition_name not in self.condition_evaluators:
            logger.warning(f"Unknown condition: {condition_name}")
            return False

        try:
            evaluator = self.condition_evaluators[condition_name]
            if config:
                return evaluator(config)
            else:
                return evaluator()
        except Exception as e:
            logger.error(f"Error evaluating condition {condition_name}: {e}")
            return False

    def execute_strategy(
        self, strategy_name: str, parameters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute a named strategy to modify the recipe.

        Args:
            strategy_name: Name of the strategy to execute
            parameters: Optional parameters for the strategy

        Returns:
            List of changes made to the recipe
        """
        try:
            # Try dynamic strategy loading first
            if self._get_strategy:
                strategy = self._get_strategy(strategy_name, self)
                if strategy:
                    return strategy.execute(parameters or {})

            # Fall back to legacy handlers
            if strategy_name in self.strategy_handlers:
                handler = self.strategy_handlers[strategy_name]
                if parameters:
                    return handler(parameters)
                else:
                    return handler()

            logger.warning(f"Unknown strategy: {strategy_name}")
            return []

        except Exception as e:
            logger.error(f"Error executing strategy {strategy_name}: {e}")
            return []

    def apply_changes(self, changes: List[Dict[str, Any]]):
        """
        Apply a list of changes to the recipe and recalculate metrics.

        Args:
            changes: List of change dictionaries to apply
        """
        for change in changes:
            self._apply_single_change(change)
            self.changes_made.append(change)

        # Recalculate metrics after changes
        self.metrics = self._calculate_metrics()

        logger.info(f"Applied {len(changes)} changes. New metrics: {self.metrics}")

    def _apply_single_change(self, change: Dict[str, Any]):
        """Apply a single change to the recipe data."""
        change_type = change.get("type")

        if change_type == "ingredient_modified":
            self._modify_ingredient(change)
        elif change_type == "ingredient_added":
            self._add_ingredient(change)
        elif change_type == "ingredient_removed":
            self._remove_ingredient(change)
        elif change_type == "ingredient_substituted":
            self._substitute_ingredient(change)
        elif change_type == "modify_recipe_parameter":
            self._modify_recipe_parameter(change)
        elif change_type in ["ingredient_converted", "ingredient_normalized"]:
            self._convert_or_normalize_ingredient(change)
        elif change_type == "batch_size_converted":
            self._convert_batch_size(change)
        elif change_type == "temperature_converted":
            self._convert_temperature(change)
        else:
            logger.warning(f"Unknown change type: {change_type}")

    def _modify_ingredient(self, change: Dict[str, Any]):
        """Modify an existing ingredient."""
        ingredient_name = change.get("ingredient_name")
        field = change.get("field", "amount")
        new_value = change.get("new_value")

        ingredients = self.recipe.get("ingredients", [])
        for ingredient in ingredients:
            if ingredient.get("name") == ingredient_name:
                ingredient[field] = new_value
                break

    def _add_ingredient(self, change: Dict[str, Any]):
        """Add a new ingredient to the recipe."""
        new_ingredient = change.get("ingredient_data", {})
        if new_ingredient:
            self.recipe.setdefault("ingredients", []).append(new_ingredient)

    def _remove_ingredient(self, change: Dict[str, Any]):
        """Remove an ingredient from the recipe."""
        ingredient_name = change.get("ingredient_name")
        ingredients = self.recipe.get("ingredients", [])
        self.recipe["ingredients"] = [
            ing for ing in ingredients if ing.get("name") != ingredient_name
        ]

    def _substitute_ingredient(self, change: Dict[str, Any]):
        """Substitute one ingredient for another in the recipe."""
        old_ingredient_name = change.get("old_ingredient_name")
        new_ingredient = change.get("new_ingredient", {})

        ingredients = self.recipe.get("ingredients", [])
        for i, ingredient in enumerate(ingredients):
            if ingredient.get("name") == old_ingredient_name:
                self._remove_ingredient({"ingredient_name": old_ingredient_name})
                # Add the new ingredient
                if new_ingredient:
                    self._add_ingredient({"ingredient_data": new_ingredient})
                break

    def _modify_recipe_parameter(self, change: Dict[str, Any]):
        """Modify a recipe-level parameter (e.g., mash_temperature, mash_temp_unit)."""
        parameter = change.get("parameter")
        new_value = change.get("new_value")

        if parameter and new_value is not None:
            self.recipe[parameter] = new_value
            logger.info(f"Applied recipe parameter change: {parameter} = {new_value}")
        else:
            logger.warning(
                f"Invalid recipe parameter change: parameter={parameter}, new_value={new_value}"
            )

    def _convert_or_normalize_ingredient(self, change: Dict[str, Any]):
        """Convert or normalize an ingredient's amount and unit."""
        ingredient_name = change.get("ingredient_name")
        new_amount = change.get("new_amount")
        new_unit = change.get("new_unit")

        # Guard against missing ingredient_name
        if not ingredient_name:
            logger.warning(
                "ingredient_name missing from change dict - cannot convert/normalize ingredient"
            )
            return

        ingredients = self.recipe.get("ingredients", [])
        found = False
        for ingredient in ingredients:
            if ingredient.get("name") == ingredient_name:
                if new_amount is not None:
                    if not isinstance(new_amount, (int, float)) or new_amount <= 0:
                        logger.warning(
                            f"Invalid ingredient amount for '{ingredient_name}': {new_amount} - "
                            "must be positive numeric (use 'ingredient_removed' to remove ingredients)"
                        )
                        return
                    ingredient["amount"] = new_amount
                if new_unit is not None:
                    ingredient["unit"] = new_unit
                found = True
                break

        if not found:
            logger.warning(
                f"Ingredient '{ingredient_name}' not found in recipe ingredients - cannot convert/normalize"
            )

    def _convert_batch_size(self, change: Dict[str, Any]):
        """Convert batch size to new unit."""
        new_value = change.get("new_value")
        new_unit = change.get("new_unit")

        if new_value is not None:
            if not isinstance(new_value, (int, float)) or new_value <= 0:
                logger.warning(
                    f"Invalid batch size value: {new_value} - must be positive numeric"
                )
                return
            self.recipe["batch_size"] = new_value
        if new_unit is not None:
            self.recipe["batch_size_unit"] = new_unit

    def _convert_temperature(self, change: Dict[str, Any]):
        """Convert temperature to new unit."""
        parameter = change.get("parameter", "mash_temperature")
        new_value = change.get("new_value")
        new_unit = change.get("new_unit")

        # Guard against missing/falsey parameter
        if not parameter:
            logger.warning(
                "temperature parameter missing or empty - cannot convert temperature"
            )
            return

        # Log if target parameter is not present in recipe (aids debugging)
        if parameter not in self.recipe:
            logger.debug(
                f"Temperature parameter '{parameter}' not present in recipe - will be added"
            )

        if new_value is not None:
            if not isinstance(new_value, (int, float)):
                logger.warning(
                    f"Non-numeric temperature value for '{parameter}': {new_value!r} - "
                    "expected int or float"
                )
                return
            # Defensive check for reasonable brewing temperatures
            # Covers both Celsius (-20 to 120°C) and Fahrenheit (0 to 250°F)
            if new_value < -20 or new_value > 250:
                logger.warning(
                    f"Temperature value {new_value} for '{parameter}' seems out of reasonable brewing range"
                )
            self.recipe[parameter] = new_value
        if new_unit is not None:
            # Allow explicit unit_field in change dict, or use shared mapping
            unit_field = change.get("unit_field") or TEMP_UNIT_FIELDS.get(parameter)
            if unit_field:
                self.recipe[unit_field] = new_unit
            else:
                logger.warning(
                    f"Unknown temperature parameter '{parameter}' - cannot determine unit field name"
                )

    # Condition evaluators
    def _evaluate_all_metrics_in_style(self, config: Dict[str, Any] = None) -> bool:
        """Check if all metrics are within style guidelines."""
        if not self.style_guidelines:
            return True

        style_ranges = self.style_guidelines.get("ranges", {})
        for metric_name in ["OG", "FG", "ABV", "IBU", "SRM"]:
            if not self._metric_in_range(metric_name, style_ranges):
                return False
        return True

    def _evaluate_metric_in_range(self, metric_name: str):
        """Create a metric range evaluator for a specific metric."""

        def evaluator(config: Dict[str, Any] = None):
            if not self.style_guidelines:
                return True
            style_ranges = self.style_guidelines.get("ranges", {})
            return self._metric_in_range(metric_name, style_ranges)

        return evaluator

    def _evaluate_metric_too_low(self, metric_name: str):
        """Create a metric too low evaluator for a specific metric."""

        def evaluator(config: Dict[str, Any] = None):
            if not self.style_guidelines:
                return False
            style_ranges = self.style_guidelines.get("ranges", {})
            metric_range = style_ranges.get(metric_name)
            if not metric_range:
                return False
            current_value = self.metrics.get(metric_name, 0)
            return current_value < metric_range.get("min", 0)

        return evaluator

    def _evaluate_metric_too_high(self, metric_name: str):
        """Create a metric too high evaluator for a specific metric."""

        def evaluator(config: Dict[str, Any] = None):
            if not self.style_guidelines:
                return False
            style_ranges = self.style_guidelines.get("ranges", {})
            metric_range = style_ranges.get(metric_name)
            if not metric_range:
                return False
            current_value = self.metrics.get(metric_name, 0)
            return current_value > metric_range.get("max", 999)

        return evaluator

    def _evaluate_amounts_normalized(self, config: Dict[str, Any] = None) -> bool:
        """Check if ingredient amounts are normalized to brewing-friendly values.

        This method uses the same logic as NormalizeAmountsStrategy to ensure
        consistency and prevent infinite normalization loops.
        """
        ingredients = self.recipe.get("ingredients", [])
        # Only check normalizable ingredients (grain and hop) to match strategy behavior
        normalizable_ingredients = [
            ing for ing in ingredients if ing.get("type") in ["grain", "hop"]
        ]
        for ingredient in normalizable_ingredients:
            current_amount = ingredient.get("amount", 0)
            unit = ingredient.get("unit", "lb")
            ingredient_type = ingredient.get("type", "grain")

            # Use the same normalization logic as NormalizeAmountsStrategy
            normalized_amount = self._normalize_amount_for_evaluation(
                current_amount, unit, ingredient_type
            )

            # If current amount differs from what it should be normalized to, it's not normalized
            if (
                abs(current_amount - normalized_amount) > 0.001
            ):  # Small tolerance for floating point
                return False
        return True

    def _normalize_amount_for_evaluation(
        self, amount: float, unit: str, ingredient_type: str = "grain"
    ) -> float:
        """
        Normalize amount using same logic as NormalizeAmountsStrategy.

        This ensures the detection logic matches the actual normalization behavior.

        For GRAINS:
        - Imperial: lbs to 1/4 lb increments, oz to nearest oz
        - Metric: kg to 0.05 (50g) increments, g to 25g increments

        For HOPS:
        - Imperial: lbs to 1/4 lb increments, oz to 1/4 oz increments
        - Metric: kg to 0.05 (50g) increments, g to 5g increments
        """
        if unit in ["lb", "lbs", "pound", "pounds"]:
            # Both grains and hops: normalize to 1/4 lb increments
            return round(amount * 4) / 4

        elif unit in ["oz", "ounces"]:
            if ingredient_type == "grain":
                # Grains: round to nearest oz
                return round(amount)
            else:  # hops
                # Hops: round to nearest 1/4 oz
                return round(amount * 4) / 4

        elif unit in ["kg", "kilograms"]:
            # Both grains and hops: normalize to 0.05 increments (50g)
            return round(amount * 20) / 20

        elif unit in ["g", "grams"]:
            if ingredient_type == "grain":
                # Grains: normalize to 25g increments
                return round(amount / 25) * 25
            else:  # hops
                # Hops: normalize to 5g increments
                return round(amount / 5) * 5

        else:
            return round(amount, 2)

    def _evaluate_caramel_malts_in_recipe(self, config: Dict[str, Any] = None) -> bool:
        """Check if recipe contains caramel/crystal malts."""
        ingredients = self.recipe.get("ingredients", [])
        caramel_names = ["caramel", "crystal", "cara"]
        return any(
            any(name in ingredient.get("name", "").lower() for name in caramel_names)
            for ingredient in ingredients
            if ingredient.get("type") == "grain"
        )

    def _evaluate_roasted_grains_in_recipe(self, config: Dict[str, Any] = None) -> bool:
        """Check if recipe contains roasted grains."""
        ingredients = self.recipe.get("ingredients", [])
        roasted_names = ["roasted", "black", "chocolate", "patent", "blackprinz"]
        return any(
            any(name in ingredient.get("name", "").lower() for name in roasted_names)
            for ingredient in ingredients
            if ingredient.get("type") == "grain"
        )

    def _evaluate_mash_temp_available_and_high(
        self, config: Dict[str, Any] = None
    ) -> bool:
        """Check if mash temperature is available and can be lowered (currently high)."""
        mash_temp = self.recipe.get("mash_temperature")

        # If no mash temperature is set, assume baseline temperature (152°F/67°C)
        # This allows mash temperature optimization even for recipes without explicit mash temp
        if not mash_temp:
            return True  # Baseline can be lowered for higher fermentability

        # Convert to Fahrenheit for consistent evaluation
        mash_temp_f = float(mash_temp)
        mash_temp_unit = self.recipe.get("mash_temp_unit", "F")
        if mash_temp_unit == "C":
            mash_temp_f = (mash_temp_f * 9 / 5) + 32

        # Mash temperature is available for lowering if it's above 146°F
        # This allows optimization even from the baseline 152°F temperature
        # Research shows practical range: 145-168°F, with 152°F as balanced baseline
        return mash_temp_f > 146.0

    def _evaluate_mash_temp_available_and_low(
        self, config: Dict[str, Any] = None
    ) -> bool:
        """Check if mash temperature is available and can be raised (currently low)."""
        mash_temp = self.recipe.get("mash_temperature")
        # Debug logging to understand why mash temp path isn't taken
        logger.info(
            f"🌡️ mash_temp_available_and_low check: mash_temp={mash_temp}, mash_temp_unit={self.recipe.get('mash_temp_unit')}"
        )

        # If no mash temperature is set, assume baseline temperature (152°F/67°C)
        # This allows mash temperature optimization even for recipes without explicit mash temp
        if not mash_temp:
            logger.info(
                f"🌡️ mash_temp_available_and_low: No mash temperature found, assuming baseline 152°F - can be raised"
            )
            return True  # Baseline can be raised for lower fermentability

        # Convert to Fahrenheit for consistent evaluation
        mash_temp_f = float(mash_temp)
        mash_temp_unit = self.recipe.get("mash_temp_unit", "F")
        if mash_temp_unit == "C":
            mash_temp_f = (mash_temp_f * 9 / 5) + 32

        # Mash temperature is available for raising if it's below 158°F
        # This allows optimization even from the baseline 152°F temperature
        # Research shows practical range: 145-168°F, with 152°F as balanced baseline
        result = mash_temp_f < 158.0
        logger.info(
            f"🌡️ mash_temp_available_and_low: {mash_temp}°{mash_temp_unit} = {mash_temp_f}°F < 158°F = {result}"
        )
        return result

    def _evaluate_yeast_substitution_available(
        self, config: Dict[str, Any] = None
    ) -> bool:
        """Check if yeast substitution is available (recipe contains yeast)."""
        ingredients = self.recipe.get("ingredients", [])
        return any(ingredient.get("type") == "yeast" for ingredient in ingredients)

    def _evaluate_recipe_uses_metric(
        self, _config: Dict[str, Any] | None = None
    ) -> bool:
        """
        Detect if recipe currently uses metric units.
        Checks ingredients and batch size unit to determine the predominant unit system.
        Returns True only if metric truly predominates (ties are not treated as metric).
        """
        ingredients = self.recipe.get("ingredients", [])
        metric_count = 0
        imperial_count = 0

        # Check ingredient units
        for ingredient in ingredients:
            unit = ingredient.get("unit", "").lower()
            if unit in ["g", "kg", "gram", "grams", "kilogram", "kilograms"]:
                metric_count += 1
            elif unit in ["oz", "lb", "lbs", "ounce", "ounces", "pound", "pounds"]:
                imperial_count += 1

        # Check batch size unit
        batch_unit = self.recipe.get("batch_size_unit", "").lower()
        if batch_unit in ["l", "liter", "liters", "litre", "litres", "ml"]:
            metric_count += 1
        elif batch_unit in ["gal", "gallon", "gallons"]:
            imperial_count += 1

        # Only return True if metric truly predominates
        # Pure metric (no imperial at all) or more metric than imperial
        if metric_count > 0 and imperial_count == 0:
            return True
        return metric_count > imperial_count

    def _get_normalized_target_system(self) -> Optional[str]:
        """
        Get the normalized (lowercase) target unit system from recipe context.
        Returns None if not specified, with a warning logged.
        """
        target_system = self.recipe.get("target_unit_system")
        if target_system is None:
            logger.warning(
                "target_unit_system not specified in recipe - unit conversion may not work correctly"
            )
            return None
        # Defensively normalize to lowercase for comparison
        return (
            target_system.lower() if isinstance(target_system, str) else target_system
        )

    def _evaluate_target_system_is_metric(
        self, _config: Dict[str, Any] | None = None
    ) -> bool:
        """
        Check if target unit system is metric.
        Target system should be stored in recipe context during workflow initialization.
        If not provided, this evaluates to False (no conversion needed).
        """
        target_system = self._get_normalized_target_system()
        return target_system == "metric" if target_system else False

    def _evaluate_target_system_is_imperial(
        self, _config: Dict[str, Any] | None = None
    ) -> bool:
        """
        Check if target unit system is imperial.
        Target system should be stored in recipe context during workflow initialization.
        If not provided, this evaluates to False (no conversion needed).
        """
        target_system = self._get_normalized_target_system()
        return target_system == "imperial" if target_system else False

    def _metric_in_range(self, metric_name: str, style_ranges: Dict[str, Any]) -> bool:
        """Check if a specific metric is within style range."""
        metric_range = style_ranges.get(metric_name)
        if not metric_range:
            return True

        current_value = self.metrics.get(metric_name, 0)
        min_val = metric_range.get("min", 0)
        max_val = metric_range.get("max", 999)

        # Add small tolerance for FG to prevent infinite loops
        # FG changes from optimization strategies can be very small (0.001-0.003)
        if metric_name == "FG":
            tolerance = 0.001  # 1 gravity point tolerance - balance between sensitivity and stability
            return (min_val - tolerance) <= current_value <= (max_val + tolerance)

        # Add small tolerance for SRM to prevent normalization loops
        # Normalization can cause small SRM fluctuations due to rounding
        if metric_name == "SRM":
            tolerance = 0.3  # 0.3 SRM tolerance
            return (min_val - tolerance) <= current_value <= (max_val + tolerance)

        return min_val <= current_value <= max_val

    # Dynamic strategy execution
    def _execute_strategy_dynamic(
        self, parameters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Execute strategy using dynamic loading from optimization_strategies module."""
        # Get the strategy name from the call stack
        import inspect

        frame = inspect.currentframe()
        try:
            # Look for the strategy name in the execution context
            # This is a bit hacky but works for our use case
            caller_locals = frame.f_back.f_locals
            strategy_name = caller_locals.get("strategy_name", "unknown")

            if self._get_strategy:
                strategy = self._get_strategy(strategy_name, self)
                if strategy:
                    return strategy.execute(parameters or {})
                else:
                    logger.warning(f"Strategy not found: {strategy_name}")
                    return []
            else:
                logger.error("Strategy loader not initialized")
                return []
        except Exception as e:
            logger.error(f"Error executing strategy dynamically: {e}")
            return []
        finally:
            del frame
