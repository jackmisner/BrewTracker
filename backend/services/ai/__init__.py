"""
AI Recipe Analysis Package

This package provides intelligent recipe analysis, optimization suggestions, and brewing guidance
based on brewing science and BJCP style guidelines.

Main Components:
- RecipeAnalysisEngine: Main orchestrator for recipe analysis
- StyleComplianceAnalyzer: BJCP style compliance analysis
- SuggestionGenerator: Recipe improvement suggestions
- CascadingEffectsCalculator: Predicts effects of recipe changes
"""

from .cascading_effects_calculator import CascadingEffectsCalculator
from .recipe_analysis_engine import RecipeAnalysisEngine
from .style_compliance_analyzer import StyleComplianceAnalyzer
from .suggestion_generator import SuggestionGenerator

# Maintain backward compatibility
__all__ = [
    "RecipeAnalysisEngine",
    "StyleComplianceAnalyzer",
    "SuggestionGenerator",
    "CascadingEffectsCalculator",
]
