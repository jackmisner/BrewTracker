"""
Tests for Recipe ORM Calculator

Tests formatting functions, color mapping, descriptions,
and recipe metric calculations for ORM models.
"""

from unittest.mock import MagicMock, Mock, patch

import pytest

from utils.recipe_orm_calculator import (
    calculate_abv,
    calculate_fg,
    calculate_ibu,
    calculate_og,
    calculate_srm,
    celsius_to_fahrenheit,
    fahrenheit_to_celsius,
    format_abv,
    format_gravity,
    format_ibu,
    format_srm,
    get_abv_description,
    get_color_from_srm,
    get_ibu_description,
    plato_to_specific_gravity,
    specific_gravity_to_plato,
)


class TestFormattingFunctions:
    """Test formatting functions for recipe metrics"""

    def test_format_gravity_valid(self):
        """Test gravity formatting with valid value"""
        assert format_gravity(1.050) == "1.050"
        assert format_gravity(1.1234) == "1.123"
        assert format_gravity("1.045") == "1.045"

    def test_format_gravity_none(self):
        """Test gravity formatting with None value"""
        assert format_gravity(None) == "1.000"
        assert format_gravity(0) == "1.000"  # 0 is falsy, so returns default

    def test_format_abv_valid(self):
        """Test ABV formatting with valid value"""
        assert format_abv(5.2) == "5.2%"
        assert format_abv(5.89) == "5.9%"
        assert format_abv("4.5") == "4.5%"

    def test_format_abv_none(self):
        """Test ABV formatting with None value"""
        assert format_abv(None) == "0.0%"
        assert format_abv(0) == "0.0%"

    def test_format_ibu_valid(self):
        """Test IBU formatting with valid value"""
        assert format_ibu(25.7) == "26"
        assert format_ibu(25.2) == "25"
        assert format_ibu(40) == "40"

    def test_format_ibu_none(self):
        """Test IBU formatting with None value"""
        assert format_ibu(None) == "0"
        assert format_ibu(0) == "0"

    def test_format_srm_valid(self):
        """Test SRM formatting with valid value"""
        assert format_srm(4.5) == "4.5"
        assert format_srm(4.67) == "4.7"
        assert format_srm("8.2") == "8.2"

    def test_format_srm_none(self):
        """Test SRM formatting with None value"""
        assert format_srm(None) == "0.0"
        assert format_srm(0) == "0.0"


class TestColorMapping:
    """Test SRM color mapping function"""

    def test_get_color_from_srm_very_light(self):
        """Test very light beer colors"""
        assert get_color_from_srm(0) == "#FFE699"
        assert get_color_from_srm(1) == "#FFD878"
        assert get_color_from_srm(2) == "#FFD878"

    def test_get_color_from_srm_light(self):
        """Test light beer colors"""
        assert get_color_from_srm(3) == "#FFCA5A"
        assert get_color_from_srm(4) == "#FFBF42"
        assert get_color_from_srm(6) == "#FBB123"

    def test_get_color_from_srm_medium(self):
        """Test medium beer colors"""
        assert get_color_from_srm(8) == "#F8A600"
        assert get_color_from_srm(10) == "#F39C00"
        assert get_color_from_srm(13) == "#EA8F00"

    def test_get_color_from_srm_dark(self):
        """Test dark beer colors"""
        assert get_color_from_srm(17) == "#E58500"
        assert get_color_from_srm(20) == "#D37600"
        assert get_color_from_srm(24) == "#CB6600"

    def test_get_color_from_srm_very_dark(self):
        """Test very dark beer colors"""
        assert get_color_from_srm(29) == "#C05600"
        assert get_color_from_srm(35) == "#A64C00"
        assert get_color_from_srm(40) == "#8D4000"

    def test_get_color_from_srm_none(self):
        """Test color mapping with None or invalid values"""
        assert get_color_from_srm(None) == "#FFE699"
        assert get_color_from_srm(-1) == "#FFE699"


class TestDescriptionFunctions:
    """Test description functions for recipe metrics"""

    def test_get_ibu_description_ranges(self):
        """Test IBU description ranges"""
        assert get_ibu_description(0) == "No Perceived Bitterness"
        assert get_ibu_description(7) == "Very Low Bitterness"
        assert get_ibu_description(15) == "Low Bitterness"
        assert get_ibu_description(25) == "Moderate Bitterness"
        assert get_ibu_description(35) == "Strong Bitterness"
        assert get_ibu_description(50) == "Very Strong Bitterness"
        assert get_ibu_description(70) == "Extremely Bitter"

    def test_get_abv_description_ranges(self):
        """Test ABV description ranges"""
        assert get_abv_description(2.5) == "Session Beer"
        assert get_abv_description(4.5) == "Standard"
        assert get_abv_description(6.5) == "High ABV"
        assert get_abv_description(9.0) == "Very High ABV"
        assert get_abv_description(12.0) == "Extremely High ABV"


class TestConversionFunctions:
    """Test brewing conversion functions"""

    def test_specific_gravity_to_plato(self):
        """Test specific gravity to Plato conversion"""
        # Test common SG values
        plato = specific_gravity_to_plato(1.040)
        assert 9.9 < plato < 10.1  # ~10°P

        plato = specific_gravity_to_plato(1.050)
        assert 12.3 < plato < 12.5  # ~12.4°P

    def test_plato_to_specific_gravity(self):
        """Test Plato to specific gravity conversion"""
        # Test common Plato values
        sg = plato_to_specific_gravity(10)
        assert 1.039 < sg < 1.041  # ~1.040

        sg = plato_to_specific_gravity(12)
        assert 1.047 < sg < 1.049  # ~1.048

    @patch("utils.recipe_orm_calculator.UnitConverter")
    def test_fahrenheit_to_celsius(self, mock_converter):
        """Test Fahrenheit to Celsius conversion"""
        mock_converter.fahrenheit_to_celsius.return_value = 20.0

        result = fahrenheit_to_celsius(68)

        assert result == 20.0
        mock_converter.fahrenheit_to_celsius.assert_called_once_with(68)

    @patch("utils.recipe_orm_calculator.UnitConverter")
    def test_celsius_to_fahrenheit(self, mock_converter):
        """Test Celsius to Fahrenheit conversion"""
        mock_converter.celsius_to_fahrenheit.return_value = 68.0

        result = celsius_to_fahrenheit(20)

        assert result == 68.0
        mock_converter.celsius_to_fahrenheit.assert_called_once_with(20)


class TestRecipeCalculations:
    """Test recipe metric calculations"""

    def setup_method(self):
        """Set up test fixtures"""
        # Mock recipe ingredient
        self.mock_grain = Mock()
        self.mock_grain.type = "grain"
        self.mock_grain.potential = 1.037
        self.mock_grain.amount = 10
        self.mock_grain.unit = "lb"
        self.mock_grain.color = 2

        self.mock_hop = Mock()
        self.mock_hop.type = "hop"
        self.mock_hop.alpha_acid = 5.0
        self.mock_hop.amount = 1
        self.mock_hop.unit = "oz"
        self.mock_hop.time = 60
        self.mock_hop.use = "boil"

        self.mock_yeast = Mock()
        self.mock_yeast.type = "yeast"
        self.mock_yeast.attenuation = 75
        self.mock_yeast.ingredient_id = "yeast_id"

        # Mock recipe
        self.mock_recipe = Mock()
        self.mock_recipe.batch_size = 5.0
        self.mock_recipe.batch_size_unit = "gal"
        self.mock_recipe.efficiency = 75
        self.mock_recipe.ingredients = [self.mock_grain, self.mock_hop, self.mock_yeast]

    @patch("utils.recipe_orm_calculator.UnitConverter")
    @patch("utils.recipe_orm_calculator.convert_to_pounds")
    @patch("utils.recipe_orm_calculator.calc_og_core")
    def test_calculate_og_success(
        self, mock_calc_og, mock_convert_pounds, mock_converter
    ):
        """Test OG calculation with valid recipe"""
        mock_converter.convert_volume.return_value = 5.0
        mock_convert_pounds.return_value = 10.0
        mock_calc_og.return_value = 1.050

        result = calculate_og(self.mock_recipe)

        assert result == 1.050
        mock_converter.convert_volume.assert_called_once_with(5.0, "gal", "gal")
        mock_convert_pounds.assert_called_once_with(10, "lb")
        mock_calc_og.assert_called_once_with(10.37, 5.0, 75)  # 10 * 1.037 = 10.37

    def test_calculate_og_no_recipe(self):
        """Test OG calculation with no recipe"""
        assert calculate_og(None) == 1.000

    def test_calculate_og_no_ingredients(self):
        """Test OG calculation with no ingredients attribute"""
        mock_recipe = Mock()
        del mock_recipe.ingredients
        assert calculate_og(mock_recipe) == 1.000

    @patch("utils.recipe_orm_calculator.calculate_og")
    @patch("utils.recipe_orm_calculator.calc_fg_core")
    @patch("services.attenuation_service.AttenuationService")
    def test_calculate_fg_success(
        self, mock_attenuation_service, mock_calc_fg, mock_calculate_og
    ):
        """Test FG calculation with valid recipe"""
        mock_calculate_og.return_value = 1.050
        mock_calc_fg.return_value = 1.012
        mock_attenuation_service.get_improved_attenuation_estimate.return_value = 80

        result = calculate_fg(self.mock_recipe)

        assert result == 1.012
        mock_calculate_og.assert_called_once_with(self.mock_recipe)
        mock_calc_fg.assert_called_once_with(1.050, 80)

    @patch("utils.recipe_orm_calculator.calculate_og")
    @patch("utils.recipe_orm_calculator.calc_fg_core")
    @patch("services.attenuation_service.AttenuationService")
    def test_calculate_fg_fallback_attenuation(
        self, mock_attenuation_service, mock_calc_fg, mock_calculate_og
    ):
        """Test FG calculation falling back to theoretical attenuation"""
        mock_calculate_og.return_value = 1.050
        mock_calc_fg.return_value = 1.012
        mock_attenuation_service.get_improved_attenuation_estimate.return_value = None

        result = calculate_fg(self.mock_recipe)

        assert result == 1.012
        mock_calc_fg.assert_called_once_with(1.050, 75)  # Falls back to 75%

    def test_calculate_fg_no_recipe(self):
        """Test FG calculation with no recipe"""
        assert calculate_fg(None) == 1.000

    @patch("utils.recipe_orm_calculator.calculate_og")
    @patch("utils.recipe_orm_calculator.calculate_fg")
    @patch("utils.recipe_orm_calculator.calc_abv_core")
    def test_calculate_abv_success(
        self, mock_calc_abv, mock_calculate_fg, mock_calculate_og
    ):
        """Test ABV calculation with valid values"""
        mock_calculate_og.return_value = 1.050
        mock_calculate_fg.return_value = 1.012
        mock_calc_abv.return_value = 5.0

        result = calculate_abv(self.mock_recipe)

        assert result == 5.0
        mock_calc_abv.assert_called_once_with(1.050, 1.012)

    @patch("utils.recipe_orm_calculator.UnitConverter")
    @patch("utils.recipe_orm_calculator.convert_to_ounces")
    @patch("utils.recipe_orm_calculator.calculate_og")
    @patch("utils.recipe_orm_calculator.calc_ibu_core")
    def test_calculate_ibu_success(
        self, mock_calc_ibu, mock_calculate_og, mock_convert_oz, mock_converter
    ):
        """Test IBU calculation with valid recipe"""
        mock_converter.convert_volume.return_value = 5.0
        mock_convert_oz.return_value = 1.0
        mock_calculate_og.return_value = 1.050
        mock_calc_ibu.return_value = 30.0

        result = calculate_ibu(self.mock_recipe)

        assert result == 30.0
        mock_convert_oz.assert_called_once_with(1, "oz")
        mock_calc_ibu.assert_called_once_with([(1.0, 5.0, 60, "boil")], 1.050, 5.0)

    def test_calculate_ibu_no_recipe(self):
        """Test IBU calculation with no recipe"""
        assert calculate_ibu(None) == 0.0

    def test_calculate_ibu_no_hops(self):
        """Test IBU calculation with no hops"""
        mock_recipe = Mock()
        mock_recipe.ingredients = [self.mock_grain, self.mock_yeast]
        mock_recipe.batch_size = 5.0
        mock_recipe.batch_size_unit = "gal"

        with patch("utils.recipe_orm_calculator.UnitConverter") as mock_converter:
            mock_converter.convert_volume.return_value = 5.0
            with patch("utils.recipe_orm_calculator.calculate_og") as mock_og:
                mock_og.return_value = 1.050
                with patch(
                    "utils.recipe_orm_calculator.calc_ibu_core"
                ) as mock_calc_ibu:
                    mock_calc_ibu.return_value = 0.0

                    result = calculate_ibu(mock_recipe)

                    assert result == 0.0
                    mock_calc_ibu.assert_called_once_with([], 1.050, 5.0)

    @patch("utils.recipe_orm_calculator.UnitConverter")
    @patch("utils.recipe_orm_calculator.convert_to_pounds")
    @patch("utils.recipe_orm_calculator.calc_srm_core")
    def test_calculate_srm_success(
        self, mock_calc_srm, mock_convert_pounds, mock_converter
    ):
        """Test SRM calculation with valid recipe"""
        mock_converter.convert_volume.return_value = 5.0
        mock_convert_pounds.return_value = 10.0
        mock_calc_srm.return_value = 4.5

        result = calculate_srm(self.mock_recipe)

        assert result == 4.5
        mock_convert_pounds.assert_called_once_with(10, "lb")
        mock_calc_srm.assert_called_once_with([(10.0, 2)], 5.0)

    def test_calculate_srm_no_recipe(self):
        """Test SRM calculation with no recipe"""
        assert calculate_srm(None) == 0.0

    def test_calculate_srm_no_grains(self):
        """Test SRM calculation with no grains"""
        mock_recipe = Mock()
        mock_recipe.ingredients = [self.mock_hop, self.mock_yeast]
        mock_recipe.batch_size = 5.0
        mock_recipe.batch_size_unit = "gal"

        with patch("utils.recipe_orm_calculator.UnitConverter") as mock_converter:
            mock_converter.convert_volume.return_value = 5.0
            with patch("utils.recipe_orm_calculator.calc_srm_core") as mock_calc_srm:
                mock_calc_srm.return_value = 0.0

                result = calculate_srm(mock_recipe)

                assert result == 0.0
                mock_calc_srm.assert_called_once_with([], 5.0)

    def test_calculate_ibu_invalid_hop_data(self):
        """Test IBU calculation with invalid hop data"""
        # Create hop with missing alpha acid
        invalid_hop = Mock()
        invalid_hop.type = "hop"
        invalid_hop.alpha_acid = None
        invalid_hop.amount = 1
        invalid_hop.unit = "oz"
        invalid_hop.time = 60
        invalid_hop.use = "boil"

        mock_recipe = Mock()
        mock_recipe.ingredients = [invalid_hop]
        mock_recipe.batch_size = 5.0
        mock_recipe.batch_size_unit = "gal"

        with patch("utils.recipe_orm_calculator.UnitConverter") as mock_converter:
            mock_converter.convert_volume.return_value = 5.0
            with patch("utils.recipe_orm_calculator.calculate_og") as mock_og:
                mock_og.return_value = 1.050
                with patch(
                    "utils.recipe_orm_calculator.calc_ibu_core"
                ) as mock_calc_ibu:
                    mock_calc_ibu.return_value = 0.0

                    result = calculate_ibu(mock_recipe)

                    # Should skip invalid hop data
                    assert result == 0.0
                    mock_calc_ibu.assert_called_once_with([], 1.050, 5.0)

    def test_calculate_srm_invalid_grain_data(self):
        """Test SRM calculation with invalid grain data"""
        # Create grain with missing color
        invalid_grain = Mock()
        invalid_grain.type = "grain"
        invalid_grain.potential = 1.037
        invalid_grain.amount = 10
        invalid_grain.unit = "lb"
        invalid_grain.color = None

        mock_recipe = Mock()
        mock_recipe.ingredients = [invalid_grain]
        mock_recipe.batch_size = 5.0
        mock_recipe.batch_size_unit = "gal"

        with patch("utils.recipe_orm_calculator.UnitConverter") as mock_converter:
            mock_converter.convert_volume.return_value = 5.0
            with patch("utils.recipe_orm_calculator.calc_srm_core") as mock_calc_srm:
                mock_calc_srm.return_value = 0.0

                result = calculate_srm(mock_recipe)

                # Should skip invalid grain data
                assert result == 0.0
                mock_calc_srm.assert_called_once_with([], 5.0)

    def test_calculate_fg_no_yeast(self):
        """Test FG calculation with no yeast"""
        mock_recipe = Mock()
        mock_recipe.ingredients = [self.mock_grain, self.mock_hop]

        with patch("utils.recipe_orm_calculator.calculate_og") as mock_og:
            mock_og.return_value = 1.050
            with patch("utils.recipe_orm_calculator.calc_fg_core") as mock_calc_fg:
                mock_calc_fg.return_value = 1.050  # No attenuation

                result = calculate_fg(mock_recipe)

                # Should use 0% attenuation when no yeast
                mock_calc_fg.assert_called_once_with(1.050, 0)
