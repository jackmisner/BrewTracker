"""
Flowchart-based AI system - Node implementations.

This module provides the core node types for executing flowchart-based recipe optimization workflows.
Each node represents a different type of decision or action in the optimization process.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


@dataclass
class NodeResult:
    """Result of executing a flowchart node."""

    next_node_id: Optional[str] = None
    data: Dict[str, Any] = None
    changes: List[Dict[str, Any]] = None
    stop_execution: bool = False

    def __post_init__(self):
        if self.data is None:
            self.data = {}
        if self.changes is None:
            self.changes = []


class FlowchartNode(ABC):
    """Base class for all flowchart nodes."""

    def __init__(self, node_id: str, config: Dict[str, Any]):
        self.node_id = node_id
        self.config = config
        self.description = config.get("description", "")

    @abstractmethod
    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute the node logic and return the result."""
        pass

    def log_execution(self, context: "RecipeContext", result: NodeResult):
        """Log node execution for debugging and audit trail."""
        logger.info(f"Node {self.node_id}: {self.description}")
        logger.debug(f"Node {self.node_id} executed -> Next: {result.next_node_id}")


class StartNode(FlowchartNode):
    """Starting point of a flowchart workflow."""

    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute start node - simply move to next node."""
        result = NodeResult(
            next_node_id=self.config.get("next_node"),
            data={"message": "Workflow started"},
        )
        self.log_execution(context, result)
        return result


class EndNode(FlowchartNode):
    """End point of a flowchart workflow."""

    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute end node - stop execution."""
        result = NodeResult(
            next_node_id=None,
            stop_execution=True,
            data={"message": "Workflow completed"},
        )
        self.log_execution(context, result)
        return result


class DecisionNode(FlowchartNode):
    """Decision node that evaluates conditions and branches."""

    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute decision logic and determine next path."""
        condition_name = self.config.get("condition")
        if not condition_name:
            raise ValueError(
                f"DecisionNode {self.node_id} missing 'condition' in config"
            )

        # Get the condition evaluator from context
        condition_result = context.evaluate_condition(condition_name, self.config)

        # Determine next node based on condition result
        if condition_result:
            next_node = self.config.get("yes_path")
        else:
            next_node = self.config.get("no_path")

        result = NodeResult(
            next_node_id=next_node,
            data={
                "condition": condition_name,
                "condition_result": condition_result,
                "path_taken": "yes" if condition_result else "no",
            },
        )

        self.log_execution(context, result)
        return result


class MultiDecisionNode(FlowchartNode):
    """Decision node that evaluates multiple conditions and branches accordingly."""

    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute multiple conditions and take first matching path."""
        conditions = self.config.get("conditions", [])
        if not conditions:
            raise ValueError(
                f"MultiDecisionNode {self.node_id} missing 'conditions' in config"
            )

        for condition_config in conditions:
            condition_name = condition_config.get("condition")
            if context.evaluate_condition(condition_name, condition_config):
                result = NodeResult(
                    next_node_id=condition_config.get("path"),
                    data={
                        "matched_condition": condition_name,
                        "conditions_evaluated": [
                            c.get("condition") for c in conditions
                        ],
                    },
                )
                self.log_execution(context, result)
                return result

        # No conditions matched - use default path if available
        default_path = self.config.get("default_path")
        if default_path:
            result = NodeResult(
                next_node_id=default_path,
                data={"matched_condition": None, "used_default_path": True},
            )
        else:
            # No default path - this is likely an error in the workflow configuration
            logger.error(
                f"MultiDecisionNode {self.node_id}: No conditions matched and no default path"
            )
            result = NodeResult(
                next_node_id=None,
                stop_execution=True,
                data={"error": "No conditions matched and no default path configured"},
            )

        self.log_execution(context, result)
        return result


class ActionNode(FlowchartNode):
    """Action node that performs recipe modifications."""

    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute action strategy and apply changes."""
        strategy_name = self.config.get("strategy")
        if not strategy_name:
            raise ValueError(f"ActionNode {self.node_id} missing 'strategy' in config")

        # Execute the strategy through context
        changes = context.execute_strategy(
            strategy_name, self.config.get("parameters", {})
        )

        # Apply changes to context
        if changes:
            context.apply_changes(changes)

        result = NodeResult(
            next_node_id=self.config.get("next_node"),
            changes=changes,
            data={
                "strategy": strategy_name,
                "changes_count": len(changes) if changes else 0,
            },
        )

        self.log_execution(context, result)
        return result


class ConditionalActionNode(FlowchartNode):
    """Action node that only executes if a condition is met."""

    def execute(self, context: "RecipeContext") -> NodeResult:
        """Execute action only if condition is satisfied."""
        condition_name = self.config.get("condition")
        strategy_name = self.config.get("strategy")

        if not condition_name or not strategy_name:
            raise ValueError(
                f"ConditionalActionNode {self.node_id} missing 'condition' or 'strategy'"
            )

        condition_result = context.evaluate_condition(condition_name, self.config)
        changes = []

        if condition_result:
            # Execute the strategy
            changes = context.execute_strategy(
                strategy_name, self.config.get("parameters", {})
            )
            if changes:
                context.apply_changes(changes)

        result = NodeResult(
            next_node_id=self.config.get("next_node"),
            changes=changes,
            data={
                "condition": condition_name,
                "condition_result": condition_result,
                "strategy": strategy_name if condition_result else None,
                "changes_count": len(changes),
            },
        )

        self.log_execution(context, result)
        return result


# Node factory for creating nodes from configuration
NODE_TYPES = {
    "start": StartNode,
    "end": EndNode,
    "decision": DecisionNode,
    "multi_decision": MultiDecisionNode,
    "action": ActionNode,
    "conditional_action": ConditionalActionNode,
}


def create_node(node_id: str, node_config: Dict[str, Any]) -> FlowchartNode:
    """Factory function to create nodes from configuration."""
    node_type = node_config.get("type")
    if node_type not in NODE_TYPES:
        raise ValueError(f"Unknown node type: {node_type}")

    return NODE_TYPES[node_type](node_id, node_config)
