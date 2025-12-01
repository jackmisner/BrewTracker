"""
Integration tests for unit conversion workflow via AI API.

Tests that the unit conversion workflow can be invoked through the
/api/ai/analyze-recipe endpoint with workflow_name parameter.
"""

import pytest

from services.ai.flowchart_ai_service import FlowchartAIService


class TestUnitConversionAPIIntegration:
    """Test unit conversion workflow integration with AI service."""

    @pytest.fixture
    def ai_service(self):
        """Get FlowchartAIService instance."""
        return FlowchartAIService()

    def test_imperial_to_metric_via_service(self, ai_service):
        """Test converting imperial recipe to metric via AI service."""
        imperial_recipe = {
            "name": "American IPA",
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
            "mash_temperature": 152,
            "mash_temp_unit": "F",
            "target_unit_system": "metric",
            "ingredients": [
                {"name": "Pale Malt", "type": "grain", "amount": 10.0, "unit": "lb"},
                {
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 2.0,
                    "unit": "oz",
                    "time": 60,
                },
            ],
        }

        # Invoke unit conversion workflow
        result = ai_service.analyze_recipe(
            imperial_recipe,
            style_id=None,
            unit_system="metric",
            workflow_name="unit_conversion",
        )

        # Verify success - check actual response fields
        assert "error" not in result
        assert "optimized_recipe" in result
        assert result.get("optimization_performed") is True

        # Verify optimized recipe has metric units
        optimized_recipe = result.get("optimized_recipe")
        assert optimized_recipe is not None
        assert optimized_recipe["batch_size_unit"] == "l"

        # Check ingredients converted
        for ingredient in optimized_recipe["ingredients"]:
            unit = ingredient.get("unit", "")
            if ingredient.get("type") in ["grain", "hop"]:
                assert unit.lower() in ["g", "kg"], f"Expected metric unit, got {unit}"

    def test_metric_to_imperial_via_service(self, ai_service):
        """Test converting metric recipe to imperial via AI service."""
        metric_recipe = {
            "name": "Czech Pilsner",
            "batch_size": 20.0,
            "batch_size_unit": "l",
            "efficiency": 75,
            "mash_temperature": 65,
            "mash_temp_unit": "C",
            "target_unit_system": "imperial",
            "ingredients": [
                {"name": "Pilsner Malt", "type": "grain", "amount": 4.5, "unit": "kg"},
                {"name": "Saaz", "type": "hop", "amount": 40, "unit": "g", "time": 60},
            ],
        }

        # Invoke unit conversion workflow
        result = ai_service.analyze_recipe(
            metric_recipe,
            style_id=None,
            unit_system="imperial",
            workflow_name="unit_conversion",
        )

        # Verify success - check actual response fields
        assert "error" not in result
        assert "optimized_recipe" in result
        assert result.get("optimization_performed") is True

        # Verify optimized recipe has imperial units
        optimized_recipe = result.get("optimized_recipe")
        assert optimized_recipe is not None
        assert optimized_recipe["batch_size_unit"] == "gal"

        # Check ingredients converted
        for ingredient in optimized_recipe["ingredients"]:
            unit = ingredient.get("unit", "")
            if ingredient.get("type") in ["grain", "hop"]:
                assert unit.lower() in [
                    "oz",
                    "lb",
                    "lbs",
                ], f"Expected imperial unit, got {unit}"

    def test_workflow_available_in_list(self, ai_service):
        """Test that unit_conversion workflow is available."""
        available_workflows = ai_service.get_available_workflows()

        assert "unit_conversion" in available_workflows

    def test_normalization_precision(self, ai_service):
        """Test that normalization produces sensible values."""
        # Imperial recipe with awkward amounts
        recipe = {
            "name": "Test Recipe",
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
            "target_unit_system": "metric",
            "ingredients": [
                # 3.5 lbs = 1587.57 g -> should normalize to 1600 g or 1.6 kg
                {"name": "Maris Otter", "type": "grain", "amount": 3.5, "unit": "lb"},
                # 1 oz = 28.3495 g -> should normalize to 30 g
                {
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "time": 60,
                },
            ],
        }

        result = ai_service.analyze_recipe(
            recipe,
            style_id=None,
            unit_system="metric",
            workflow_name="unit_conversion",
        )

        optimized_recipe = result.get("optimized_recipe")
        assert optimized_recipe is not None

        # Check Maris Otter normalized properly
        maris_otter = next(
            ing
            for ing in optimized_recipe["ingredients"]
            if ing["name"] == "Maris Otter"
        )
        # Should be 1.6 kg or 1600 g (both are acceptable)
        if maris_otter["unit"] == "kg":
            assert 1.55 < maris_otter["amount"] < 1.65, "Expected ~1.6 kg"
        else:
            assert 1575 < maris_otter["amount"] < 1625, "Expected ~1600 g"

        # Check Cascade normalized properly
        cascade = next(
            ing for ing in optimized_recipe["ingredients"] if ing["name"] == "Cascade"
        )
        assert cascade["unit"] == "g"
        assert 28 < cascade["amount"] < 32, "Expected ~30 g"

    def test_changes_reported(self, ai_service):
        """Test that conversion changes are properly reported."""
        recipe = {
            "name": "Test",
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
            "target_unit_system": "metric",
            "ingredients": [
                {"name": "Pale Malt", "type": "grain", "amount": 8.0, "unit": "lb"},
            ],
        }

        result = ai_service.analyze_recipe(
            recipe,
            style_id=None,
            unit_system="metric",
            workflow_name="unit_conversion",
        )

        # Check that optimization was performed
        assert (
            result.get("optimization_performed") is True
        ), "Expected optimization to be performed"

        # Check that optimized recipe is returned
        optimized_recipe = result.get("optimized_recipe")
        assert optimized_recipe is not None, "Expected optimized recipe"

        # Verify units were converted
        assert optimized_recipe["batch_size_unit"] == "l"
        for ingredient in optimized_recipe["ingredients"]:
            unit = ingredient.get("unit", "")
            if ingredient.get("type") in ["grain", "hop"]:
                assert unit.lower() in ["g", "kg"], f"Expected metric unit, got {unit}"
