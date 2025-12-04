from typing import ClassVar, Dict, List


class UnitConverter:
    """Unified utility class for all unit conversions"""

    # Unit classification constants
    WEIGHT_UNITS: ClassVar[List[str]] = [
        "g",
        "gram",
        "grams",
        "kg",
        "kilogram",
        "kilograms",
        "oz",
        "ounce",
        "ounces",
        "lb",
        "lbs",
        "pound",
        "pounds",
    ]

    VOLUME_UNITS: ClassVar[List[str]] = [
        "ml",
        "milliliter",
        "milliliters",
        "l",
        "liter",
        "liters",
        "L",
        "floz",
        "fl_oz",
        "fluid_ounce",
        "cup",
        "cups",
        "pint",
        "pints",
        "pt",
        "quart",
        "quarts",
        "qt",
        "gallon",
        "gallons",
        "gal",
        "tsp",
        "tbsp",
        "teaspoon",
        "tablespoon",
    ]

    COUNT_UNITS: ClassVar[List[str]] = ["each", "item", "pkg", "package", "packages"]

    # Default weight conversions for 'each'/'item' units (in grams and ounces)
    # These are used when exporting to BeerXML
    EACH_TO_WEIGHT_DEFAULTS: ClassVar[dict[str, dict[str, float]]] = {
        # Default: 1 oz (28g) per item
        "default": {"g": 28, "oz": 1},
        # Specific items (future enhancement - common brewing additions)
        "vanilla_bean": {"g": 5, "oz": 0.18},
        "vanilla bean": {"g": 5, "oz": 0.18},
        "cinnamon_stick": {"g": 5, "oz": 0.18},
        "cinnamon stick": {"g": 5, "oz": 0.18},
        "cacao_nib": {"g": 28, "oz": 1},  # Usually sold in oz
        "cacao nibs": {"g": 28, "oz": 1},
        "orange_peel": {"g": 14, "oz": 0.5},
        "orange peel": {"g": 14, "oz": 0.5},
        "lemon_peel": {"g": 14, "oz": 0.5},
        "lemon peel": {"g": 14, "oz": 0.5},
        "coriander_seed": {"g": 14, "oz": 0.5},
        "coriander seed": {"g": 14, "oz": 0.5},
        "coriander": {"g": 14, "oz": 0.5},
    }

    # Weight conversions (to grams as base unit)
    WEIGHT_TO_GRAMS: ClassVar[Dict[str, float]] = {
        "g": 1.0,
        "gram": 1.0,
        "grams": 1.0,
        "kg": 1000.0,
        "kilogram": 1000.0,
        "kilograms": 1000.0,
        "oz": 28.3495,
        "ounce": 28.3495,
        "ounces": 28.3495,
        "lb": 453.592,
        "lbs": 453.592,
        "pound": 453.592,
        "pounds": 453.592,
    }

    # Volume conversions (to liters as base unit)
    VOLUME_TO_LITERS: ClassVar[Dict[str, float]] = {
        "ml": 0.001,
        "milliliter": 0.001,
        "milliliters": 0.001,
        "l": 1.0,
        "liter": 1.0,
        "liters": 1.0,
        "L": 1.0,  # Capital L alias
        "floz": 0.0295735,  # US fluid ounce
        "fl_oz": 0.0295735,
        "fluid_ounce": 0.0295735,
        "cup": 0.236588,  # US cup
        "cups": 0.236588,
        "pint": 0.473176,  # US pint
        "pints": 0.473176,
        "pt": 0.473176,
        "quart": 0.946353,  # US quart
        "quarts": 0.946353,
        "qt": 0.946353,
        "gallon": 3.78541,  # US gallon
        "gallons": 3.78541,
        "gal": 3.78541,
        "tsp": 0.00492892,  # US teaspoon
        "teaspoon": 0.00492892,
        "tbsp": 0.0147868,  # US tablespoon
        "tablespoon": 0.0147868,
    }

    @classmethod
    def convert_weight(cls, amount, from_unit, to_unit):
        """Convert weight between units"""
        if from_unit == to_unit:
            return amount

        from_unit_lower = from_unit.lower()
        to_unit_lower = to_unit.lower()

        if from_unit_lower == to_unit_lower:
            return amount

        # Convert to grams first, then to target unit
        grams = amount * cls.WEIGHT_TO_GRAMS.get(from_unit_lower, 1.0)
        result = grams / cls.WEIGHT_TO_GRAMS.get(to_unit_lower, 1.0)

        # Round to reasonable precision to avoid floating point errors
        # For weights: 6 decimal places is sufficient for brewing precision
        return round(result, 6)

    @classmethod
    def convert_to_pounds(cls, amount, unit):
        """Convert various weight units to pounds"""
        return cls.convert_weight(amount, unit, "lb")

    @classmethod
    def convert_to_ounces(cls, amount, unit):
        """Convert weight to ounces"""
        return cls.convert_weight(amount, unit, "oz")

    @classmethod
    def convert_volume(cls, amount, from_unit, to_unit):
        """Convert volume between units"""
        if from_unit == to_unit:
            return amount

        from_unit_lower = from_unit.lower()
        to_unit_lower = to_unit.lower()

        if from_unit_lower == to_unit_lower:
            return amount

        # Convert to liters first, then to target unit
        liters = amount * cls.VOLUME_TO_LITERS.get(from_unit_lower, 1.0)
        result = liters / cls.VOLUME_TO_LITERS.get(to_unit_lower, 1.0)

        # Round to reasonable precision to avoid floating point errors
        # For volumes: 6 decimal places is sufficient for brewing precision
        return round(result, 6)

    @classmethod
    def convert_to_gallons(cls, amount, unit):
        """Convert various volume units to gallons"""
        return cls.convert_volume(amount, unit, "gal")

    @classmethod
    def convert_to_liters(cls, amount, unit):
        """Convert various volume units to liters"""
        return cls.convert_volume(amount, unit, "l")

    @classmethod
    def round_to_brewing_precision(
        cls, amount, ingredient_type="general", unit_system="imperial", unit="oz"
    ):
        """
        Round amounts to brewing-friendly precision to avoid floating point errors

        Args:
            amount: The amount to round
            ingredient_type: Type of ingredient (hop, grain, yeast, etc.)
            unit_system: "imperial" or "metric"
            unit: The unit of measurement

        Returns:
            Rounded amount with appropriate precision for brewing
        """
        if amount == 0:
            return 0.0

        # Imperial units (stored as oz for weight)
        if unit_system == "imperial":
            # Don't normalize here - let the unit conversion workflow handle normalization
            # Just preserve precision to avoid floating point errors
            if ingredient_type in ["grain", "hop", "yeast"]:
                # Round to 6 decimal places to clean up floating point errors
                # while preserving enough precision for the normalization workflow
                return round(amount, 6)
            else:
                # General: 2 decimal places
                return round(amount, 2)

        # Metric units (stored as g for weight)
        else:  # metric
            # Don't normalize here - let the unit conversion workflow handle normalization
            # Just preserve precision to avoid floating point errors
            if ingredient_type in ["grain", "hop", "yeast"]:
                # Round to 6 decimal places to clean up floating point errors
                # while preserving enough precision for the normalization workflow
                return round(amount, 6)
            else:
                # General/other: round to nearest gram to clean up floating point errors
                return float(round(amount))

    @classmethod
    def detect_unit_system_from_display_batch_size(cls, display_batch_size):
        """
        Detect the original unit system from DISPLAY_BATCH_SIZE field
        Returns 'metric' for liters, 'imperial' for gallons, None if ambiguous
        """
        if not display_batch_size or not isinstance(display_batch_size, str):
            return None

        display_lower = display_batch_size.lower().strip()

        # Check for imperial indicators first (more specific patterns)
        imperial_indicators = ["gal", "gallon", "gallons"]
        for indicator in imperial_indicators:
            if indicator in display_lower:
                return "imperial"

        # Check for metric indicators
        metric_indicators = ["l", "liter", "liters", "litre", "litres"]
        for indicator in metric_indicators:
            if indicator in display_lower:
                return "metric"

        return None

    @classmethod
    def normalize_yeast_amount_to_packages(cls, amount, unit):
        """
        Normalize yeast amounts to practical package quantities
        Converts fractional packages to whole numbers for usability
        """
        if unit != "pkg" and unit != "package":
            return amount  # Don't normalize non-package units

        if amount <= 0:
            return 1  # Minimum 1 package

        # Round to nearest practical package amount
        if amount < 0.6:
            return 1
        elif amount < 1.4:
            return 1
        elif amount < 2.4:
            return 2
        elif amount < 3.4:
            return 3
        elif amount < 4.4:
            return 4
        else:
            # For larger amounts, round to nearest whole number
            return round(amount)

    @classmethod
    def convert_each_to_weight(cls, amount, target_unit="g", item_name=None):
        """
        Convert 'each'/'item' count to weight for BeerXML export

        Args:
            amount: Number of items
            target_unit: "g" or "oz" (default "g")
            item_name: Optional name for specific conversion

        Returns:
            Weight equivalent in target unit
        """

        # Validate target unit
        if target_unit not in ["g", "oz"]:
            target_unit = "g"  # Default to grams

        # Try specific item lookup (case-insensitive)
        if item_name:
            item_key = item_name.lower().strip()
            if item_key in cls.EACH_TO_WEIGHT_DEFAULTS:
                return amount * cls.EACH_TO_WEIGHT_DEFAULTS[item_key][target_unit]

        # Default: 1 oz (28g) per item
        return amount * cls.EACH_TO_WEIGHT_DEFAULTS["default"][target_unit]

    @classmethod
    def convert_temperature(cls, temp, from_unit, to_unit):
        """Convert temperature between Fahrenheit and Celsius"""
        if from_unit == to_unit:
            return temp

        from_unit_upper = from_unit.upper()
        to_unit_upper = to_unit.upper()

        if from_unit_upper == to_unit_upper:
            return temp

        if from_unit_upper == "F" and to_unit_upper == "C":
            return (temp - 32) * 5 / 9
        elif from_unit_upper == "C" and to_unit_upper == "F":
            return (temp * 9 / 5) + 32

        return temp

    @classmethod
    def fahrenheit_to_celsius(cls, temp_f):
        """Convert Fahrenheit to Celsius"""
        return cls.convert_temperature(temp_f, "F", "C")

    @classmethod
    def celsius_to_fahrenheit(cls, temp_c):
        """Convert Celsius to Fahrenheit"""
        return cls.convert_temperature(temp_c, "C", "F")

    @classmethod
    def get_preferred_units(cls, unit_system):
        """Get preferred units for a given unit system"""
        if unit_system == "metric":
            return {
                "weight_large": "kg",  # For grain bills
                "weight_small": "g",  # For hops, adjuncts
                "volume_large": "l",  # For batch sizes
                "volume_small": "ml",  # For small additions
                "temperature": "C",
            }
        else:  # imperial
            return {
                "weight_large": "lb",  # For grain bills
                "weight_small": "oz",  # For hops, adjuncts
                "volume_large": "gal",  # For batch sizes
                "volume_small": "floz",  # For small additions
                "temperature": "F",
            }

    @classmethod
    def get_appropriate_unit(cls, unit_system, unit_type, amount=None):
        """Get the most appropriate unit for a given amount and system"""
        preferred = cls.get_preferred_units(unit_system)

        if unit_type == "weight":
            if amount is None:
                return preferred["weight_small"]

            if unit_system == "metric":
                # Use kg for amounts > 500g
                return "kg" if amount >= 500 else "g"
            else:
                # Use lb for amounts > 8oz
                return "lb" if amount >= 8 else "oz"

        elif unit_type == "volume":
            return preferred["volume_large"]  # Usually batch sizes

        elif unit_type == "temperature":
            return preferred["temperature"]

        return preferred.get(unit_type, preferred["weight_small"])

    @classmethod
    def normalize_ingredient_data(cls, ingredient_data, target_unit_system):
        """Convert ingredient data to target unit system"""
        if not ingredient_data:
            return ingredient_data

        converted = ingredient_data.copy()

        # Convert amount and unit
        if "amount" in converted and "unit" in converted:
            current_unit = converted["unit"]

            # Handle 'each'/'item' units - keep as-is for internal storage
            if current_unit.lower() in ["each", "item"]:
                # Return as-is for internal storage
                # Will be converted for BeerXML export
                return converted

            # Determine if it's weight or volume
            if current_unit.lower() in [
                key.lower() for key in cls.WEIGHT_TO_GRAMS.keys()
            ]:
                # It's a weight unit
                target_unit = cls.get_appropriate_unit(
                    target_unit_system, "weight", converted["amount"]
                )
                converted["amount"] = cls.convert_weight(
                    converted["amount"], current_unit, target_unit
                )
                converted["unit"] = target_unit

                # Apply brewing precision rounding based on ingredient type
                ingredient_type = converted.get("type", "general")
                converted["amount"] = cls.round_to_brewing_precision(
                    converted["amount"],
                    ingredient_type,
                    target_unit_system,
                    target_unit,
                )

            elif current_unit.lower() in [
                key.lower() for key in cls.VOLUME_TO_LITERS.keys()
            ]:
                # It's a volume unit
                target_unit = cls.get_appropriate_unit(target_unit_system, "volume")
                converted["amount"] = cls.convert_volume(
                    converted["amount"], current_unit, target_unit
                )
                converted["unit"] = target_unit

        return converted

    @classmethod
    def validate_unit(cls, unit, unit_type="weight"):
        """Validate if a unit is recognized"""
        unit_lower = unit.lower()

        if unit_type == "weight":
            return unit_lower in [key.lower() for key in cls.WEIGHT_TO_GRAMS.keys()]
        elif unit_type == "volume":
            return unit_lower in [key.lower() for key in cls.VOLUME_TO_LITERS.keys()]
        elif unit_type == "temperature":
            return unit_lower in ["c", "f", "celsius", "fahrenheit"]

        return False

    @classmethod
    def get_base_units(cls, unit_system):
        """Get base units for a given unit system"""
        if unit_system == "metric":
            return {"weight": "g", "volume": "ml", "temperature": "C"}
        else:  # imperial
            return {"weight": "oz", "volume": "floz", "temperature": "F"}

    @classmethod
    def normalize_to_base_unit(cls, amount, current_unit, unit_system):
        """
        Convert any unit to appropriate base unit for the given unit system

        Args:
            amount: Amount to convert
            current_unit: Current unit of the amount
            unit_system: Target unit system ('metric' or 'imperial')

        Returns:
            Tuple of (converted_amount, base_unit)
        """
        base_units = cls.get_base_units(unit_system)
        current_unit_lower = current_unit.lower()

        # Determine if it's weight or volume based
        if current_unit_lower in [key.lower() for key in cls.WEIGHT_TO_GRAMS.keys()]:
            # It's a weight unit
            target_unit = base_units["weight"]
            converted_amount = cls.convert_weight(amount, current_unit, target_unit)
            return round(converted_amount, 2), target_unit

        elif current_unit_lower in [key.lower() for key in cls.VOLUME_TO_LITERS.keys()]:
            # It's a volume unit
            target_unit = base_units["volume"]
            converted_amount = cls.convert_volume(amount, current_unit, target_unit)
            return round(converted_amount, 2), target_unit

        else:
            # Keep non-convertible units as-is (e.g., pkg, tsp, etc.)
            return amount, current_unit

    @classmethod
    def convert_for_display(cls, amount, base_unit, user_preference):
        """
        Convert from base units to user-friendly display units

        Args:
            amount: Amount in base units
            base_unit: Base unit ('g', 'oz', 'ml', 'floz')
            user_preference: User's preferred unit system ('metric' or 'imperial')

        Returns:
            Dict with 'amount' and 'unit' keys for display
        """
        # For metric base units
        if base_unit == "g" and user_preference == "metric":
            if amount >= 1000:
                return {"amount": round(amount / 1000, 3), "unit": "kg"}
            else:
                return {"amount": round(amount, 1), "unit": "g"}

        elif base_unit == "ml" and user_preference == "metric":
            if amount >= 1000:
                return {"amount": round(amount / 1000, 2), "unit": "l"}
            else:
                return {"amount": round(amount, 1), "unit": "ml"}

        # For imperial base units
        elif base_unit == "oz" and user_preference == "imperial":
            if amount >= 16:
                return {"amount": round(amount / 16, 3), "unit": "lb"}
            else:
                return {"amount": round(amount, 2), "unit": "oz"}

        elif base_unit == "floz" and user_preference == "imperial":
            if amount >= 128:  # 1 gallon = 128 floz
                return {"amount": round(amount / 128, 2), "unit": "gal"}
            elif amount >= 32:  # 1 quart = 32 floz
                return {"amount": round(amount / 32, 2), "unit": "qt"}
            elif amount >= 16:  # 1 pint = 16 floz
                return {"amount": round(amount / 16, 2), "unit": "pt"}
            else:
                return {"amount": round(amount, 1), "unit": "floz"}

        # Cross-system conversions (base unit doesn't match preference)
        elif base_unit == "g" and user_preference == "imperial":
            # Convert grams to imperial display
            oz_amount = cls.convert_weight(amount, "g", "oz")
            if oz_amount >= 16:
                return {"amount": round(oz_amount / 16, 3), "unit": "lb"}
            else:
                return {"amount": round(oz_amount, 2), "unit": "oz"}

        elif base_unit == "oz" and user_preference == "metric":
            # Convert ounces to metric display
            g_amount = cls.convert_weight(amount, "oz", "g")
            if g_amount >= 1000:
                return {"amount": round(g_amount / 1000, 3), "unit": "kg"}
            else:
                return {"amount": round(g_amount, 1), "unit": "g"}

        # Default: return as-is
        return {"amount": round(amount, 2), "unit": base_unit}

    @classmethod
    def is_base_unit(cls, unit, unit_system):
        """Check if a unit is already a base unit for the given system"""
        base_units = cls.get_base_units(unit_system)
        return unit.lower() in [bu.lower() for bu in base_units.values()]

    @classmethod
    def get_ingredient_target_unit(cls, ingredient_type, unit_system):
        """Get the target base unit for a specific ingredient type"""
        base_units = cls.get_base_units(unit_system)

        # Weight-based ingredients
        if ingredient_type in ["grain", "hop", "other"]:
            return base_units["weight"]

        # Volume-based ingredients (rare, but possible)
        elif ingredient_type == "liquid":
            return base_units["volume"]

        # Special cases - keep as-is
        elif ingredient_type == "yeast":
            return None  # Yeast often uses 'pkg' which we don't convert

        return base_units["weight"]  # Default to weight

    @classmethod
    def convert_time_to_minutes(cls, time_value, time_unit):
        """
        Convert time value to minutes for consistent storage

        Args:
            time_value: The time amount (int or float)
            time_unit: The time unit ('minutes', 'days', 'hours')

        Returns:
            Time in minutes as integer
        """
        if not time_value or not time_unit:
            return 0

        time_value = float(time_value)
        time_unit_lower = str(time_unit).lower()

        if time_unit_lower in ["minute", "minutes", "min"]:
            return int(time_value)
        elif time_unit_lower in ["day", "days", "d"]:
            return int(time_value * 1440)  # 1 day = 1440 minutes
        elif time_unit_lower in ["hour", "hours", "hr", "h"]:
            return int(time_value * 60)  # 1 hour = 60 minutes
        else:
            # Default to minutes if unknown unit
            return int(time_value)

    @classmethod
    def convert_minutes_to_time_unit(cls, minutes, target_unit):
        """
        Convert minutes back to target time unit for display/editing

        Args:
            minutes: Time in minutes (int)
            target_unit: Target unit ('minutes', 'days', 'hours')

        Returns:
            Time in target unit as float
        """
        if not minutes:
            return 0.0

        minutes = int(minutes)
        target_unit_lower = str(target_unit).lower()

        if target_unit_lower in ["minute", "minutes", "min"]:
            return float(minutes)
        elif target_unit_lower in ["day", "days", "d"]:
            return round(minutes / 1440.0, 1)  # Convert to days with 1 decimal
        elif target_unit_lower in ["hour", "hours", "hr", "h"]:
            return round(minutes / 60.0, 1)  # Convert to hours with 1 decimal
        else:
            # Default to minutes if unknown unit
            return float(minutes)

    @classmethod
    def get_time_unit_for_hop_use(cls, hop_use):
        """
        Get the appropriate time unit for a hop usage type

        Args:
            hop_use: The hop usage ('boil', 'whirlpool', 'dry-hop', etc.)

        Returns:
            Appropriate time unit string ('minutes' or 'days')
        """
        if not hop_use:
            return "minutes"

        hop_use_lower = str(hop_use).lower()

        if hop_use_lower == "dry-hop":
            return "days"
        else:
            return "minutes"
