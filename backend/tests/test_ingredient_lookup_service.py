"""
Tests for IngredientLookupService

Tests the ingredient search, matching, and substitution logic
for the AI optimization system.
"""

from unittest.mock import MagicMock, patch

import pytest

from models.mongo_models import Ingredient
from services.ingredient_lookup_service import (
    IngredientLookupService,
    get_ingredient_lookup_service,
)


class TestIngredientLookupService:
    """Test ingredient lookup service functionality"""

    def setup_method(self):
        """Set up test fixtures"""
        self.service = IngredientLookupService()

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_get_ingredient_cache(self, mock_ingredient):
        """Test ingredient cache retrieval"""
        # Mock ingredient data
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {
            "ingredient_id": "1",
            "name": "Test Malt",
            "type": "grain",
        }
        mock_ingredient.objects.return_value = [mock_ingredient_obj]

        result = self.service._get_ingredient_cache()

        assert len(result) == 1
        assert result[0]["name"] == "Test Malt"
        mock_ingredient.objects.assert_called_once()

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_get_ingredient_cache_error(self, mock_ingredient):
        """Test ingredient cache error handling"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service._get_ingredient_cache()

        assert result == []

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_id_success(self, mock_ingredient):
        """Test finding ingredient by ID successfully"""
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {
            "ingredient_id": "1",
            "name": "Test Malt",
        }
        mock_ingredient.objects.return_value.first.return_value = mock_ingredient_obj

        result = self.service.find_ingredient_by_id("1")

        assert result["name"] == "Test Malt"
        mock_ingredient.objects.assert_called_with(id="1")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_id_not_found(self, mock_ingredient):
        """Test finding ingredient by ID when not found"""
        mock_ingredient.objects.return_value.first.return_value = None

        result = self.service.find_ingredient_by_id("nonexistent")

        assert result is None

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_id_error(self, mock_ingredient):
        """Test finding ingredient by ID with error"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.find_ingredient_by_id("1")

        assert result is None

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredients_by_name_exact_match(self, mock_ingredient):
        """Test finding ingredients by name with exact match"""
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {
            "name": "Pilsner Malt",
            "type": "grain",
        }
        mock_ingredient.objects.return_value = [mock_ingredient_obj]

        result = self.service.find_ingredients_by_name("Pilsner Malt", exact_match=True)

        assert len(result) == 1
        assert result[0]["name"] == "Pilsner Malt"
        mock_ingredient.objects.assert_called_with(name__iexact="Pilsner Malt")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredients_by_name_fuzzy_match(self, mock_ingredient):
        """Test finding ingredients by name with fuzzy match"""
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {
            "name": "Pilsner Malt",
            "type": "grain",
        }
        mock_ingredient.objects.return_value = [mock_ingredient_obj]

        result = self.service.find_ingredients_by_name("Pilsner", exact_match=False)

        assert len(result) == 1
        mock_ingredient.objects.assert_called_with(name__icontains="Pilsner")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredients_by_name_with_type_filter(self, mock_ingredient):
        """Test finding ingredients by name with type filter"""
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {"name": "Cascade", "type": "hop"}
        mock_ingredient.objects.return_value = [mock_ingredient_obj]

        result = self.service.find_ingredients_by_name("Cascade", ingredient_type="hop")

        assert len(result) == 1
        mock_ingredient.objects.assert_called_with(
            name__icontains="Cascade", type="hop"
        )

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredients_by_name_error(self, mock_ingredient):
        """Test finding ingredients by name with error"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.find_ingredients_by_name("Test")

        assert result == []

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_similar_caramel_malts_lighter_to_darker(self, mock_ingredient):
        """Test finding similar caramel malts from lighter to darker"""
        current_caramel = {"name": "Caramel 40L", "color": 40}

        # Mock caramel malts with different colors
        mock_malt_60 = MagicMock()
        mock_malt_60.to_dict.return_value = {"name": "Caramel 60L", "color": 60}
        mock_malt_80 = MagicMock()
        mock_malt_80.to_dict.return_value = {"name": "Caramel 80L", "color": 80}
        mock_malt_20 = MagicMock()
        mock_malt_20.to_dict.return_value = {"name": "Caramel 20L", "color": 20}

        mock_ingredient.objects.return_value = [
            mock_malt_60,
            mock_malt_80,
            mock_malt_20,
        ]

        result = self.service.find_similar_caramel_malts(
            current_caramel, "lighter_to_darker"
        )

        # Should only return malts darker than 40L, sorted by color difference
        darker_malts = [malt for malt in result if malt["color"] > 40]
        assert len(darker_malts) == 2
        assert darker_malts[0]["color"] == 60  # Closest to 40L
        assert darker_malts[1]["color"] == 80

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_similar_caramel_malts_darker_to_lighter(self, mock_ingredient):
        """Test finding similar caramel malts from darker to lighter"""
        current_caramel = {"name": "Caramel 60L", "color": 60}

        mock_malt_40 = MagicMock()
        mock_malt_40.to_dict.return_value = {"name": "Caramel 40L", "color": 40}
        mock_malt_20 = MagicMock()
        mock_malt_20.to_dict.return_value = {"name": "Caramel 20L", "color": 20}
        mock_malt_80 = MagicMock()
        mock_malt_80.to_dict.return_value = {"name": "Caramel 80L", "color": 80}

        mock_ingredient.objects.return_value = [
            mock_malt_40,
            mock_malt_20,
            mock_malt_80,
        ]

        result = self.service.find_similar_caramel_malts(
            current_caramel, "darker_to_lighter"
        )

        # Should only return malts lighter than 60L
        lighter_malts = [malt for malt in result if malt["color"] < 60]
        assert len(lighter_malts) == 2
        assert lighter_malts[0]["color"] == 40  # Closest to 60L

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_similar_caramel_malts_error(self, mock_ingredient):
        """Test error handling in find_similar_caramel_malts"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.find_similar_caramel_malts({"name": "Test", "color": 40})

        assert result == []

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_similar_yeasts(self, mock_ingredient):
        """Test finding similar yeast strains"""
        current_yeast = {"name": "US-05", "attenuation": 80, "yeast_type": "ale"}

        # Mock similar yeasts
        mock_yeast1 = MagicMock()
        mock_yeast1.to_dict.return_value = {
            "name": "S-04",
            "attenuation": 78,
            "yeast_type": "ale",
        }
        mock_yeast2 = MagicMock()
        mock_yeast2.to_dict.return_value = {
            "name": "Nottingham",
            "attenuation": 82,
            "yeast_type": "ale",
        }

        mock_ingredient.objects.return_value = [mock_yeast1, mock_yeast2]

        with patch.object(
            self.service, "_calculate_yeast_compatibility", return_value=0.8
        ):
            result = self.service.find_similar_yeasts(
                current_yeast, target_attenuation=80
            )

        assert len(result) == 2
        # Should return tuples of (yeast_dict, confidence_score)
        assert isinstance(result[0], tuple)
        assert result[0][1] == 0.8  # confidence score

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_similar_yeasts_with_filters(self, mock_ingredient):
        """Test finding similar yeasts with type and attenuation filters"""
        current_yeast = {"name": "US-05", "attenuation": 80}

        mock_yeast = MagicMock()
        mock_yeast.to_dict.return_value = {
            "name": "Munich Lager",
            "attenuation": 75,
            "yeast_type": "lager",
        }
        mock_ingredient.objects.return_value = [mock_yeast]

        with patch.object(
            self.service, "_calculate_yeast_compatibility", return_value=0.6
        ):
            result = self.service.find_similar_yeasts(
                current_yeast, target_yeast_type="lager", target_attenuation=75
            )

        mock_ingredient.objects.assert_called_with(type="yeast", yeast_type="lager")
        assert len(result) == 1

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_similar_yeasts_error(self, mock_ingredient):
        """Test error handling in find_similar_yeasts"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.find_similar_yeasts({"name": "Test"})

        assert result == []

    def test_calculate_yeast_compatibility_perfect_match(self):
        """Test yeast compatibility calculation with perfect match"""
        yeast = {
            "attenuation": 80,
            "yeast_type": "ale",
            "min_temperature": 65,
            "max_temperature": 75,
        }
        style_requirements = {"temperature_range": {"min": 65, "max": 75}}

        score = self.service._calculate_yeast_compatibility(
            yeast, 80, style_requirements
        )

        # Should get high score: 0.4 (attenuation) + 0.3 (temp) + 0.2 (type) + 0.1 (manufacturer)
        assert abs(score - 1.0) < 0.001  # Account for floating point precision

    def test_calculate_yeast_compatibility_poor_match(self):
        """Test yeast compatibility calculation with poor match"""
        yeast = {
            "attenuation": 60,  # 20% difference from target
            "yeast_type": "lager",
            "min_temperature": 45,
            "max_temperature": 55,
        }
        style_requirements = {"temperature_range": {"min": 65, "max": 75}}  # No overlap

        score = self.service._calculate_yeast_compatibility(
            yeast, 80, style_requirements
        )

        # Should get low score: 0.0 (attenuation) + 0.0 (temp) + 0.2 (type) + 0.1 (manufacturer)
        assert abs(score - 0.3) < 0.001  # Account for floating point precision

    def test_calculate_yeast_compatibility_no_style_requirements(self):
        """Test yeast compatibility without style requirements"""
        yeast = {"attenuation": 78, "yeast_type": "ale"}  # 2% difference

        score = self.service._calculate_yeast_compatibility(yeast, 80, None)

        # Should get: 0.4 (attenuation) + 0.15 (default temp) + 0.2 (type) + 0.1 (manufacturer)
        assert score == 0.85

    @patch.object(IngredientLookupService, "find_ingredients_by_name")
    def test_find_base_malts_by_style_ipa(self, mock_find):
        """Test finding base malts for IPA style"""
        mock_find.return_value = [
            {"name": "2-Row Pale", "grain_type": "base_malt"},
            {"name": "Pale Ale Malt", "grain_type": "base_malt"},
        ]

        result = self.service.find_base_malts_by_style("American IPA")

        # Should find IPA-appropriate base malts
        assert len(result) > 0
        # Should have called find_ingredients_by_name for IPA malts
        assert mock_find.call_count > 0

    @patch.object(IngredientLookupService, "find_ingredients_by_name")
    def test_find_base_malts_by_style_unknown(self, mock_find):
        """Test finding base malts for unknown style"""
        mock_find.return_value = [{"name": "2-Row Pale", "grain_type": "base_malt"}]

        result = self.service.find_base_malts_by_style("Unknown Style")

        # Should fall back to default malts
        assert len(result) > 0

    @patch.object(IngredientLookupService, "find_ingredients_by_name")
    def test_find_base_malts_by_style_error(self, mock_find):
        """Test error handling in find_base_malts_by_style"""
        mock_find.side_effect = Exception("Database error")

        result = self.service.find_base_malts_by_style("IPA")

        assert result == []

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_validate_ingredient_exists_true(self, mock_ingredient):
        """Test ingredient validation when ingredient exists"""
        mock_ingredient.objects.return_value.count.return_value = 1

        result = self.service.validate_ingredient_exists("valid_id")

        assert result is True
        mock_ingredient.objects.assert_called_with(id="valid_id")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_validate_ingredient_exists_false(self, mock_ingredient):
        """Test ingredient validation when ingredient doesn't exist"""
        mock_ingredient.objects.return_value.count.return_value = 0

        result = self.service.validate_ingredient_exists("invalid_id")

        assert result is False

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_validate_ingredient_exists_error(self, mock_ingredient):
        """Test ingredient validation with error"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.validate_ingredient_exists("test_id")

        assert result is False

    def test_create_substitution_change(self):
        """Test creating substitution change object"""
        old_ingredient = {"ingredient_id": "1", "name": "Old Malt"}
        new_ingredient = {"ingredient_id": "2", "name": "New Malt"}
        recipe_context = {"amount": 1000, "unit": "g", "use": "mash", "time": 60}

        result = self.service.create_substitution_change(
            old_ingredient, new_ingredient, recipe_context, "Better flavor profile", 0.9
        )

        assert result["type"] == "ingredient_substituted"
        assert result["old_ingredient_id"] == "1"
        assert result["new_ingredient_id"] == "2"
        assert result["amount"] == 1000
        assert result["unit"] == "g"
        assert result["substitution_reason"] == "Better flavor profile"
        assert result["confidence_score"] == 0.9
        assert "Old Malt" in result["change_reason"]
        assert "New Malt" in result["change_reason"]

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_name_exact(self, mock_ingredient):
        """Test finding single ingredient by name with exact match"""
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {"name": "Pilsner Malt"}
        mock_ingredient.objects.return_value.first.return_value = mock_ingredient_obj

        result = self.service.find_ingredient_by_name("Pilsner Malt", exact_match=True)

        assert result["name"] == "Pilsner Malt"
        mock_ingredient.objects.assert_called_with(name__iexact="Pilsner Malt")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_name_fuzzy(self, mock_ingredient):
        """Test finding single ingredient by name with fuzzy match"""
        mock_ingredient_obj = MagicMock()
        mock_ingredient_obj.to_dict.return_value = {"name": "Pilsner Malt"}
        mock_ingredient.objects.return_value.first.return_value = mock_ingredient_obj

        result = self.service.find_ingredient_by_name("Pilsner", exact_match=False)

        assert result["name"] == "Pilsner Malt"
        mock_ingredient.objects.assert_called_with(name__icontains="Pilsner")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_name_not_found(self, mock_ingredient):
        """Test finding single ingredient by name when not found"""
        mock_ingredient.objects.return_value.first.return_value = None

        result = self.service.find_ingredient_by_name("Nonexistent")

        assert result is None

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_ingredient_by_name_error(self, mock_ingredient):
        """Test error handling in find_ingredient_by_name"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.find_ingredient_by_name("Test")

        assert result is None

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_darkest_roasted_grain(self, mock_ingredient):
        """Test finding darkest roasted grain"""
        mock_grain = MagicMock()
        mock_grain.to_dict.return_value = {
            "name": "Black Patent Malt",
            "color": 500,
            "grain_type": "roasted",
        }
        mock_ingredient.objects.return_value.order_by.return_value.first.return_value = (
            mock_grain
        )

        result = self.service.find_darkest_roasted_grain()

        assert result["name"] == "Black Patent Malt"
        assert result["color"] == 500
        mock_ingredient.objects.assert_called_with(type="grain", grain_type="roasted")

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_darkest_roasted_grain_not_found(self, mock_ingredient):
        """Test finding darkest roasted grain when none found"""
        mock_ingredient.objects.return_value.order_by.return_value.first.return_value = (
            None
        )

        result = self.service.find_darkest_roasted_grain()

        assert result is None

    @patch("services.ingredient_lookup_service.Ingredient")
    def test_find_darkest_roasted_grain_error(self, mock_ingredient):
        """Test error handling in find_darkest_roasted_grain"""
        mock_ingredient.objects.side_effect = Exception("Database error")

        result = self.service.find_darkest_roasted_grain()

        assert result is None


class TestIngredientLookupServiceSingleton:
    """Test singleton functionality"""

    def test_get_ingredient_lookup_service_singleton(self):
        """Test that get_ingredient_lookup_service returns singleton"""
        service1 = get_ingredient_lookup_service()
        service2 = get_ingredient_lookup_service()

        assert service1 is service2
        assert isinstance(service1, IngredientLookupService)
