"""
AI Recipe Analysis Package

This package provides intelligent recipe analysis, optimization suggestions, and brewing guidance
based on brewing science and BJCP style guidelines.

Main Components:
- RecipeAnalysisEngine: Main orchestrator for recipe analysis (legacy)
- StyleComplianceAnalyzer: BJCP style compliance analysis
- SuggestionGenerator: Recipe improvement suggestions (legacy)
- CascadingEffectsCalculator: Predicts effects of recipe changes
- FlowchartEngine: New flowchart-based optimization system
- FlowchartAIService: Service wrapper for flowchart-based analysis
"""

from .cascading_effects_calculator import CascadingEffectsCalculator
from .recipe_analysis_engine import RecipeAnalysisEngine
from .style_compliance_analyzer import StyleComplianceAnalyzer
from .suggestion_generator import SuggestionGenerator

# New flowchart-based system
from .flowchart_engine import FlowchartEngine
from .flowchart_ai_service import FlowchartAIService, get_flowchart_ai_service
from .workflow_config_loader import WorkflowConfigLoader, load_workflow, list_workflows

# Maintain backward compatibility
__all__ = [
    "RecipeAnalysisEngine",
    "StyleComplianceAnalyzer", 
    "SuggestionGenerator",
    "CascadingEffectsCalculator",
    # New flowchart system
    "FlowchartEngine",
    "FlowchartAIService",
    "get_flowchart_ai_service",
    "WorkflowConfigLoader",
    "load_workflow",
    "list_workflows",
]
