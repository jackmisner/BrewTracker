"""
Tests for unit conversion workflow.

Tests the standalone unit conversion and normalization workflow that converts
recipes between metric and imperial units with sensible normalization.
"""

import pytest

from services.ai.flowchart_engine import FlowchartEngine


class TestUnitConversionWorkflow:
    """Test unit conversion workflow for BeerXML import and standalone conversion."""

    def test_imperial_to_metric_conversion_with_normalization(self):
        """Test converting imperial recipe to metric with normalization."""
        # Imperial recipe (like from BeerXML)
        imperial_recipe = {
            "name": "American Pale Ale",
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
            "mash_temperature": 152,
            "mash_temp_unit": "F",
            "target_unit_system": "metric",  # Target system
            "ingredients": [
                {
                    "name": "Maris Otter",
                    "type": "grain",
                    "amount": 3.5,
                    "unit": "lb",
                },
                {
                    "name": "Munich Dark",
                    "type": "grain",
                    "amount": 12,  # 12 oz
                    "unit": "oz",
                },
                {
                    "name": "Saaz",
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "time": 60,
                },
            ],
        }

        # Load unit conversion workflow
        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )

        # Execute workflow
        result = engine.execute_workflow(imperial_recipe)

        # Verify success
        assert result.success is True
        assert len(result.changes) > 0

        # Verify batch size converted and normalized
        batch_changes = [
            c for c in result.changes if c.get("type") == "batch_size_converted"
        ]
        assert len(batch_changes) == 1
        assert batch_changes[0]["new_unit"] == "l"
        # 5 gal = 18.927 liters (approximately)
        assert 18.5 < batch_changes[0]["new_value"] < 19.5

        # Verify Maris Otter converted and normalized
        # 3.5 lbs = 1587.57 g -> normalized to 1600 g (nearest 25g) -> 1.6 kg
        maris_otter_changes = [
            c for c in result.changes if c.get("ingredient_name") == "Maris Otter"
        ]
        assert len(maris_otter_changes) == 2  # Conversion + normalization
        # Final normalized value should be around 1.6 kg
        final_ingredient = next(
            ing
            for ing in imperial_recipe["ingredients"]
            if ing["name"] == "Maris Otter"
        )
        assert final_ingredient["unit"] == "kg"
        assert 1.55 < final_ingredient["amount"] < 1.65  # Around 1.6 kg

        # Verify Saaz converted and normalized
        # 1 oz = 28.3495 g -> normalized to 30 g (nearest 5g)
        saaz_changes = [c for c in result.changes if c.get("ingredient_name") == "Saaz"]
        assert len(saaz_changes) == 2  # Conversion + normalization
        final_saaz = next(
            ing for ing in imperial_recipe["ingredients"] if ing["name"] == "Saaz"
        )
        assert final_saaz["unit"] == "g"
        assert 28 < final_saaz["amount"] < 32  # Around 30 g

        # Verify mash temperature converted
        # 152°F = 66.67°C
        temp_changes = [
            c for c in result.changes if c.get("type") == "temperature_converted"
        ]
        assert len(temp_changes) == 1
        assert temp_changes[0]["new_unit"] == "C"
        assert 66 < temp_changes[0]["new_value"] < 68

    def test_metric_to_imperial_conversion_with_normalization(self):
        """Test converting metric recipe to imperial with normalization."""
        # Metric recipe
        metric_recipe = {
            "name": "German Pilsner",
            "batch_size": 20.0,
            "batch_size_unit": "l",
            "efficiency": 75,
            "mash_temperature": 67,
            "mash_temp_unit": "C",
            "target_unit_system": "imperial",  # Target system
            "ingredients": [
                {
                    "name": "Munich Light",
                    "type": "grain",
                    "amount": 1.75,
                    "unit": "kg",
                },
                {
                    "name": "Pilsner Malt",
                    "type": "grain",
                    "amount": 500,
                    "unit": "g",
                },
                {
                    "name": "Sorachi Ace",
                    "type": "hop",
                    "amount": 30,
                    "unit": "g",
                    "time": 60,
                },
            ],
        }

        # Load unit conversion workflow
        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )

        # Execute workflow
        result = engine.execute_workflow(metric_recipe)

        # Verify success
        assert result.success is True
        assert len(result.changes) > 0

        # Verify batch size converted
        batch_changes = [
            c for c in result.changes if c.get("type") == "batch_size_converted"
        ]
        assert len(batch_changes) == 1
        assert batch_changes[0]["new_unit"] == "gal"
        # 20 L = 5.28 gal (approximately)
        assert 5.0 < batch_changes[0]["new_value"] < 5.5

        # Verify Munich Light converted and normalized
        # 1.75 kg = 61.73 oz = 3.858 lbs -> normalized to 3.875 lbs (nearest 0.125 lb)
        munich_changes = [
            c for c in result.changes if c.get("ingredient_name") == "Munich Light"
        ]
        assert len(munich_changes) == 2  # Conversion + normalization
        final_munich = next(
            ing for ing in metric_recipe["ingredients"] if ing["name"] == "Munich Light"
        )
        assert final_munich["unit"] == "lb"
        assert 3.8 < final_munich["amount"] < 3.95  # Around 3.875 lbs

        # Verify Sorachi Ace converted and normalized
        # 30 g = 1.058 oz -> normalized to 1.0 oz (nearest 0.25 oz)
        sorachi_changes = [
            c for c in result.changes if c.get("ingredient_name") == "Sorachi Ace"
        ]
        assert len(sorachi_changes) == 2  # Conversion + normalization
        final_sorachi = next(
            ing for ing in metric_recipe["ingredients"] if ing["name"] == "Sorachi Ace"
        )
        assert final_sorachi["unit"] == "oz"
        assert 0.75 < final_sorachi["amount"] < 1.25  # Around 1.0 oz

        # Verify mash temperature converted
        # 67°C = 152.6°F
        temp_changes = [
            c for c in result.changes if c.get("type") == "temperature_converted"
        ]
        assert len(temp_changes) == 1
        assert temp_changes[0]["new_unit"] == "F"
        assert 150 < temp_changes[0]["new_value"] < 155

    def test_already_metric_just_normalize(self):
        """Test recipe already in metric units - should only normalize."""
        metric_recipe = {
            "name": "Test Recipe",
            "batch_size": 19.0,
            "batch_size_unit": "l",
            "efficiency": 75,
            "target_unit_system": "metric",  # Target is metric (same as current)
            "ingredients": [
                {
                    "name": "Pale Malt",
                    "type": "grain",
                    "amount": 1587.57,  # Awkward amount
                    "unit": "g",
                },
                {
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 28.3,
                    "unit": "g",
                    "time": 60,
                },
            ],
        }

        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )
        result = engine.execute_workflow(metric_recipe)

        assert result.success is True

        # Should NOT have conversion changes, only normalization
        conversion_changes = [
            c for c in result.changes if c.get("type") == "ingredient_converted"
        ]
        assert len(conversion_changes) == 0

        # Should have normalization changes
        normalization_changes = [
            c for c in result.changes if c.get("type") == "ingredient_normalized"
        ]
        assert len(normalization_changes) > 0

        # Verify Pale Malt normalized
        # 1587.57 g -> 1600 g (nearest 25g) -> 1.6 kg
        final_malt = next(
            ing for ing in metric_recipe["ingredients"] if ing["name"] == "Pale Malt"
        )
        assert final_malt["unit"] == "kg"
        assert 1.55 < final_malt["amount"] < 1.65

        # Verify Cascade normalized
        # 28.3 g -> 30 g (nearest 5g)
        final_cascade = next(
            ing for ing in metric_recipe["ingredients"] if ing["name"] == "Cascade"
        )
        assert final_cascade["unit"] == "g"
        assert 28 < final_cascade["amount"] < 32

    def test_already_imperial_just_normalize(self):
        """Test recipe already in imperial units - should only normalize."""
        imperial_recipe = {
            "name": "Test Recipe",
            "batch_size": 5.5,
            "batch_size_unit": "gal",
            "efficiency": 75,
            "target_unit_system": "imperial",  # Target is imperial (same as current)
            "ingredients": [
                {
                    "name": "2-Row",
                    "type": "grain",
                    "amount": 3.858,  # Awkward amount
                    "unit": "lb",
                },
                {
                    "name": "Citra",
                    "type": "hop",
                    "amount": 1.058,  # Awkward amount
                    "unit": "oz",
                    "time": 60,
                },
            ],
        }

        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )
        result = engine.execute_workflow(imperial_recipe)

        assert result.success is True

        # Should NOT have conversion changes, only normalization
        conversion_changes = [
            c for c in result.changes if c.get("type") == "ingredient_converted"
        ]
        assert len(conversion_changes) == 0

        # Should have normalization changes
        normalization_changes = [
            c for c in result.changes if c.get("type") == "ingredient_normalized"
        ]
        assert len(normalization_changes) > 0

        # Verify 2-Row normalized
        # 3.858 lbs -> 3.875 lbs (nearest 0.125 lb)
        final_malt = next(
            ing for ing in imperial_recipe["ingredients"] if ing["name"] == "2-Row"
        )
        assert final_malt["unit"] == "lb"
        assert 3.85 < final_malt["amount"] < 3.90

        # Verify Citra normalized
        # 1.058 oz -> 1.0 oz (nearest 0.25 oz)
        final_citra = next(
            ing for ing in imperial_recipe["ingredients"] if ing["name"] == "Citra"
        )
        assert final_citra["unit"] == "oz"
        assert 0.9 < final_citra["amount"] < 1.1

    def test_workflow_validation(self):
        """Test that the workflow configuration is valid."""
        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )

        is_valid, errors = engine.validate_workflow()

        assert is_valid is True, f"Workflow validation failed: {errors}"
        assert len(errors) == 0

    def test_unit_detection_logic(self):
        """Test that recipe unit detection works correctly."""
        # Predominantly metric
        metric_recipe = {
            "name": "Test",
            "batch_size": 20,
            "batch_size_unit": "l",
            "target_unit_system": "imperial",
            "ingredients": [
                {"name": "A", "type": "grain", "amount": 1, "unit": "kg"},
                {"name": "B", "type": "grain", "amount": 500, "unit": "g"},
                {"name": "C", "type": "hop", "amount": 30, "unit": "g", "time": 60},
            ],
        }

        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )
        result = engine.execute_workflow(metric_recipe)

        # Should detect as metric and convert to imperial
        assert result.success is True
        conversion_changes = [
            c for c in result.changes if c.get("type") == "ingredient_converted"
        ]
        # All 3 ingredients should be converted
        assert len(conversion_changes) >= 3

    def test_execution_path_correctness(self):
        """Test that workflow follows correct execution path."""
        # Metric -> Imperial conversion
        metric_recipe = {
            "name": "Test",
            "batch_size": 20,
            "batch_size_unit": "l",
            "target_unit_system": "imperial",
            "ingredients": [
                {"name": "Malt", "type": "grain", "amount": 1.5, "unit": "kg"}
            ],
        }

        engine = FlowchartEngine.from_yaml_file(
            "services/ai/workflows/unit_conversion.yaml"
        )
        result = engine.execute_workflow(metric_recipe)

        # Check execution path
        path_node_ids = [node["node_id"] for node in result.execution_path]

        # Expected path: start -> detect (metric) -> check_target_metric (yes to imperial) -> convert -> normalize -> finish
        assert "start" in path_node_ids
        assert "detect_current_units" in path_node_ids
        assert (
            "check_target_system_metric" in path_node_ids
        )  # Recipe IS metric, checking target
        assert "convert_metric_to_imperial" in path_node_ids
        assert "normalize_imperial" in path_node_ids
        assert "finish" in path_node_ids
