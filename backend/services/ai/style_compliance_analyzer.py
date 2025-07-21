"""
Style Compliance Analyzer

Analyzes recipe compliance with BJCP style guidelines and generates
optimization targets for recipes that fall outside style ranges.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from models.mongo_models import BeerStyleGuide

logger = logging.getLogger(__name__)


class StyleComplianceAnalyzer:
    """Analyzes recipe compliance with BJCP style guidelines"""

    def analyze_compliance(self, metrics: Dict, style_guide: BeerStyleGuide) -> Dict:
        """
        Analyze how well recipe metrics comply with style guidelines

        Args:
            metrics: Current recipe metrics (og, fg, abv, ibu, srm)
            style_guide: BJCP style guide object

        Returns:
            Detailed compliance analysis with optimization targets
        """
        try:
            compliance = {}
            optimization_targets = []

            # Analyze each metric against style ranges
            for metric in ["og", "fg", "abv", "ibu", "srm"]:
                current_value = metrics.get(metric, 0)
                style_range = self._get_style_range(style_guide, metric)

                if style_range:
                    min_val, max_val = style_range
                    in_range = min_val <= current_value <= max_val

                    compliance[metric] = {
                        "current_value": current_value,
                        "style_range": {"min": min_val, "max": max_val},
                        "in_range": in_range,
                        "deviation": self._calculate_deviation(
                            current_value, min_val, max_val
                        ),
                    }

                    # Generate optimization target if out of range
                    if not in_range:
                        target_value = self._calculate_target_value(
                            current_value, min_val, max_val
                        )
                        priority = self._calculate_priority(
                            metric, compliance[metric]["deviation"]
                        )

                        optimization_targets.append(
                            {
                                "metric": metric,
                                "current_value": current_value,
                                "target_value": target_value,
                                "priority": priority,
                                "reasoning": f"Adjust {metric.upper()} to meet {style_guide.name} style requirements",
                            }
                        )

            # Calculate overall compliance score
            in_range_count = sum(1 for m in compliance.values() if m["in_range"])
            overall_score = (
                (in_range_count / len(compliance)) * 100 if compliance else 0
            )

            return {
                "style_name": style_guide.name,
                "overall_score": overall_score,
                "compliance": compliance,
                "optimization_targets": sorted(
                    optimization_targets, key=lambda x: x["priority"], reverse=True
                ),
            }

        except Exception as e:
            logger.error(f"Style compliance analysis failed: {str(e)}")
            return {}

    def _get_style_range(
        self, style_guide: BeerStyleGuide, metric: str
    ) -> Optional[Tuple[float, float]]:
        """Get the acceptable range for a metric from style guide"""
        try:
            if metric == "og":
                return (
                    style_guide.original_gravity.minimum,
                    style_guide.original_gravity.maximum,
                )
            elif metric == "fg":
                return (
                    style_guide.final_gravity.minimum,
                    style_guide.final_gravity.maximum,
                )
            elif metric == "abv":
                return (
                    style_guide.alcohol_by_volume.minimum,
                    style_guide.alcohol_by_volume.maximum,
                )
            elif metric == "ibu":
                return (
                    style_guide.international_bitterness_units.minimum,
                    style_guide.international_bitterness_units.maximum,
                )
            elif metric == "srm":
                return (style_guide.color.minimum, style_guide.color.maximum)
        except AttributeError:
            return None

        return None

    def _calculate_deviation(
        self, current: float, min_val: float, max_val: float
    ) -> float:
        """Calculate how far outside the acceptable range a value is"""
        if current < min_val:
            return min_val - current
        elif current > max_val:
            return current - max_val
        return 0.0

    def _calculate_target_value(
        self, current: float, min_val: float, max_val: float
    ) -> float:
        """Calculate the optimal target value within the style range with breathing room"""
        range_size = max_val - min_val

        if current < min_val:
            # Below range: target 20% into the range
            return min_val + range_size * 0.2
        elif current > max_val:
            # Above range: target 20% from the top
            return max_val - range_size * 0.2
        else:
            # In range: check if we need breathing room
            # Calculate position within range (0.0 = min, 1.0 = max)
            position = (current - min_val) / range_size

            # If too close to edges (< 15% or > 85%), move toward center
            if position < 0.15:
                # Too close to minimum, target 30% into range
                return min_val + range_size * 0.3
            elif position > 0.85:
                # Too close to maximum, target 70% into range
                return min_val + range_size * 0.7

            # Already has good breathing room
            return current

    def _calculate_priority(self, metric: str, deviation: float) -> int:
        """Calculate priority based on metric importance and deviation magnitude"""
        # Base priorities: OG and ABV are most critical for style character
        base_priorities = {"og": 5, "abv": 4, "ibu": 3, "fg": 3, "srm": 2}

        base_priority = base_priorities.get(metric, 1)

        # Increase priority for larger deviations
        if deviation > 0.1:  # Significant deviation
            return min(base_priority + 2, 5)
        elif deviation > 0.05:  # Moderate deviation
            return min(base_priority + 1, 5)

        return base_priority
