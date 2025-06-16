class UnitConverter:
    """Unified utility class for all unit conversions"""

    # Weight conversions (to grams as base unit)
    WEIGHT_TO_GRAMS = {
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
    VOLUME_TO_LITERS = {
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
        return grams / cls.WEIGHT_TO_GRAMS.get(to_unit_lower, 1.0)

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
        return liters / cls.VOLUME_TO_LITERS.get(to_unit_lower, 1.0)

    @classmethod
    def convert_to_gallons(cls, amount, unit):
        """Convert various volume units to gallons"""
        return cls.convert_volume(amount, unit, "gal")

    @classmethod
    def convert_to_liters(cls, amount, unit):
        """Convert various volume units to liters"""
        return cls.convert_volume(amount, unit, "l")

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
