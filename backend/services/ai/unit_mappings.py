"""
Shared unit field mappings for recipe unit conversions.

This module provides a single source of truth for temperature parameter
to unit field name mappings used across the AI services.
"""

# Temperature parameter to unit field mapping
# Used by both recipe_context.py and flowchart_ai_service.py
TEMP_UNIT_FIELDS = {
    "mash_temperature": "mash_temp_unit",
    "fermentation_temp": "fermentation_temp_unit",
    "strike_temp": "strike_temp_unit",
    "sparge_temp": "sparge_temp_unit",
}
