"""
Flowchart-based AI Engine for recipe optimization.

This module provides the core FlowchartEngine that executes workflow configurations
to perform recipe analysis and optimization using a flowchart-based approach.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import yaml

from .flowchart_nodes import FlowchartNode, NodeResult, create_node
from .recipe_context import RecipeContext

logger = logging.getLogger(__name__)


@dataclass
class WorkflowResult:
    """Result of executing a complete workflow."""

    success: bool = True
    changes: List[Dict[str, Any]] = field(default_factory=list)
    execution_path: List[Dict[str, Any]] = field(default_factory=list)
    final_metrics: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    iterations_completed: int = 0
    optimization_summary: Optional[Dict[str, Any]] = None


class FlowchartEngine:
    """
    Main engine for executing flowchart-based recipe optimization workflows.

    The engine loads workflow configurations and executes them by traversing
    the flowchart nodes according to decision logic and conditions.
    """

    def __init__(self, workflow_config: Optional[Dict[str, Any]] = None):
        """
        Initialize the flowchart engine.

        Args:
            workflow_config: Optional workflow configuration dictionary.
                           If not provided, use default workflow.
        """
        self.workflow_config = workflow_config or self._get_default_workflow()
        self.nodes: Dict[str, FlowchartNode] = {}
        self.start_node_id: str = ""

        # Build nodes from configuration
        self._build_nodes()

        # Execution limits for safety
        self.max_iterations = 50  # Reduced from 100
        self.max_node_executions = 200  # Reduced from 1000

    def _get_default_workflow(self) -> Dict[str, Any]:
        """Get the default workflow configuration."""
        return {
            "workflow_name": "Basic Recipe Optimization",
            "version": "1.0",
            "start_node": "start",
            "nodes": {
                "start": {
                    "type": "start",
                    "description": "Start recipe analysis",
                    "next_node": "check_all_metrics",
                },
                "check_all_metrics": {
                    "type": "decision",
                    "condition": "all_metrics_in_style",
                    "description": "Are all metrics within style guidelines?",
                    "yes_path": "check_normalization",
                    "no_path": "check_og_range",
                },
                "check_normalization": {
                    "type": "decision",
                    "condition": "amounts_normalized",
                    "description": "Are amounts/times normalized to brewing amounts?",
                    "yes_path": "finish",
                    "no_path": "normalize_amounts",
                },
                "normalize_amounts": {
                    "type": "action",
                    "strategy": "normalize_amounts",
                    "description": "Normalize ingredient amounts",
                    "next_node": "finish",
                },
                "check_og_range": {
                    "type": "decision",
                    "condition": "og_in_range",
                    "description": "Is OG within range?",
                    "yes_path": "check_srm_range",
                    "no_path": "og_adjustments",
                },
                "og_adjustments": {
                    "type": "multi_decision",
                    "description": "OG adjustment decisions",
                    "conditions": [
                        {"condition": "og_too_low", "path": "increase_dark_malts"},
                        {"condition": "og_too_high", "path": "check_srm_also_low"},
                    ],
                    "default_path": "check_srm_range",
                },
                "increase_dark_malts": {
                    "type": "action",
                    "strategy": "base_malt_increase",
                    "description": "Increase dark base malts or add Munich Dark",
                    "parameters": {
                        "target_malts": ["munich_dark", "maris_otter"],
                        "fallback_action": "add_munich_dark",
                    },
                    "next_node": "check_og_range",
                },
                "check_srm_also_low": {
                    "type": "decision",
                    "condition": "srm_also_too_low",
                    "description": "Is SRM also too low?",
                    "yes_path": "base_malt_reduction",
                    "no_path": "adjust_dark_malt_quantity",
                },
                "base_malt_reduction": {
                    "type": "action",
                    "strategy": "base_malt_reduction",
                    "description": "Base malt reduction strategy - target about 25% below top end",
                    "parameters": {"reduction_target": "25_percent_below_style_max"},
                    "next_node": "check_og_range",
                },
                "adjust_dark_malt_quantity": {
                    "type": "action",
                    "strategy": "adjust_dark_malt_quantity",
                    "description": "Adjust quantity of dark base malt",
                    "next_node": "check_og_range",
                },
                "check_srm_range": {
                    "type": "decision",
                    "condition": "srm_in_range",
                    "description": "Is SRM within range?",
                    "yes_path": "finish",
                    "no_path": "srm_adjustments",
                },
                "srm_adjustments": {
                    "type": "multi_decision",
                    "description": "SRM adjustment decisions",
                    "conditions": [
                        {"condition": "srm_too_low", "path": "swap_caramel_darker"},
                        {"condition": "srm_too_high", "path": "check_caramel_malts"},
                    ],
                    "default_path": "finish",
                },
                "swap_caramel_darker": {
                    "type": "action",
                    "strategy": "caramel_malt_swap",
                    "description": "Swap lighter caramel malt for darker one",
                    "parameters": {"direction": "lighter_to_darker"},
                    "next_node": "check_roasted_grains_needed",
                },
                "check_roasted_grains_needed": {
                    "type": "decision",
                    "condition": "srm_still_too_low",
                    "description": "Increase quantity of roasted grains to reach target SRM?",
                    "yes_path": "add_roasted_grains",
                    "no_path": "finish",
                },
                "add_roasted_grains": {
                    "type": "action",
                    "strategy": "add_roasted_grains",
                    "description": "Add roasted grains to increase SRM",
                    "next_node": "finish",
                },
                "check_caramel_malts": {
                    "type": "decision",
                    "condition": "caramel_malts_in_recipe",
                    "description": "Caramel malts in recipe?",
                    "yes_path": "swap_caramel_lighter",
                    "no_path": "reduce_roasted_grains",
                },
                "swap_caramel_lighter": {
                    "type": "action",
                    "strategy": "caramel_malt_swap",
                    "description": "Swap darker caramel for lighter ones",
                    "parameters": {"direction": "darker_to_lighter"},
                    "next_node": "finish",
                },
                "reduce_roasted_grains": {
                    "type": "action",
                    "strategy": "reduce_roasted_grains",
                    "description": "Reduce quantities of darkest base malt",
                    "next_node": "finish",
                },
                "finish": {"type": "end", "description": "Workflow completed"},
            },
        }

    def _build_nodes(self):
        """Build node objects from workflow configuration."""
        nodes_config = self.workflow_config.get("nodes", {})
        self.start_node_id = self.workflow_config.get("start_node", "start")

        # Create all nodes
        for node_id, node_config in nodes_config.items():
            try:
                node = create_node(node_id, node_config)
                self.nodes[node_id] = node
            except Exception as e:
                logger.error(f"Error creating node {node_id}: {e}")
                raise

        logger.info(
            f"Built {len(self.nodes)} nodes for workflow: {self.workflow_config.get('workflow_name')}"
        )

    def execute_workflow(
        self,
        recipe_data: Dict[str, Any],
        style_guidelines: Optional[Dict[str, Any]] = None,
    ) -> WorkflowResult:
        """
        Execute the complete workflow on a recipe.

        Args:
            recipe_data: Recipe data including ingredients, batch size, efficiency, etc.
            style_guidelines: Optional style guidelines for compliance checking

        Returns:
            WorkflowResult containing changes, execution path, and final metrics
        """
        try:
            # Create recipe context
            context = RecipeContext(recipe_data, style_guidelines)

            # Execute workflow
            current_node_id = self.start_node_id
            execution_path = []
            all_changes = []
            node_execution_count = 0
            iterations = 0

            logger.info(f"Starting workflow execution from node: {current_node_id}")

            while current_node_id and node_execution_count < self.max_node_executions:
                if current_node_id not in self.nodes:
                    error_msg = f"Node {current_node_id} not found in workflow"
                    logger.error(error_msg)
                    return WorkflowResult(
                        success=False,
                        error_message=error_msg,
                        execution_path=execution_path,
                        changes=all_changes,
                    )

                # Execute current node
                node = self.nodes[current_node_id]
                logger.debug(f"Executing node: {current_node_id} ({node.description})")

                result = node.execute(context)

                # Track execution
                execution_path.append(
                    {
                        "node_id": current_node_id,
                        "node_type": type(node).__name__,
                        "description": node.description,
                        "result": result.data,
                        "next_node": result.next_node_id,
                    }
                )

                # Collect changes
                if result.changes:
                    all_changes.extend(result.changes)

                # Check for stop conditions
                if result.stop_execution:
                    logger.info("Workflow execution stopped by node")
                    break

                # Move to next node
                current_node_id = result.next_node_id
                node_execution_count += 1

                # Increment iterations when we loop back to check conditions
                if current_node_id in [
                    "check_og_range",
                    "check_srm_range",
                    "check_all_metrics",
                ]:
                    iterations += 1
                    if iterations >= self.max_iterations:
                        logger.warning(
                            f"Maximum iterations ({self.max_iterations}) reached"
                        )
                        break

            # Create optimization summary
            optimization_summary = self._create_optimization_summary(
                context.original_recipe, context.recipe, all_changes, iterations
            )

            logger.info(
                f"Workflow completed. Iterations: {iterations}, Changes: {len(all_changes)}"
            )

            return WorkflowResult(
                success=True,
                changes=all_changes,
                execution_path=execution_path,
                final_metrics=context.metrics,
                iterations_completed=iterations,
                optimization_summary=optimization_summary,
            )

        except Exception as e:
            error_msg = f"Error executing workflow: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return WorkflowResult(
                success=False,
                error_message=error_msg,
                changes=all_changes if "all_changes" in locals() else [],
                execution_path=execution_path if "execution_path" in locals() else [],
            )

    def _create_optimization_summary(
        self,
        original_recipe: Dict[str, Any],
        final_recipe: Dict[str, Any],
        changes: List[Dict[str, Any]],
        iterations: int,
    ) -> Dict[str, Any]:
        """Create a summary of the optimization process."""
        # Calculate original metrics
        original_context = RecipeContext(original_recipe)
        original_metrics = original_context.metrics

        # Calculate final metrics
        final_context = RecipeContext(final_recipe)
        final_metrics = final_context.metrics

        # Categorize changes
        ingredient_changes = [
            c for c in changes if c.get("type") == "ingredient_modified"
        ]
        ingredients_added = [c for c in changes if c.get("type") == "ingredient_added"]
        ingredients_removed = [
            c for c in changes if c.get("type") == "ingredient_removed"
        ]

        return {
            "iterations_completed": iterations,
            "total_changes": len(changes),
            "changes_breakdown": {
                "ingredients_modified": len(ingredient_changes),
                "ingredients_added": len(ingredients_added),
                "ingredients_removed": len(ingredients_removed),
            },
            "metrics_before": original_metrics,
            "metrics_after": final_metrics,
            "metric_improvements": {
                metric: {
                    "before": original_metrics.get(metric, 0),
                    "after": final_metrics.get(metric, 0),
                    "change": final_metrics.get(metric, 0)
                    - original_metrics.get(metric, 0),
                }
                for metric in ["OG", "FG", "ABV", "IBU", "SRM"]
            },
        }

    @classmethod
    def from_yaml_file(cls, yaml_file_path: str) -> "FlowchartEngine":
        """Create a FlowchartEngine from a YAML workflow file."""
        try:
            with open(yaml_file_path, "r") as f:
                workflow_config = yaml.safe_load(f)
            return cls(workflow_config)
        except Exception as e:
            logger.error(f"Error loading workflow from {yaml_file_path}: {e}")
            raise

    @classmethod
    def from_json_file(cls, json_file_path: str) -> "FlowchartEngine":
        """Create a FlowchartEngine from a JSON workflow file."""
        try:
            with open(json_file_path, "r") as f:
                workflow_config = json.load(f)
            return cls(workflow_config)
        except Exception as e:
            logger.error(f"Error loading workflow from {json_file_path}: {e}")
            raise

    def validate_workflow(self) -> Tuple[bool, List[str]]:
        """
        Validate the workflow configuration for correctness.

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        # Check start node exists
        if self.start_node_id not in self.nodes:
            errors.append(f"Start node '{self.start_node_id}' not found in nodes")

        # Check all node references are valid
        for node_id, node in self.nodes.items():
            config = node.config

            # Check next_node references
            if "next_node" in config:
                next_node = config["next_node"]
                if next_node and next_node not in self.nodes:
                    errors.append(
                        f"Node '{node_id}' references unknown next_node '{next_node}'"
                    )

            # Check decision node paths
            if config.get("type") == "decision":
                for path_key in ["yes_path", "no_path"]:
                    if path_key in config:
                        path_node = config[path_key]
                        if path_node and path_node not in self.nodes:
                            errors.append(
                                f"Node '{node_id}' references unknown {path_key} '{path_node}'"
                            )

            # Check multi_decision paths
            if config.get("type") == "multi_decision":
                conditions = config.get("conditions", [])
                for condition in conditions:
                    path_node = condition.get("path")
                    if path_node and path_node not in self.nodes:
                        errors.append(
                            f"Node '{node_id}' references unknown path '{path_node}'"
                        )

        return len(errors) == 0, errors
