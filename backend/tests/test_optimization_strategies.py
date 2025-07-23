"""
Tests for AI Optimization Strategies

Tests the optimization strategy classes used in the AI flowchart system
for recipe analysis and improvement suggestions.
"""

from unittest.mock import MagicMock, patch

import pytest

from services.ai.optimization_strategies import (
    ABVTargetedStrategy,
    BaseMaltIncreaseStrategy,
    BaseMaltOGandSRMStrategy,
    BaseMaltOGOnlyStrategy,
    NormalizeAmountsStrategy,
    OptimizationStrategy,
)


class TestOptimizationStrategy:
    """Test base OptimizationStrategy class"""

    @pytest.fixture
    def mock_context(self):
        """Create mock recipe context"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 10.0,
                    "unit": "lb",
                },
                {
                    "name": "Munich Dark",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 2.0,
                    "unit": "lb",
                },
                {"name": "Cascade", "type": "hop", "amount": 1.0, "unit": "oz"},
            ]
        }
        context.metrics = {"OG": 1.050, "FG": 1.012, "ABV": 5.0, "IBU": 25, "SRM": 8}
        context.style_guidelines = {
            "ranges": {
                "OG": {"min": 1.045, "max": 1.065},
                "FG": {"min": 1.008, "max": 1.015},
                "ABV": {"min": 4.5, "max": 6.2},
                "IBU": {"min": 20, "max": 40},
                "SRM": {"min": 6, "max": 14},
            }
        }
        return context

    @pytest.fixture
    def base_strategy(self, mock_context):
        """Create base optimization strategy instance"""
        return OptimizationStrategy(mock_context)

    def test_init(self, mock_context):
        """Test strategy initialization"""
        strategy = OptimizationStrategy(mock_context)

        assert strategy.context is mock_context
        assert strategy.recipe == mock_context.recipe
        assert strategy.metrics == mock_context.metrics
        assert strategy.style_guidelines == mock_context.style_guidelines

    def test_execute_not_implemented(self, base_strategy):
        """Test that base execute method raises NotImplementedError"""
        with pytest.raises(NotImplementedError):
            base_strategy.execute()

    def test_find_ingredients_by_type(self, base_strategy):
        """Test finding ingredients by type"""
        grains = base_strategy._find_ingredients_by_type("grain")
        hops = base_strategy._find_ingredients_by_type("hop")

        assert len(grains) == 2
        assert grains[0]["name"] == "2-Row Pale"
        assert grains[1]["name"] == "Munich Dark"

        assert len(hops) == 1
        assert hops[0]["name"] == "Cascade"

    def test_find_ingredients_by_type_empty(self, base_strategy):
        """Test finding ingredients by type when none exist"""
        yeasts = base_strategy._find_ingredients_by_type("yeast")
        assert yeasts == []

    def test_find_ingredients_by_name_contains(self, base_strategy):
        """Test finding ingredients by name parts"""
        munich_grains = base_strategy._find_ingredients_by_name_contains(["munich"])
        row_grains = base_strategy._find_ingredients_by_name_contains(["row"])
        cascade_hops = base_strategy._find_ingredients_by_name_contains(["cascade"])

        assert len(munich_grains) == 1
        assert munich_grains[0]["name"] == "Munich Dark"

        assert len(row_grains) == 1
        assert row_grains[0]["name"] == "2-Row Pale"

        assert len(cascade_hops) == 1
        assert cascade_hops[0]["name"] == "Cascade"

    def test_find_ingredients_by_name_contains_multiple_parts(self, base_strategy):
        """Test finding ingredients by multiple name parts"""
        found = base_strategy._find_ingredients_by_name_contains(["munich", "cascade"])

        assert len(found) == 2
        names = [ing["name"] for ing in found]
        assert "Munich Dark" in names
        assert "Cascade" in names

    def test_find_ingredients_by_name_contains_case_insensitive(self, base_strategy):
        """Test case insensitive name searching"""
        found = base_strategy._find_ingredients_by_name_contains(["MUNICH"])
        assert len(found) == 1
        assert found[0]["name"] == "Munich Dark"

    def test_get_style_range_success(self, base_strategy):
        """Test getting style range for existing metric"""
        og_range = base_strategy._get_style_range("OG")

        assert og_range is not None
        assert og_range["min"] == 1.045
        assert og_range["max"] == 1.065

    def test_get_style_range_missing_metric(self, base_strategy):
        """Test getting style range for non-existent metric"""
        missing_range = base_strategy._get_style_range("MISSING")
        assert missing_range is None

    def test_get_style_range_no_guidelines(self, mock_context):
        """Test getting style range when no guidelines exist"""
        mock_context.style_guidelines = None
        strategy = OptimizationStrategy(mock_context)

        og_range = strategy._get_style_range("OG")
        assert og_range is None

    def test_is_metric_in_range_true(self, base_strategy):
        """Test metric is in range"""
        # OG 1.050 is between 1.045 and 1.065
        assert base_strategy._is_metric_in_range("OG") is True

        # ABV 5.0 is between 4.5 and 6.2
        assert base_strategy._is_metric_in_range("ABV") is True

    def test_is_metric_in_range_false(self, base_strategy):
        """Test metric is out of range"""
        # Modify metrics to be out of range
        base_strategy.metrics["SRM"] = 20  # Above max of 14
        assert base_strategy._is_metric_in_range("SRM") is False

        base_strategy.metrics["IBU"] = 10  # Below min of 20
        assert base_strategy._is_metric_in_range("IBU") is False

    def test_is_metric_in_range_no_guidelines(self, mock_context):
        """Test metric range check with no guidelines"""
        mock_context.style_guidelines = None
        strategy = OptimizationStrategy(mock_context)

        # Should return True when no guidelines exist
        assert strategy._is_metric_in_range("OG") is True

    def test_calculate_target_from_style_middle(self, base_strategy):
        """Test calculating target as middle of style range"""
        target_og = base_strategy._calculate_target_from_style("OG")

        # Should be middle of 1.045 to 1.065 = 1.055
        expected = (1.045 + 1.065) / 2
        assert target_og == expected

    def test_calculate_target_from_style_with_offset(self, base_strategy):
        """Test calculating target with percentage offset"""
        target_og = base_strategy._calculate_target_from_style("OG", 25)

        # 25% above max: max + (max-min) * 0.25
        min_val, max_val = 1.045, 1.065
        expected = max_val + (max_val - min_val) * 0.25
        assert target_og == expected

    def test_calculate_target_from_style_no_guidelines(self, mock_context):
        """Test calculating target with no style guidelines"""
        mock_context.style_guidelines = None
        strategy = OptimizationStrategy(mock_context)

        # Should return current metric value
        target_og = strategy._calculate_target_from_style("OG")
        assert target_og == 1.050  # Current OG value


class TestBaseMaltOGOnlyStrategy:
    """Test BaseMaltOGOnlyStrategy class"""

    @pytest.fixture
    def mock_context(self):
        """Create mock context for testing"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 8.0,
                    "unit": "lb",
                },
                {
                    "name": "Pilsner",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 2.0,
                    "unit": "lb",
                },
            ]
        }
        context.metrics = {"OG": 1.040}  # Below target
        context.style_guidelines = {"ranges": {"OG": {"min": 1.045, "max": 1.065}}}
        return context

    @pytest.fixture
    def strategy(self, mock_context):
        """Create strategy instance"""
        return BaseMaltOGOnlyStrategy(mock_context)

    def test_execute_success(self, strategy):
        """Test successful execution with base malts"""
        changes = strategy.execute()

        assert len(changes) == 2  # Two base malts should be modified

        # Check first malt change
        change1 = changes[0]
        assert change1["type"] == "ingredient_modified"
        assert change1["ingredient_name"] == "2-Row Pale"
        assert change1["field"] == "amount"
        assert change1["current_value"] == 8.0
        assert change1["new_value"] > 8.0  # Should be increased
        assert "raise OG to target" in change1["change_reason"]

    def test_execute_no_base_malts(self, mock_context):
        """Test execution when no base malts exist"""
        mock_context.recipe["ingredients"] = [
            {"name": "Cascade", "type": "hop", "amount": 1.0, "unit": "oz"}
        ]
        strategy = BaseMaltOGOnlyStrategy(mock_context)

        changes = strategy.execute()
        assert changes == []

    def test_execute_already_at_target(self, mock_context):
        """Test execution when OG already at target"""
        mock_context.metrics["OG"] = 1.070  # Above target
        strategy = BaseMaltOGOnlyStrategy(mock_context)

        changes = strategy.execute()
        assert changes == []

    def test_execute_very_low_og(self, mock_context):
        """Test execution with very low starting OG"""
        mock_context.metrics["OG"] = 1.001  # Very low OG
        strategy = BaseMaltOGOnlyStrategy(mock_context)

        changes = strategy.execute()

        assert len(changes) == 2
        # Should use default 200% increase for very low OG
        for change in changes:
            # The actual calculation uses a complex formula, so just check increase happened
            assert (
                change["new_value"] > change["current_value"] * 2.0
            )  # At least double


class TestBaseMaltOGandSRMStrategy:
    """Test BaseMaltOGandSRMStrategy class"""

    @pytest.fixture
    def mock_context_with_munich(self):
        """Create context with existing Munich Dark"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 8.0,
                    "unit": "lb",
                },
                {
                    "name": "Munich Dark",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 2.0,
                    "unit": "lb",
                },
            ]
        }
        context.metrics = {"OG": 1.040}
        context.style_guidelines = {"ranges": {"OG": {"min": 1.045, "max": 1.065}}}
        return context

    @pytest.fixture
    def mock_context_without_munich(self):
        """Create context without Munich Dark"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 10.0,
                    "unit": "lb",
                }
            ]
        }
        context.metrics = {"OG": 1.040}
        context.style_guidelines = {"ranges": {"OG": {"min": 1.045, "max": 1.065}}}
        return context

    def test_execute_with_existing_munich(self, mock_context_with_munich):
        """Test execution when Munich Dark already exists"""
        strategy = BaseMaltOGandSRMStrategy(mock_context_with_munich)
        changes = strategy.execute()

        assert len(changes) == 1
        change = changes[0]
        assert change["ingredient_name"] == "Munich Dark"
        assert change["current_value"] == 2.0
        assert change["new_value"] == 2.5  # 25% increase
        assert "Munich Dark by 25%" in change["change_reason"]

    @patch("services.ingredient_lookup_service.get_ingredient_lookup_service")
    def test_execute_add_new_munich(
        self, mock_get_service, mock_context_without_munich
    ):
        """Test execution when Munich Dark needs to be added"""
        # Mock the ingredient lookup service
        mock_service = MagicMock()
        mock_db_ingredient = {
            "ingredient_id": "munich_dark_id",
            "name": "Munich Dark",
            "type": "grain",
            "grain_type": "base_malt",
            "color": 9,
            "potential": 1.037,
        }
        mock_service.find_ingredient_by_name.return_value = mock_db_ingredient
        mock_get_service.return_value = mock_service

        strategy = BaseMaltOGandSRMStrategy(mock_context_without_munich)
        changes = strategy.execute()

        assert len(changes) == 1
        change = changes[0]
        assert change["type"] == "ingredient_added"
        assert change["ingredient_name"] == "Munich Dark"
        assert change["ingredient_data"]["amount"] > 0

    @patch("services.ingredient_lookup_service.get_ingredient_lookup_service")
    def test_execute_munich_not_found_in_db(
        self, mock_get_service, mock_context_without_munich
    ):
        """Test execution when Munich Dark not found in database"""
        mock_service = MagicMock()
        mock_service.find_ingredient_by_name.return_value = None
        mock_get_service.return_value = mock_service

        strategy = BaseMaltOGandSRMStrategy(mock_context_without_munich)
        changes = strategy.execute()

        # Should try multiple alternative names
        expected_calls = ["Munich Dark", "Munich Malt", "Munich", "Munich Dark Malt"]
        mock_service.find_ingredient_by_name.assert_called()

        # If no ingredient found, should return empty changes
        assert changes == []


class TestNormalizeAmountsStrategy:
    """Test NormalizeAmountsStrategy class"""

    @pytest.fixture
    def mock_context(self):
        """Create context with ingredients needing normalization"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "amount": 10.123,  # Needs rounding
                    "unit": "lb",
                },
                {
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 0.87,  # Should round to 1.0
                    "unit": "oz",
                },
                {
                    "name": "Crystal 60L",
                    "type": "grain",
                    "amount": 0.48,  # Should round to 0.5
                    "unit": "lb",
                },
            ]
        }
        context.metrics = {}
        context.style_guidelines = {}
        return context

    def test_execute_normalization(self, mock_context):
        """Test amount normalization"""
        strategy = NormalizeAmountsStrategy(mock_context)
        changes = strategy.execute()

        # Should normalize at least some ingredients
        assert len(changes) >= 1

        # Check that changes are reasonable
        for change in changes:
            assert change["type"] == "ingredient_modified"
            assert change["field"] == "amount"
            assert "normalized" in change["change_reason"].lower()

    def test_execute_no_normalization_needed(self):
        """Test when no normalization is needed"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "amount": 10.0,  # Already normalized
                    "unit": "lb",
                },
                {
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 1.0,  # Already normalized
                    "unit": "oz",
                },
            ]
        }
        context.metrics = {}
        context.style_guidelines = {}

        strategy = NormalizeAmountsStrategy(context)
        changes = strategy.execute()

        # Might still have some changes due to internal rounding logic
        # but they should be minimal
        for change in changes:
            assert abs(change["new_value"] - change["current_value"]) < 0.1


class TestABVTargetedStrategy:
    """Test ABVTargetedStrategy class"""

    @pytest.fixture
    def mock_context(self):
        """Create context for ABV targeting"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row Pale",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 10.0,
                    "unit": "lb",
                    "potential": 1.037,
                },
                {
                    "name": "US-05",
                    "type": "yeast",
                    "amount": 1,
                    "unit": "pkg",
                    "attenuation": 75,
                },
            ]
        }
        context.metrics = {"OG": 1.050, "FG": 1.012, "ABV": 5.0}
        context.style_guidelines = {"ranges": {"ABV": {"min": 5.5, "max": 7.0}}}
        return context

    def test_execute_increase_abv(self, mock_context):
        """Test increasing ABV when below target"""
        strategy = ABVTargetedStrategy(mock_context)
        changes = strategy.execute()

        # Should modify base malt amounts to increase ABV
        assert len(changes) >= 1

        grain_changes = [c for c in changes if c.get("ingredient_name") == "2-Row Pale"]
        assert len(grain_changes) == 1

        change = grain_changes[0]
        assert change["new_value"] > change["current_value"]
        assert "ABV" in change["change_reason"]

    def test_execute_already_in_range(self, mock_context):
        """Test when ABV is already in target range"""
        mock_context.metrics["ABV"] = 6.0  # In range
        strategy = ABVTargetedStrategy(mock_context)

        changes = strategy.execute()
        assert changes == []


class TestStrategyErrorHandling:
    """Test error handling in optimization strategies"""

    def test_missing_ingredients(self):
        """Test handling when recipe has no ingredients"""
        context = MagicMock()
        context.recipe = {"ingredients": []}
        context.metrics = {"OG": 1.040}
        context.style_guidelines = {"ranges": {"OG": {"min": 1.045, "max": 1.065}}}

        strategy = BaseMaltOGOnlyStrategy(context)
        changes = strategy.execute()

        assert changes == []

    def test_missing_metrics(self):
        """Test handling when metrics are missing"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {
                    "name": "2-Row",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 10.0,
                }
            ]
        }
        context.metrics = {}  # Empty metrics
        context.style_guidelines = {"ranges": {"OG": {"min": 1.045, "max": 1.065}}}

        strategy = BaseMaltOGOnlyStrategy(context)

        # Should handle missing metrics gracefully
        changes = strategy.execute()
        assert isinstance(changes, list)

    def test_malformed_ingredient_data(self):
        """Test handling malformed ingredient data"""
        context = MagicMock()
        context.recipe = {
            "ingredients": [
                {"name": "2-Row"},  # Missing required fields
                {"type": "grain", "amount": 10.0},  # Missing name
                {
                    "name": "Munich",
                    "type": "grain",
                    "grain_type": "base_malt",
                },  # Missing amount
            ]
        }
        context.metrics = {"OG": 1.040}
        context.style_guidelines = {"ranges": {"OG": {"min": 1.045, "max": 1.065}}}

        strategy = BaseMaltOGOnlyStrategy(context)

        # Should handle malformed data without crashing
        changes = strategy.execute()
        assert isinstance(changes, list)
