from datetime import UTC, datetime

import pytest
from bson import ObjectId

from models.mongo_models import (
    BrewSession,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User,
    UserSettings,
)
from services.attenuation_service import AttenuationService


class TestAttenuationService:
    """Test cases for the AttenuationService"""

    def test_calculate_actual_attenuation(self):
        """Test calculation of actual attenuation from OG and FG"""
        # Normal case
        og = 1.050
        fg = 1.010
        expected = 80.0  # ((1.050 - 1.010) / (1.050 - 1.0)) * 100 = 80.0
        actual = AttenuationService.calculate_actual_attenuation(og, fg)
        assert actual == expected

        # Edge cases
        assert AttenuationService.calculate_actual_attenuation(None, 1.010) is None
        assert AttenuationService.calculate_actual_attenuation(1.050, None) is None
        assert (
            AttenuationService.calculate_actual_attenuation(1.000, 1.010) is None
        )  # Invalid OG
        assert (
            AttenuationService.calculate_actual_attenuation(1.010, 1.050) is None
        )  # FG > OG

    def test_is_valid_attenuation(self):
        """Test attenuation validation"""
        assert AttenuationService.is_valid_attenuation(75.0) is True
        assert AttenuationService.is_valid_attenuation(45.0) is True
        assert AttenuationService.is_valid_attenuation(90.0) is True

        # Out of range
        assert AttenuationService.is_valid_attenuation(30.0) is False  # Too low
        assert AttenuationService.is_valid_attenuation(98.0) is False  # Too high

    def test_calculate_confidence_score(self):
        """Test confidence score calculation"""
        # Below minimum
        assert AttenuationService.calculate_confidence_score(3) == 0.0

        # At minimum
        assert AttenuationService.calculate_confidence_score(5) == 0.0

        # In range
        score = AttenuationService.calculate_confidence_score(25)
        assert 0.0 < score < 1.0

        # At maximum
        assert AttenuationService.calculate_confidence_score(50) == 1.0

        # Above maximum
        assert AttenuationService.calculate_confidence_score(75) == 1.0

    def test_update_yeast_attenuation_data(self, app):
        """Test updating yeast ingredient with attenuation data"""
        with app.app_context():
            # Create a test yeast ingredient
            yeast = Ingredient(
                name="Test Yeast",
                type="yeast",
                attenuation=75.0,
                manufacturer="Test Lab",
                code="T001",
            ).save()

            # Update with first data point
            success = AttenuationService.update_yeast_attenuation_data(
                str(yeast.id), 78.0
            )
            assert success is True

            # Reload and check
            yeast.reload()
            assert len(yeast.actual_attenuation_data) == 1
            assert yeast.actual_attenuation_data[0] == 78.0
            assert yeast.actual_attenuation_average == 78.0
            assert yeast.actual_attenuation_count == 1
            assert yeast.attenuation_confidence == 0.0  # Below minimum threshold

            # Add more data points
            for attenuation in [76.0, 80.0, 77.0, 79.0]:
                AttenuationService.update_yeast_attenuation_data(
                    str(yeast.id), attenuation
                )

            yeast.reload()
            assert yeast.actual_attenuation_count == 5
            assert yeast.attenuation_confidence == 0.0  # At minimum threshold
            assert yeast.actual_attenuation_average == 78.0  # Average of all values

    def test_get_improved_attenuation_estimate(self, app):
        """Test getting improved attenuation estimates"""
        with app.app_context():
            # Create yeast with only theoretical data
            yeast1 = Ingredient(
                name="Theoretical Yeast", type="yeast", attenuation=75.0
            ).save()

            estimate = AttenuationService.get_improved_attenuation_estimate(
                str(yeast1.id)
            )
            assert estimate == 75.0  # Should return theoretical

            # Create yeast with actual data
            yeast2 = Ingredient(
                name="Real World Yeast",
                type="yeast",
                attenuation=75.0,
                actual_attenuation_data=[78.0, 80.0, 77.0, 79.0, 76.0],
                actual_attenuation_average=78.0,
                actual_attenuation_count=5,
                attenuation_confidence=0.0,
            ).save()

            estimate = AttenuationService.get_improved_attenuation_estimate(
                str(yeast2.id)
            )
            # With 0 confidence, should return theoretical attenuation only
            assert estimate == 75.0

    def test_process_completed_brew_session(self, app):
        """Test processing a completed brew session for attenuation data"""
        with app.app_context():
            # Create user with privacy settings enabled
            user = User(
                username="testuser",
                email="test@example.com",
                password_hash="hash",
                settings=UserSettings(share_yeast_performance=True),
            ).save()

            # Create yeast ingredient
            yeast = Ingredient(name="Test Yeast", type="yeast", attenuation=75.0).save()

            # Create recipe with yeast
            recipe = Recipe(
                user_id=user.id,
                name="Test Recipe",
                batch_size=5.0,
                ingredients=[
                    RecipeIngredient(
                        ingredient_id=yeast.id,
                        name="Test Yeast",
                        type="yeast",
                        amount=1.0,
                        unit="pkg",
                        attenuation=75.0,
                    )
                ],
            ).save()

            # Create completed brew session
            session = BrewSession(
                user_id=user.id,
                recipe_id=recipe.id,
                status="completed",
                actual_og=1.050,
                actual_fg=1.010,
            ).save()

            # Process the session
            success = AttenuationService.process_completed_brew_session(session)
            assert success is True

            # Check that yeast data was updated
            yeast.reload()
            assert yeast.actual_attenuation_count == 1
            assert yeast.actual_attenuation_average == 80.0  # Calculated from OG/FG

    def test_process_completed_brew_session_privacy_disabled(self, app):
        """Test that sessions from users with privacy disabled are not processed"""
        with app.app_context():
            # Create user with privacy settings disabled
            user = User(
                username="privateuser",
                email="private@example.com",
                password_hash="hash",
                settings=UserSettings(share_yeast_performance=False),
            ).save()

            # Create yeast ingredient
            yeast = Ingredient(
                name="Private Yeast", type="yeast", attenuation=75.0
            ).save()

            # Create recipe with yeast
            recipe = Recipe(
                user_id=user.id,
                name="Private Recipe",
                batch_size=5.0,
                ingredients=[
                    RecipeIngredient(
                        ingredient_id=yeast.id,
                        name="Private Yeast",
                        type="yeast",
                        amount=1.0,
                        unit="pkg",
                        attenuation=75.0,
                    )
                ],
            ).save()

            # Create completed brew session
            session = BrewSession(
                user_id=user.id,
                recipe_id=recipe.id,
                status="completed",
                actual_og=1.050,
                actual_fg=1.010,
            ).save()

            # Process the session
            success = AttenuationService.process_completed_brew_session(session)
            assert success is False  # Should fail due to privacy settings

            # Check that yeast data was not updated
            yeast.reload()
            assert yeast.actual_attenuation_count == 0

    def test_get_attenuation_analytics(self, app):
        """Test getting analytics for a yeast ingredient"""
        with app.app_context():
            # Create yeast with actual data
            yeast = Ingredient(
                name="Analytics Yeast",
                type="yeast",
                attenuation=75.0,
                manufacturer="Test Lab",
                code="A001",
                actual_attenuation_data=[78.0, 80.0, 77.0, 79.0, 76.0],
                actual_attenuation_average=78.0,
                actual_attenuation_count=5,
                attenuation_confidence=0.0,
                last_attenuation_update=datetime.now(UTC),
            ).save()

            analytics = AttenuationService.get_attenuation_analytics(str(yeast.id))

            assert analytics is not None
            assert analytics["name"] == "Analytics Yeast"
            assert analytics["theoretical_attenuation"] == 75.0
            assert analytics["actual_attenuation_average"] == 78.0
            assert analytics["actual_attenuation_count"] == 5
            assert analytics["min_actual"] == 76.0
            assert analytics["max_actual"] == 80.0
            assert "std_deviation" in analytics
            assert "improved_estimate" in analytics
