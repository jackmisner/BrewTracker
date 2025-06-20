import pytest
from utils.unit_conversions import UnitConverter


class TestUnitConverter:
    """Comprehensive tests for UnitConverter class"""

    def test_weight_conversions_grams_base(self):
        """Test weight conversions with grams as base"""
        # Grams to grams
        assert UnitConverter.convert_weight(100, "g", "g") == 100
        assert UnitConverter.convert_weight(100, "gram", "grams") == 100

        # Grams to kg
        assert UnitConverter.convert_weight(1000, "g", "kg") == 1.0
        assert UnitConverter.convert_weight(500, "grams", "kilogram") == 0.5

        # Grams to oz
        result = UnitConverter.convert_weight(100, "g", "oz")
        assert abs(result - 3.527) < 0.01  # ~3.527 oz

        # Grams to lb
        result = UnitConverter.convert_weight(453.592, "g", "lb")
        assert abs(result - 1.0) < 0.001

    def test_weight_conversions_kilograms(self):
        """Test weight conversions with kilograms"""
        # Kg to grams
        assert UnitConverter.convert_weight(1, "kg", "g") == 1000
        assert UnitConverter.convert_weight(0.5, "kilograms", "grams") == 500

        # Kg to kg
        assert UnitConverter.convert_weight(2.5, "kg", "kg") == 2.5

        # Kg to lb
        result = UnitConverter.convert_weight(1, "kg", "lb")
        assert abs(result - 2.20462) < 0.001

        # Kg to oz
        result = UnitConverter.convert_weight(0.1, "kg", "oz")
        assert abs(result - 3.5274) < 0.001

    def test_weight_conversions_ounces(self):
        """Test weight conversions with ounces"""
        # Oz to grams
        result = UnitConverter.convert_weight(1, "oz", "g")
        assert abs(result - 28.3495) < 0.001

        # Oz to oz
        assert UnitConverter.convert_weight(5, "ounce", "ounces") == 5

        # Oz to lb
        assert UnitConverter.convert_weight(16, "oz", "lb") == 1.0

        # Oz to kg
        result = UnitConverter.convert_weight(35.274, "oz", "kg")
        assert abs(result - 1.0) < 0.01

    def test_weight_conversions_pounds(self):
        """Test weight conversions with pounds"""
        # Lb to grams
        result = UnitConverter.convert_weight(1, "lb", "g")
        assert abs(result - 453.592) < 0.001

        # Lb to kg
        result = UnitConverter.convert_weight(2.20462, "lb", "kg")
        assert abs(result - 1.0) < 0.001

        # Lb to oz
        assert UnitConverter.convert_weight(1, "pound", "ounces") == 16.0

        # Lb to lb
        assert UnitConverter.convert_weight(2.5, "pounds", "lbs") == 2.5

    def test_convert_to_pounds(self):
        """Test convert_to_pounds helper method"""
        assert UnitConverter.convert_to_pounds(16, "oz") == 1.0
        assert UnitConverter.convert_to_pounds(1, "kg") == pytest.approx(
            2.20462, rel=1e-3
        )
        assert UnitConverter.convert_to_pounds(453.592, "g") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_to_pounds(2, "lb") == 2.0

    def test_convert_to_ounces(self):
        """Test convert_to_ounces helper method"""
        assert UnitConverter.convert_to_ounces(1, "lb") == 16.0
        assert UnitConverter.convert_to_ounces(28.3495, "g") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_to_ounces(0.5, "kg") == pytest.approx(
            17.637, rel=1e-2
        )
        assert UnitConverter.convert_to_ounces(5, "oz") == 5.0

    def test_volume_conversions_liters_base(self):
        """Test volume conversions with liters as base"""
        # Liters to liters
        assert UnitConverter.convert_volume(1, "l", "L") == 1
        assert UnitConverter.convert_volume(2.5, "liter", "liters") == 2.5

        # Liters to ml
        assert UnitConverter.convert_volume(1, "l", "ml") == 1000
        assert UnitConverter.convert_volume(0.5, "liter", "milliliters") == 500

        # Liters to gallons
        result = UnitConverter.convert_volume(3.78541, "l", "gal")
        assert abs(result - 1.0) < 0.001

        # Liters to fluid ounces
        result = UnitConverter.convert_volume(1, "l", "floz")
        assert abs(result - 33.814) < 0.1

    def test_volume_conversions_milliliters(self):
        """Test volume conversions with milliliters"""
        # ML to liters
        assert UnitConverter.convert_volume(1000, "ml", "l") == 1.0
        assert UnitConverter.convert_volume(500, "milliliters", "liters") == 0.5

        # ML to ml
        assert UnitConverter.convert_volume(250, "ml", "milliliters") == 250

        # ML to fluid ounces
        result = UnitConverter.convert_volume(29.5735, "ml", "floz")
        assert abs(result - 1.0) < 0.001

    def test_volume_conversions_us_units(self):
        """Test US volume unit conversions"""
        # Gallons
        assert UnitConverter.convert_volume(1, "gal", "l") == pytest.approx(
            3.78541, rel=1e-3
        )
        assert UnitConverter.convert_volume(5, "gallon", "gallons") == 5

        # Quarts
        assert UnitConverter.convert_volume(4, "qt", "gal") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_volume(1, "quart", "l") == pytest.approx(
            0.946353, rel=1e-3
        )

        # Pints
        assert UnitConverter.convert_volume(2, "pt", "qt") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_volume(1, "pint", "l") == pytest.approx(
            0.473176, rel=1e-3
        )

        # Cups
        assert UnitConverter.convert_volume(2, "cup", "pt") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_volume(1, "cups", "l") == pytest.approx(
            0.236588, rel=1e-3
        )

        # Fluid ounces
        assert UnitConverter.convert_volume(8, "floz", "cup") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_volume(1, "fl_oz", "l") == pytest.approx(
            0.0295735, rel=1e-3
        )

    def test_convert_to_gallons(self):
        """Test convert_to_gallons helper method"""
        assert UnitConverter.convert_to_gallons(3.78541, "l") == pytest.approx(
            1.0, rel=1e-3
        )
        assert UnitConverter.convert_to_gallons(4, "qt") == pytest.approx(1.0, rel=1e-3)
        assert UnitConverter.convert_to_gallons(8, "pt") == pytest.approx(1.0, rel=1e-3)
        assert UnitConverter.convert_to_gallons(2, "gal") == 2.0

    def test_convert_to_liters(self):
        """Test convert_to_liters helper method"""
        assert UnitConverter.convert_to_liters(1, "gal") == pytest.approx(
            3.78541, rel=1e-3
        )
        assert UnitConverter.convert_to_liters(1000, "ml") == 1.0
        assert UnitConverter.convert_to_liters(1, "qt") == pytest.approx(
            0.946353, rel=1e-3
        )
        assert UnitConverter.convert_to_liters(5, "l") == 5.0

    def test_temperature_conversions(self):
        """Test temperature conversions"""
        # Fahrenheit to Celsius
        assert UnitConverter.convert_temperature(32, "F", "C") == 0.0
        assert UnitConverter.convert_temperature(212, "F", "C") == 100.0
        assert UnitConverter.convert_temperature(68, "F", "C") == 20.0

        # Celsius to Fahrenheit
        assert UnitConverter.convert_temperature(0, "C", "F") == 32.0
        assert UnitConverter.convert_temperature(100, "C", "F") == 212.0
        assert UnitConverter.convert_temperature(20, "C", "F") == 68.0

        # Same unit conversions
        assert UnitConverter.convert_temperature(25, "C", "C") == 25.0
        assert UnitConverter.convert_temperature(75, "F", "F") == 75.0

        # Case insensitive
        assert UnitConverter.convert_temperature(32, "f", "c") == 0.0
        assert UnitConverter.convert_temperature(0, "c", "f") == 32.0

    def test_fahrenheit_to_celsius(self):
        """Test direct fahrenheit_to_celsius method"""
        assert UnitConverter.fahrenheit_to_celsius(32) == 0.0
        assert UnitConverter.fahrenheit_to_celsius(212) == 100.0
        assert UnitConverter.fahrenheit_to_celsius(68) == 20.0
        assert UnitConverter.fahrenheit_to_celsius(-40) == pytest.approx(
            -40.0, rel=1e-3
        )

    def test_celsius_to_fahrenheit(self):
        """Test direct celsius_to_fahrenheit method"""
        assert UnitConverter.celsius_to_fahrenheit(0) == 32.0
        assert UnitConverter.celsius_to_fahrenheit(100) == 212.0
        assert UnitConverter.celsius_to_fahrenheit(20) == 68.0
        assert UnitConverter.celsius_to_fahrenheit(-40) == pytest.approx(
            -40.0, rel=1e-3
        )

    def test_get_preferred_units_metric(self):
        """Test getting preferred units for metric system"""
        units = UnitConverter.get_preferred_units("metric")

        assert units["weight_large"] == "kg"
        assert units["weight_small"] == "g"
        assert units["volume_large"] == "l"
        assert units["volume_small"] == "ml"
        assert units["temperature"] == "C"

    def test_get_preferred_units_imperial(self):
        """Test getting preferred units for imperial system"""
        units = UnitConverter.get_preferred_units("imperial")

        assert units["weight_large"] == "lb"
        assert units["weight_small"] == "oz"
        assert units["volume_large"] == "gal"
        assert units["volume_small"] == "floz"
        assert units["temperature"] == "F"

    def test_get_appropriate_unit_weight_metric(self):
        """Test getting appropriate weight units for metric system"""
        # Small amounts should use grams
        assert UnitConverter.get_appropriate_unit("metric", "weight", 100) == "g"
        assert UnitConverter.get_appropriate_unit("metric", "weight", 499) == "g"

        # Large amounts should use kg
        assert UnitConverter.get_appropriate_unit("metric", "weight", 500) == "kg"
        assert UnitConverter.get_appropriate_unit("metric", "weight", 1000) == "kg"

        # No amount defaults to small
        assert UnitConverter.get_appropriate_unit("metric", "weight") == "g"

    def test_get_appropriate_unit_weight_imperial(self):
        """Test getting appropriate weight units for imperial system"""
        # Small amounts should use ounces
        assert UnitConverter.get_appropriate_unit("imperial", "weight", 4) == "oz"
        assert UnitConverter.get_appropriate_unit("imperial", "weight", 7) == "oz"

        # Large amounts should use pounds
        assert UnitConverter.get_appropriate_unit("imperial", "weight", 8) == "lb"
        assert UnitConverter.get_appropriate_unit("imperial", "weight", 16) == "lb"

        # No amount defaults to small
        assert UnitConverter.get_appropriate_unit("imperial", "weight") == "oz"

    def test_get_appropriate_unit_other_types(self):
        """Test getting appropriate units for volume and temperature"""
        # Volume
        assert UnitConverter.get_appropriate_unit("metric", "volume") == "l"
        assert UnitConverter.get_appropriate_unit("imperial", "volume") == "gal"

        # Temperature
        assert UnitConverter.get_appropriate_unit("metric", "temperature") == "C"
        assert UnitConverter.get_appropriate_unit("imperial", "temperature") == "F"

    def test_normalize_ingredient_data_weight(self):
        """Test normalizing ingredient data with weight conversions"""
        # Convert from imperial to metric
        ingredient = {"amount": 1, "unit": "lb", "name": "Test Grain"}
        result = UnitConverter.normalize_ingredient_data(ingredient, "metric")

        assert result["unit"] == "g"
        assert abs(result["amount"] - 454) < 1  # ~0.454 kg
        assert result["name"] == "Test Grain"  # Other fields preserved

        # Convert from metric to imperial
        ingredient = {"amount": 500, "unit": "g", "name": "Test Hop"}
        result = UnitConverter.normalize_ingredient_data(ingredient, "imperial")

        assert result["unit"] == "lb"
        assert abs(result["amount"] - 1.1) < 0.1  # ~1.1 lb

    def test_normalize_ingredient_data_volume(self):
        """Test normalizing ingredient data with volume conversions"""
        # Convert volume units
        ingredient = {"amount": 1, "unit": "gal", "name": "Test Liquid"}
        result = UnitConverter.normalize_ingredient_data(ingredient, "metric")

        assert result["unit"] == "l"
        assert abs(result["amount"] - 3.785) < 0.01
        assert result["name"] == "Test Liquid"

    def test_normalize_ingredient_data_no_conversion_needed(self):
        """Test normalizing ingredient data when no conversion needed"""
        ingredient = {"amount": 5, "unit": "pkg", "name": "Yeast"}
        result = UnitConverter.normalize_ingredient_data(ingredient, "imperial")

        # Should remain unchanged for non-weight/volume units
        assert result == ingredient

    def test_normalize_ingredient_data_edge_cases(self):
        """Test normalizing ingredient data edge cases"""
        # None input
        assert UnitConverter.normalize_ingredient_data(None, "metric") is None

        # Empty dict
        result = UnitConverter.normalize_ingredient_data({}, "metric")
        assert result == {}

        # Missing amount or unit
        ingredient = {"name": "Test"}
        result = UnitConverter.normalize_ingredient_data(ingredient, "metric")
        assert result == ingredient

    def test_validate_unit_weight(self):
        """Test unit validation for weight units"""
        # Valid weight units
        assert UnitConverter.validate_unit("g", "weight") is True
        assert UnitConverter.validate_unit("kg", "weight") is True
        assert UnitConverter.validate_unit("oz", "weight") is True
        assert UnitConverter.validate_unit("lb", "weight") is True
        assert UnitConverter.validate_unit("pound", "weight") is True
        assert (
            UnitConverter.validate_unit("GRAMS", "weight") is True
        )  # Case insensitive

        # Invalid weight units
        assert UnitConverter.validate_unit("invalid", "weight") is False
        assert UnitConverter.validate_unit("gal", "weight") is False

    def test_validate_unit_volume(self):
        """Test unit validation for volume units"""
        # Valid volume units
        assert UnitConverter.validate_unit("l", "volume") is True
        assert UnitConverter.validate_unit("ml", "volume") is True
        assert UnitConverter.validate_unit("gal", "volume") is True
        assert UnitConverter.validate_unit("floz", "volume") is True
        assert UnitConverter.validate_unit("cup", "volume") is True
        assert (
            UnitConverter.validate_unit("LITERS", "volume") is True
        )  # Case insensitive

        # Invalid volume units
        assert UnitConverter.validate_unit("invalid", "volume") is False
        assert UnitConverter.validate_unit("kg", "volume") is False

    def test_validate_unit_temperature(self):
        """Test unit validation for temperature units"""
        # Valid temperature units
        assert UnitConverter.validate_unit("C", "temperature") is True
        assert UnitConverter.validate_unit("F", "temperature") is True
        assert UnitConverter.validate_unit("celsius", "temperature") is True
        assert UnitConverter.validate_unit("fahrenheit", "temperature") is True
        assert (
            UnitConverter.validate_unit("c", "temperature") is True
        )  # Case insensitive

        # Invalid temperature units
        assert UnitConverter.validate_unit("invalid", "temperature") is False
        assert (
            UnitConverter.validate_unit("K", "temperature") is False
        )  # Kelvin not supported

    def test_case_insensitive_conversions(self):
        """Test that all conversions are case insensitive"""
        # Weight conversions
        assert UnitConverter.convert_weight(
            1, "LB", "KG"
        ) == UnitConverter.convert_weight(1, "lb", "kg")
        assert UnitConverter.convert_weight(
            1, "Pound", "Kilogram"
        ) == UnitConverter.convert_weight(1, "pound", "kilogram")

        # Volume conversions
        assert UnitConverter.convert_volume(
            1, "GAL", "L"
        ) == UnitConverter.convert_volume(1, "gal", "l")
        assert UnitConverter.convert_volume(
            1, "Gallon", "Liter"
        ) == UnitConverter.convert_volume(1, "gallon", "liter")

    def test_same_unit_conversions(self):
        """Test that converting between same units returns original value"""
        # Weight
        assert UnitConverter.convert_weight(5.5, "kg", "kg") == 5.5
        assert UnitConverter.convert_weight(10, "oz", "oz") == 10

        # Volume
        assert UnitConverter.convert_volume(3.2, "gal", "gal") == 3.2
        assert UnitConverter.convert_volume(500, "ml", "ml") == 500

        # Temperature
        assert UnitConverter.convert_temperature(72, "F", "F") == 72
        assert UnitConverter.convert_temperature(20, "C", "C") == 20

    def test_edge_case_amounts(self):
        """Test conversions with edge case amounts"""
        # Zero amounts
        assert UnitConverter.convert_weight(0, "kg", "lb") == 0
        assert UnitConverter.convert_volume(0, "gal", "l") == 0

        # Very small amounts
        result = UnitConverter.convert_weight(0.001, "kg", "g")
        assert result == 1.0

        # Very large amounts
        result = UnitConverter.convert_weight(1000, "kg", "lb")
        assert abs(result - 2204.62) < 0.1

    def test_unknown_units_fallback(self):
        """Test behavior with unknown units"""
        # Should use fallback factor of 1.0 for unknown units
        result = UnitConverter.convert_weight(5, "unknown_unit", "g")
        assert result == 5.0  # 5 * 1.0 / 1.0

        result = UnitConverter.convert_volume(10, "unknown_unit", "l")
        assert result == 10.0  # 10 * 1.0 / 1.0
