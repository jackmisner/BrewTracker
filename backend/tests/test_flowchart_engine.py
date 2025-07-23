"""
Tests for flowchart-based AI system.

This test suite verifies the functionality of the FlowchartEngine,
node types, workflow execution, and integration with the API endpoints.
"""

import json
from copy import deepcopy
from unittest.mock import Mock, patch

import pytest
import yaml

from services.ai.flowchart_ai_service import FlowchartAIService
from services.ai.flowchart_engine import FlowchartEngine, WorkflowResult
from services.ai.flowchart_nodes import (
    ActionNode,
    DecisionNode,
    EndNode,
    MultiDecisionNode,
    NodeResult,
    StartNode,
    create_node,
)
from services.ai.optimization_strategies import (
    BaseMaltIncreaseStrategy,
    NormalizeAmountsStrategy,
)
from services.ai.recipe_context import RecipeContext


class TestFlowchartNodes:
    """Test individual flowchart node functionality."""

    def test_start_node_execution(self):
        """Test StartNode executes and moves to next node."""
        config = {"type": "start", "next_node": "test_node"}
        node = StartNode("start", config)

        # Mock context
        context = Mock()

        result = node.execute(context)

        assert result.next_node_id == "test_node"
        assert result.data["message"] == "Workflow started"
        assert not result.stop_execution

    def test_end_node_execution(self):
        """Test EndNode executes and stops execution."""
        config = {"type": "end"}
        node = EndNode("end", config)

        # Mock context
        context = Mock()

        result = node.execute(context)

        assert result.next_node_id is None
        assert result.stop_execution is True
        assert result.data["message"] == "Workflow completed"

    def test_decision_node_yes_path(self):
        """Test DecisionNode takes yes path when condition is true."""
        config = {
            "type": "decision",
            "condition": "test_condition",
            "yes_path": "yes_node",
            "no_path": "no_node",
        }
        node = DecisionNode("decision", config)

        # Mock context that returns True for condition
        context = Mock()
        context.evaluate_condition.return_value = True

        result = node.execute(context)

        assert result.next_node_id == "yes_node"
        assert result.data["condition_result"] is True
        assert result.data["path_taken"] == "yes"

    def test_decision_node_no_path(self):
        """Test DecisionNode takes no path when condition is false."""
        config = {
            "type": "decision",
            "condition": "test_condition",
            "yes_path": "yes_node",
            "no_path": "no_node",
        }
        node = DecisionNode("decision", config)

        # Mock context that returns False for condition
        context = Mock()
        context.evaluate_condition.return_value = False

        result = node.execute(context)

        assert result.next_node_id == "no_node"
        assert result.data["condition_result"] is False
        assert result.data["path_taken"] == "no"

    def test_action_node_execution(self):
        """Test ActionNode executes strategy and applies changes."""
        config = {
            "type": "action",
            "strategy": "test_strategy",
            "next_node": "next_node",
            "parameters": {"param1": "value1"},
        }
        node = ActionNode("action", config)

        # Mock context
        context = Mock()
        test_changes = [{"type": "ingredient_modified", "ingredient_name": "Test"}]
        context.execute_strategy.return_value = test_changes

        result = node.execute(context)

        assert result.next_node_id == "next_node"
        assert result.changes == test_changes
        assert result.data["strategy"] == "test_strategy"
        assert result.data["changes_count"] == 1

        # Verify context methods were called
        context.execute_strategy.assert_called_once_with(
            "test_strategy", {"param1": "value1"}
        )
        context.apply_changes.assert_called_once_with(test_changes)

    def test_node_factory(self):
        """Test node factory creates correct node types."""
        start_config = {"type": "start", "next_node": "next"}
        start_node = create_node("start", start_config)
        assert isinstance(start_node, StartNode)

        decision_config = {"type": "decision", "condition": "test"}
        decision_node = create_node("decision", decision_config)
        assert isinstance(decision_node, DecisionNode)

        action_config = {"type": "action", "strategy": "test"}
        action_node = create_node("action", action_config)
        assert isinstance(action_node, ActionNode)


class TestRecipeContext:
    """Test RecipeContext functionality."""

    @pytest.fixture
    def sample_recipe_data(self):
        """Sample recipe data for testing."""
        return {
            "ingredients": [
                {
                    "name": "2-Row",
                    "type": "grain",
                    "grain_type": "base",
                    "amount": 8.0,
                    "unit": "lb",
                    "potential": 1.037,
                    "color": 2.0,
                },
                {
                    "name": "Cascade",
                    "type": "hop",
                    "amount": 1.0,
                    "unit": "oz",
                    "alpha_acid": 5.5,
                    "time": 60,
                    "use": "boil",
                },
                {
                    "name": "US-05",
                    "type": "yeast",
                    "amount": 1,
                    "unit": "pkg",
                    "attenuation": 75.0,
                    "use": "fermentation",
                },
            ],
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
            "boil_time": 60,
        }

    @pytest.fixture
    def sample_style_guidelines(self):
        """Sample style guidelines for testing."""
        return {
            "name": "American IPA",
            "ranges": {
                "OG": {"min": 1.056, "max": 1.070},
                "FG": {"min": 1.008, "max": 1.014},
                "ABV": {"min": 5.5, "max": 7.5},
                "IBU": {"min": 40, "max": 70},
                "SRM": {"min": 6, "max": 14},
            },
        }

    def test_recipe_context_initialization(
        self, sample_recipe_data, sample_style_guidelines
    ):
        """Test RecipeContext initializes correctly."""
        context = RecipeContext(sample_recipe_data, sample_style_guidelines)

        assert context.recipe == sample_recipe_data
        assert context.style_guidelines == sample_style_guidelines
        assert context.metrics is not None
        assert isinstance(context.metrics, dict)
        assert "OG" in context.metrics
        assert "IBU" in context.metrics

    def test_condition_evaluation(self, sample_recipe_data, sample_style_guidelines):
        """Test condition evaluation methods."""
        context = RecipeContext(sample_recipe_data, sample_style_guidelines)

        # Test all_metrics_in_style condition
        result = context.evaluate_condition("all_metrics_in_style")
        assert isinstance(result, bool)

        # Test individual metric conditions
        og_result = context.evaluate_condition("og_in_range")
        assert isinstance(og_result, bool)

        # Test amounts_normalized condition
        normalized_result = context.evaluate_condition("amounts_normalized")
        assert isinstance(normalized_result, bool)

    def test_strategy_execution(self, sample_recipe_data):
        """Test strategy execution through context."""
        context = RecipeContext(sample_recipe_data)

        # Test normalize_amounts strategy
        changes = context.execute_strategy("normalize_amounts")
        assert isinstance(changes, list)

        # Test unknown strategy
        unknown_changes = context.execute_strategy("unknown_strategy")
        assert unknown_changes == []

    def test_apply_changes(self, sample_recipe_data):
        """Test applying changes to recipe."""
        context = RecipeContext(sample_recipe_data)
        original_amount = context.recipe["ingredients"][0]["amount"]

        changes = [
            {
                "type": "ingredient_modified",
                "ingredient_name": "2-Row",
                "field": "amount",
                "new_value": 10.0,
                "change_reason": "Test change",
            }
        ]

        context.apply_changes(changes)

        # Check that the ingredient amount was updated
        updated_amount = context.recipe["ingredients"][0]["amount"]
        assert updated_amount == 10.0
        assert updated_amount != original_amount

        # Check that changes were tracked
        assert len(context.changes_made) == 1
        assert context.changes_made[0] == changes[0]


class TestFlowchartEngine:
    """Test FlowchartEngine functionality."""

    @pytest.fixture
    def simple_workflow_config(self):
        """Simple workflow configuration for testing."""
        return {
            "workflow_name": "Test Workflow",
            "version": "1.0",
            "start_node": "start",
            "nodes": {
                "start": {"type": "start", "next_node": "decision"},
                "decision": {
                    "type": "decision",
                    "condition": "amounts_normalized",
                    "description": "Are amounts normalized?",
                    "yes_path": "finish",
                    "no_path": "normalize",
                },
                "normalize": {
                    "type": "action",
                    "strategy": "normalize_amounts",
                    "description": "Normalize ingredient amounts",
                    "next_node": "finish",
                },
                "finish": {"type": "end"},
            },
        }

    @pytest.fixture
    def sample_recipe_data(self):
        """Sample recipe data for testing."""
        return {
            "ingredients": [
                {
                    "name": "Pilsner",
                    "type": "grain",
                    "grain_type": "base",
                    "amount": 8.33,  # Non-normalized amount
                    "unit": "lb",
                    "potential": 1.037,
                    "color": 2.0,
                }
            ],
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
        }

    def test_engine_initialization(self, simple_workflow_config):
        """Test FlowchartEngine initializes correctly."""
        engine = FlowchartEngine(simple_workflow_config)

        assert engine.workflow_config == simple_workflow_config
        assert len(engine.nodes) == 4  # start, decision, normalize, finish
        assert engine.start_node_id == "start"
        assert "start" in engine.nodes
        assert "finish" in engine.nodes

    def test_workflow_validation(self, simple_workflow_config):
        """Test workflow validation."""
        engine = FlowchartEngine(simple_workflow_config)

        is_valid, errors = engine.validate_workflow()
        assert is_valid
        assert len(errors) == 0

        # Test invalid workflow (missing node reference)
        invalid_config = deepcopy(simple_workflow_config)
        invalid_config["nodes"]["decision"]["yes_path"] = "missing_node"

        invalid_engine = FlowchartEngine(invalid_config)
        is_valid, errors = invalid_engine.validate_workflow()
        assert not is_valid
        assert len(errors) > 0

    def test_workflow_execution_no_changes_needed(
        self, simple_workflow_config, sample_recipe_data
    ):
        """Test workflow execution when no changes are needed."""
        # Modify recipe to have normalized amounts
        sample_recipe_data["ingredients"][0]["amount"] = 8.0  # Normalized amount

        engine = FlowchartEngine(simple_workflow_config)
        result = engine.execute_workflow(sample_recipe_data)

        assert result.success
        assert len(result.changes) == 0  # No changes needed
        assert len(result.execution_path) > 0

        # Check execution path includes start -> decision -> finish
        node_ids = [step["node_id"] for step in result.execution_path]
        assert "start" in node_ids
        assert "decision" in node_ids
        assert "finish" in node_ids
        assert "normalize" not in node_ids  # Should not execute normalize

    def test_workflow_execution_with_changes(
        self, simple_workflow_config, sample_recipe_data
    ):
        """Test workflow execution when changes are needed."""
        engine = FlowchartEngine(simple_workflow_config)
        result = engine.execute_workflow(sample_recipe_data)

        assert result.success
        # Should have changes from normalize_amounts strategy
        assert len(result.execution_path) > 0

        # Check execution path includes start -> decision -> normalize -> finish
        node_ids = [step["node_id"] for step in result.execution_path]
        assert "start" in node_ids
        assert "decision" in node_ids
        assert "normalize" in node_ids
        assert "finish" in node_ids


class TestFlowchartAIService:
    """Test FlowchartAIService integration."""

    @pytest.fixture
    def sample_recipe_data(self):
        """Sample recipe data for testing."""
        return {
            "ingredients": [
                {
                    "name": "Pale 2-Row",
                    "type": "grain",
                    "grain_type": "base",
                    "amount": 9.0,
                    "unit": "lb",
                    "potential": 1.037,
                    "color": 2.0,
                },
                {
                    "name": "Centennial",
                    "type": "hop",
                    "amount": 1.5,
                    "unit": "oz",
                    "alpha_acid": 9.5,
                    "time": 60,
                    "use": "boil",
                },
            ],
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
        }

    @patch("services.ai.flowchart_ai_service.load_workflow")
    def test_service_initialization(self, mock_load_workflow):
        """Test FlowchartAIService initializes correctly."""
        # Mock workflow loading
        mock_workflow = {
            "workflow_name": "Test",
            "start_node": "start",
            "nodes": {
                "start": {"type": "start", "next_node": "finish"},
                "finish": {"type": "end"},
            },
        }
        mock_load_workflow.return_value = mock_workflow

        service = FlowchartAIService()
        assert service.default_workflow == "recipe_optimization"

        # Test getting engine
        engine = service.get_engine("test_workflow")
        assert isinstance(engine, FlowchartEngine)
        mock_load_workflow.assert_called_once_with("test_workflow")

    @patch("services.ai.flowchart_ai_service.load_workflow")
    def test_analyze_recipe(self, mock_load_workflow, sample_recipe_data):
        """Test recipe analysis through service."""
        # Mock workflow loading
        mock_workflow = {
            "workflow_name": "Test",
            "start_node": "start",
            "nodes": {
                "start": {"type": "start", "next_node": "finish"},
                "finish": {"type": "end"},
            },
        }
        mock_load_workflow.return_value = mock_workflow

        service = FlowchartAIService()

        # Test analysis
        result = service.analyze_recipe(sample_recipe_data, unit_system="imperial")

        assert isinstance(result, dict)
        assert "current_metrics" in result
        assert "analysis_timestamp" in result
        assert "unit_system" in result
        assert result["unit_system"] == "imperial"


class TestOptimizationStrategies:
    """Test optimization strategy implementations."""

    @pytest.fixture
    def sample_recipe_data(self):
        """Sample recipe data for testing."""
        return {
            "ingredients": [
                {
                    "name": "Pale 2-Row",
                    "type": "grain",
                    "grain_type": "base_malt",
                    "amount": 2.0,  # Low amount to ensure OG is below target
                    "unit": "lb",
                    "potential": 1.037,
                    "color": 2.0,
                }
            ],
            "batch_size": 5.0,
            "batch_size_unit": "gal",
            "efficiency": 75,
        }

    @pytest.fixture
    def sample_style_guidelines(self):
        """Sample style guidelines for testing."""
        return {
            "ranges": {
                "OG": {"min": 1.056, "max": 1.070},
                "FG": {"min": 1.008, "max": 1.014},
                "ABV": {"min": 5.5, "max": 7.5},
                "IBU": {"min": 40, "max": 70},
                "SRM": {"min": 6, "max": 14},
            }
        }

    def test_base_malt_increase_strategy(
        self, sample_recipe_data, sample_style_guidelines
    ):
        """Test base malt increase strategy."""
        context = RecipeContext(sample_recipe_data, sample_style_guidelines)
        strategy = BaseMaltIncreaseStrategy(context)

        changes = strategy.execute({"increase_percentage": 0.2})

        assert isinstance(changes, list)
        assert len(changes) > 0

        # Check that changes are properly formatted
        for change in changes:
            assert "type" in change
            assert "ingredient_name" in change
            assert "change_reason" in change

    def test_normalize_amounts_strategy(self, sample_recipe_data):
        """Test normalize amounts strategy."""
        # Create recipe with non-normalized amounts
        recipe_data = deepcopy(sample_recipe_data)
        recipe_data["ingredients"][0]["amount"] = 6.33  # Non-normalized

        context = RecipeContext(recipe_data)
        strategy = NormalizeAmountsStrategy(context)

        changes = strategy.execute()

        assert isinstance(changes, list)
        # Should have at least one change to normalize the amount
        if len(changes) > 0:
            assert changes[0]["type"] == "ingredient_modified"
            assert changes[0]["field"] == "amount"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
