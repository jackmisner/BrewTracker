"""
AI Recipe Analysis Package

This package provides intelligent recipe analysis and optimization using a flowchart-based
system based on brewing science and BJCP style guidelines.

Main Components:
- FlowchartEngine: Flowchart-based optimization system
- FlowchartAIService: Service wrapper for flowchart-based analysis
- OptimizationStrategies: Individual optimization strategies
- WorkflowConfigLoader: YAML workflow configuration loader
"""

# Flowchart-based system (primary)
from .flowchart_ai_service import FlowchartAIService, get_flowchart_ai_service
from .flowchart_engine import FlowchartEngine
from .workflow_config_loader import WorkflowConfigLoader, list_workflows, load_workflow

__all__ = [
    # Flowchart system
    "FlowchartEngine",
    "FlowchartAIService",
    "get_flowchart_ai_service",
    "WorkflowConfigLoader",
    "load_workflow",
    "list_workflows",
]
