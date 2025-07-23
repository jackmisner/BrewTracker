"""
Ingredient Lookup Service

Provides centralized ingredient search, matching, and substitution logic
for the AI optimization system. Handles database queries, fuzzy matching,
and ingredient validation.
"""

import logging
import re
from typing import Dict, List, Optional, Tuple

from models.mongo_models import Ingredient

logger = logging.getLogger(__name__)


class IngredientLookupService:
    """Service for ingredient database lookup and substitution logic"""

    def __init__(self):
        self._ingredient_cache = None
        self._cache_timestamp = None

    def _get_ingredient_cache(self) -> List[Dict]:
        """Get cached ingredient data or refresh from database"""
        try:
            # For now, query fresh each time (can add caching later if needed)
            ingredients = Ingredient.objects()
            return [ingredient.to_dict() for ingredient in ingredients]
        except Exception as e:
            logger.error(f"Error loading ingredient cache: {str(e)}")
            return []

    def find_ingredient_by_id(self, ingredient_id: str) -> Optional[Dict]:
        """Find ingredient by database ID"""
        try:
            ingredient = Ingredient.objects(id=ingredient_id).first()
            return ingredient.to_dict() if ingredient else None
        except Exception as e:
            logger.error(f"Error finding ingredient by ID {ingredient_id}: {str(e)}")
            return None

    def find_ingredients_by_name(
        self,
        name: str,
        ingredient_type: Optional[str] = None,
        exact_match: bool = False,
    ) -> List[Dict]:
        """
        Find ingredients by name with optional type filtering

        Args:
            name: Ingredient name to search for
            ingredient_type: Optional type filter (grain, hop, yeast, etc.)
            exact_match: If True, use exact name matching, else fuzzy matching

        Returns:
            List of matching ingredient dictionaries
        """
        try:
            query = {}

            if exact_match:
                query["name__iexact"] = name
            else:
                query["name__icontains"] = name

            if ingredient_type:
                query["type"] = ingredient_type

            ingredients = Ingredient.objects(**query)
            return [ingredient.to_dict() for ingredient in ingredients]

        except Exception as e:
            logger.error(f"Error searching ingredients by name '{name}': {str(e)}")
            return []

    def find_similar_caramel_malts(
        self, current_caramel: Dict, direction: str = "lighter_to_darker"
    ) -> List[Dict]:
        """
        Find similar caramel/crystal malts for substitution

        Args:
            current_caramel: Current caramel malt ingredient dict
            direction: "lighter_to_darker" or "darker_to_lighter"

        Returns:
            List of suitable caramel malt substitutes
        """
        try:
            current_color = current_caramel.get("color", 40)
            current_name = current_caramel.get("name", "").lower()

            # Search for caramel/crystal malts
            caramel_patterns = ["caramel", "crystal", "cara"]
            query_conditions = []

            for pattern in caramel_patterns:
                query_conditions.append({"name__icontains": pattern})

            # Use Q objects for OR conditions
            from mongoengine.queryset.visitor import Q

            combined_query = Q()
            for condition in query_conditions:
                combined_query |= Q(**condition)

            caramel_malts = Ingredient.objects(combined_query & Q(type="grain"))

            substitutes = []
            for malt in caramel_malts:
                malt_dict = malt.to_dict()
                malt_color = malt_dict.get("color", 40)

                # Skip the current malt
                if malt_dict.get("name", "").lower() == current_name:
                    continue

                # Apply direction filtering
                if direction == "lighter_to_darker" and malt_color > current_color:
                    substitutes.append(malt_dict)
                elif direction == "darker_to_lighter" and malt_color < current_color:
                    substitutes.append(malt_dict)

            # Sort by color difference (closest first)
            substitutes.sort(key=lambda x: abs(x.get("color", 40) - current_color))

            return substitutes[:5]  # Return top 5 matches

        except Exception as e:
            logger.error(f"Error finding similar caramel malts: {str(e)}")
            return []

    def find_similar_yeasts(
        self,
        current_yeast: Dict,
        target_attenuation: Optional[float] = None,
        target_yeast_type: Optional[str] = None,
        style_requirements: Optional[Dict] = None,
    ) -> List[Tuple[Dict, float]]:
        """
        Find similar yeast strains for substitution

        Args:
            current_yeast: Current yeast ingredient dict
            target_attenuation: Target attenuation percentage
            target_yeast_type: Target yeast type (lager, belgian_ale, etc.)
            style_requirements: Style requirements for temperature, etc.

        Returns:
            List of tuples (yeast_dict, confidence_score)
        """
        try:
            query = {"type": "yeast"}

            # Filter by yeast type if specified
            if target_yeast_type:
                query["yeast_type"] = target_yeast_type

            yeasts = Ingredient.objects(**query)
            candidates = []

            current_attenuation = current_yeast.get("attenuation", 75)
            current_name = current_yeast.get("name", "").lower()

            for yeast in yeasts:
                yeast_dict = yeast.to_dict()

                # Skip the current yeast
                if yeast_dict.get("name", "").lower() == current_name:
                    continue

                confidence = self._calculate_yeast_compatibility(
                    yeast_dict,
                    target_attenuation or current_attenuation,
                    style_requirements,
                )

                if confidence > 0.3:  # Minimum confidence threshold
                    candidates.append((yeast_dict, confidence))

            # Sort by confidence score (highest first)
            candidates.sort(key=lambda x: x[1], reverse=True)

            return candidates[:10]  # Return top 10 matches

        except Exception as e:
            logger.error(f"Error finding similar yeasts: {str(e)}")
            return []

    def _calculate_yeast_compatibility(
        self,
        yeast: Dict,
        target_attenuation: float,
        style_requirements: Optional[Dict] = None,
    ) -> float:
        """
        Calculate compatibility score for yeast substitution

        Args:
            yeast: Yeast ingredient dictionary
            target_attenuation: Target attenuation percentage
            style_requirements: Style requirements

        Returns:
            Confidence score (0.0 to 1.0)
        """
        score = 0.0

        # Attenuation score (40% weight)
        yeast_attenuation = yeast.get("attenuation", 75)
        attenuation_diff = abs(yeast_attenuation - target_attenuation)
        if attenuation_diff <= 2:
            score += 0.4
        elif attenuation_diff <= 5:
            score += 0.3
        elif attenuation_diff <= 10:
            score += 0.2
        elif attenuation_diff <= 15:
            score += 0.1

        # Temperature compatibility (30% weight)
        if style_requirements and "temperature_range" in style_requirements:
            style_min = style_requirements["temperature_range"].get("min", 60)
            style_max = style_requirements["temperature_range"].get("max", 75)

            yeast_min = yeast.get("min_temperature")
            yeast_max = yeast.get("max_temperature")

            if yeast_min is not None and yeast_max is not None:
                # Check if temperature ranges overlap
                if not (yeast_max < style_min or yeast_min > style_max):
                    score += 0.3
                else:
                    # Partial overlap or close range
                    min_diff = min(
                        abs(yeast_min - style_min), abs(yeast_max - style_max)
                    )
                    if min_diff <= 5:
                        score += 0.15
        else:
            # Default temperature compatibility bonus
            score += 0.15

        # Yeast type match (20% weight)
        yeast_type = yeast.get("yeast_type")
        if yeast_type:
            score += 0.2

        # Manufacturer consistency (10% weight)
        # Bonus for same manufacturer (indicates similar characteristics)
        score += 0.1

        return min(score, 1.0)

    def find_base_malts_by_style(self, style_name: str) -> List[Dict]:
        """
        Find appropriate base malts for a specific beer style

        Args:
            style_name: Beer style name

        Returns:
            List of suitable base malt dictionaries
        """
        try:
            style_lower = style_name.lower()

            # Style-specific base malt recommendations
            style_base_malt_map = {
                "ipa": ["2-row", "pale ale", "maris otter"],
                "stout": ["maris otter", "munich dark", "pale ale"],
                "porter": ["munich dark", "maris otter", "pale ale"],
                "lager": ["pilsner", "2-row", "vienna"],
                "wheat": ["wheat", "pilsner", "2-row"],
                "belgian": ["pilsner", "pale ale", "munich"],
                "german": ["pilsner", "munich", "vienna"],
                "english": ["maris otter", "golden promise", "pale ale"],
                "american": ["2-row", "pale ale"],
            }

            # Find matching style patterns
            recommended_malts = []
            for style_pattern, malts in style_base_malt_map.items():
                if style_pattern in style_lower:
                    recommended_malts.extend(malts)
                    break

            if not recommended_malts:
                # Default to common base malts
                recommended_malts = ["2-row", "pale ale", "pilsner"]

            # Query database for these malts
            base_malts = []
            for malt_name in recommended_malts:
                malts = self.find_ingredients_by_name(
                    malt_name, ingredient_type="grain", exact_match=False
                )

                # Filter to only base malts
                for malt in malts:
                    if malt.get("grain_type") == "base_malt":
                        base_malts.append(malt)

            return base_malts[:5]  # Return top 5 matches

        except Exception as e:
            logger.error(f"Error finding base malts for style '{style_name}': {str(e)}")
            return []

    def validate_ingredient_exists(self, ingredient_id: str) -> bool:
        """
        Validate that an ingredient exists in the database

        Args:
            ingredient_id: Database ID of ingredient to validate

        Returns:
            True if ingredient exists, False otherwise
        """
        try:
            return Ingredient.objects(id=ingredient_id).count() > 0
        except Exception as e:
            logger.error(f"Error validating ingredient {ingredient_id}: {str(e)}")
            return False

    def create_substitution_change(
        self,
        old_ingredient: Dict,
        new_ingredient: Dict,
        recipe_context: Dict,
        substitution_reason: str,
        confidence_score: float = 1.0,
    ) -> Dict:
        """
        Create a standardized ingredient_substituted change object

        Args:
            old_ingredient: Original ingredient data
            new_ingredient: Substitute ingredient data
            recipe_context: Recipe context (amount, unit, use, time)
            substitution_reason: Reason for substitution
            confidence_score: Confidence in the substitution (0.0-1.0)

        Returns:
            Standardized change dictionary
        """
        return {
            "type": "ingredient_substituted",
            "old_ingredient_id": old_ingredient.get("ingredient_id"),
            "new_ingredient_id": new_ingredient.get("ingredient_id"),
            "old_ingredient_data": old_ingredient,
            "new_ingredient_data": new_ingredient,
            "amount": recipe_context.get("amount"),
            "unit": recipe_context.get("unit"),
            "use": recipe_context.get("use"),
            "time": recipe_context.get("time"),
            "substitution_reason": substitution_reason,
            "confidence_score": confidence_score,
            "change_reason": f"Substituted {old_ingredient.get('name')} with {new_ingredient.get('name')}: {substitution_reason}",
        }

    def find_ingredient_by_name(
        self, name: str, exact_match: bool = True
    ) -> Optional[Dict]:
        """
        Find a single ingredient by name with exact or fuzzy matching

        Args:
            name: Ingredient name to search for
            exact_match: If True, use exact name matching, else fuzzy matching

        Returns:
            First matching ingredient dictionary or None
        """
        try:
            query = {}

            if exact_match:
                query["name__iexact"] = name
            else:
                query["name__icontains"] = name

            ingredient = Ingredient.objects(**query).first()
            return ingredient.to_dict() if ingredient else None

        except Exception as e:
            logger.error(f"Error finding ingredient by name '{name}': {str(e)}")
            return None

    def find_darkest_roasted_grain(self) -> Optional[Dict]:
        """
        Find the darkest roasted grain in the database

        Returns:
            Dictionary of the darkest roasted grain (highest color value) or None
        """
        try:
            # Query for roasted grains sorted by color descending
            roasted_grains = Ingredient.objects(
                type="grain", grain_type="roasted"
            ).order_by("-color")

            darkest = roasted_grains.first()
            return darkest.to_dict() if darkest else None

        except Exception as e:
            logger.error(f"Error finding darkest roasted grain: {str(e)}")
            return None


# Singleton instance
_ingredient_lookup_service = None


def get_ingredient_lookup_service() -> IngredientLookupService:
    """Get singleton IngredientLookupService instance"""
    global _ingredient_lookup_service
    if _ingredient_lookup_service is None:
        _ingredient_lookup_service = IngredientLookupService()
    return _ingredient_lookup_service
