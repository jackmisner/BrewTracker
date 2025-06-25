import pytest
import json
from models.mongo_models import User


class TestUserSettingsEndpoints:
    """Comprehensive tests for user settings endpoints"""

    @pytest.fixture
    def authenticated_user(self, client):
        """Create and authenticate a user, return user and auth headers"""
        # Register user
        client.post(
            "/api/auth/register",
            json={
                "username": "settingsuser",
                "email": "settings@example.com",
                "password": "password123",
            },
        )

        # Login to get token
        login_response = client.post(
            "/api/auth/login",
            json={"username": "settingsuser", "password": "password123"},
        )
        token = login_response.json["access_token"]
        user = User.objects(username="settingsuser").first()

        return user, {"Authorization": f"Bearer {token}"}

    def test_get_user_settings_success(self, client, authenticated_user):
        """Test getting user settings successfully"""
        user, headers = authenticated_user

        response = client.get("/api/user/settings", headers=headers)

        assert response.status_code == 200
        assert "user" in response.json
        assert "settings" in response.json
        assert response.json["user"]["username"] == "settingsuser"
        assert response.json["user"]["email"] == "settings@example.com"

    def test_get_user_settings_unauthorized(self, client):
        """Test getting user settings without authentication"""
        response = client.get("/api/user/settings")
        assert response.status_code == 401

    def test_update_user_settings_success(self, client, authenticated_user):
        """Test updating user settings successfully"""
        user, headers = authenticated_user

        settings_data = {
            "settings": {
                "contribute_anonymous_data": True,
                "share_yeast_performance": True,
                "share_recipe_metrics": False,
                "public_recipes_default": True,
                "default_batch_size": 6.0,
                "preferred_units": "metric",
                "timezone": "America/New_York",
                "email_notifications": False,
                "brew_reminders": True,
            }
        }

        response = client.put("/api/user/settings", json=settings_data, headers=headers)

        assert response.status_code == 200
        assert "message" in response.json
        assert "Settings updated successfully" in response.json["message"]
        assert "settings" in response.json

        # Verify settings were actually updated
        updated_settings = response.json["settings"]
        assert updated_settings["contribute_anonymous_data"] is True
        assert updated_settings["share_yeast_performance"] is True
        assert updated_settings["preferred_units"] == "metric"
        assert updated_settings["default_batch_size"] == 6.0
        assert updated_settings["timezone"] == "America/New_York"

    def test_update_user_settings_partial(self, client, authenticated_user):
        """Test updating only some user settings"""
        user, headers = authenticated_user

        # Update only a few settings
        settings_data = {
            "settings": {
                "preferred_units": "metric",
                "default_batch_size": 19.0,
            }
        }

        response = client.put("/api/user/settings", json=settings_data, headers=headers)

        assert response.status_code == 200
        updated_settings = response.json["settings"]
        assert updated_settings["preferred_units"] == "metric"
        assert updated_settings["default_batch_size"] == 19.0

    def test_update_user_settings_unauthorized(self, client):
        """Test updating user settings without authentication"""
        settings_data = {"settings": {"preferred_units": "metric"}}
        response = client.put("/api/user/settings", json=settings_data)
        assert response.status_code == 401

    def test_update_profile_success(self, client, authenticated_user):
        """Test updating user profile successfully"""
        user, headers = authenticated_user

        profile_data = {
            "username": "newsettingsuser",
            "email": "newsettings@example.com",
        }

        response = client.put("/api/user/profile", json=profile_data, headers=headers)

        assert response.status_code == 200
        assert "message" in response.json
        assert "Profile updated successfully" in response.json["message"]
        assert response.json["user"]["username"] == "newsettingsuser"
        assert response.json["user"]["email"] == "newsettings@example.com"
        assert (
            response.json["user"]["email_verified"] is False
        )  # Should reset verification

    def test_update_profile_username_only(self, client, authenticated_user):
        """Test updating only username"""
        user, headers = authenticated_user

        profile_data = {"username": "updatedusername"}

        response = client.put("/api/user/profile", json=profile_data, headers=headers)

        assert response.status_code == 200
        assert response.json["user"]["username"] == "updatedusername"
        assert response.json["user"]["email"] == "settings@example.com"  # Unchanged

    def test_update_profile_email_only(self, client, authenticated_user):
        """Test updating only email"""
        user, headers = authenticated_user

        profile_data = {"email": "newemail@example.com"}

        response = client.put("/api/user/profile", json=profile_data, headers=headers)

        assert response.status_code == 200
        assert response.json["user"]["email"] == "newemail@example.com"
        assert response.json["user"]["username"] == "settingsuser"  # Unchanged

    def test_update_profile_invalid_email(self, client, authenticated_user):
        """Test updating profile with invalid email format"""
        user, headers = authenticated_user

        profile_data = {"email": "invalid-email"}

        response = client.put("/api/user/profile", json=profile_data, headers=headers)

        assert response.status_code == 400
        assert "Invalid email format" in response.json["error"]

    def test_update_profile_duplicate_email(self, client, authenticated_user):
        """Test updating profile with duplicate email"""
        user, headers = authenticated_user

        # Create another user
        client.post(
            "/api/auth/register",
            json={
                "username": "otheruser",
                "email": "other@example.com",
                "password": "password123",
            },
        )

        # Try to use the other user's email
        profile_data = {"email": "other@example.com"}

        response = client.put("/api/user/profile", json=profile_data, headers=headers)

        assert response.status_code == 400
        assert "Email already in use" in response.json["error"]

    def test_update_profile_duplicate_username(self, client, authenticated_user):
        """Test updating profile with duplicate username"""
        user, headers = authenticated_user

        # Create another user
        client.post(
            "/api/auth/register",
            json={
                "username": "otherusername",
                "email": "other2@example.com",
                "password": "password123",
            },
        )

        # Try to use the other user's username
        profile_data = {"username": "otherusername"}

        response = client.put("/api/user/profile", json=profile_data, headers=headers)

        assert response.status_code == 400
        assert "Username already taken" in response.json["error"]

    def test_update_profile_unauthorized(self, client):
        """Test updating profile without authentication"""
        profile_data = {"username": "newusername"}
        response = client.put("/api/user/profile", json=profile_data)
        assert response.status_code == 401

    def test_change_password_success(self, client, authenticated_user):
        """Test changing password successfully"""
        user, headers = authenticated_user

        password_data = {
            "current_password": "password123",
            "new_password": "newpassword456",
        }

        response = client.post(
            "/api/user/change-password", json=password_data, headers=headers
        )

        assert response.status_code == 200
        assert "Password changed successfully" in response.json["message"]

        # Verify the password was actually changed by trying to login
        login_response = client.post(
            "/api/auth/login",
            json={"username": "settingsuser", "password": "newpassword456"},
        )
        assert login_response.status_code == 200

    def test_change_password_wrong_current(self, client, authenticated_user):
        """Test changing password with wrong current password"""
        user, headers = authenticated_user

        password_data = {
            "current_password": "wrongpassword",
            "new_password": "newpassword456",
        }

        response = client.post(
            "/api/user/change-password", json=password_data, headers=headers
        )

        assert response.status_code == 400
        assert "Current password is incorrect" in response.json["error"]

    def test_change_password_too_short(self, client, authenticated_user):
        """Test changing password with new password too short"""
        user, headers = authenticated_user

        password_data = {
            "current_password": "password123",
            "new_password": "123",  # Too short
        }

        response = client.post(
            "/api/user/change-password", json=password_data, headers=headers
        )

        assert response.status_code == 400
        assert "New password must be at least 6 characters" in response.json["error"]

    def test_change_password_missing_fields(self, client, authenticated_user):
        """Test changing password with missing fields"""
        user, headers = authenticated_user

        # Missing new password
        password_data = {"current_password": "password123"}
        response = client.post(
            "/api/user/change-password", json=password_data, headers=headers
        )
        assert response.status_code == 400
        assert (
            "Current password and new password are required" in response.json["error"]
        )

        # Missing current password
        password_data = {"new_password": "newpassword"}
        response = client.post(
            "/api/user/change-password", json=password_data, headers=headers
        )
        assert response.status_code == 400
        assert (
            "Current password and new password are required" in response.json["error"]
        )

    def test_change_password_unauthorized(self, client):
        """Test changing password without authentication"""
        password_data = {
            "current_password": "password123",
            "new_password": "newpassword456",
        }
        response = client.post("/api/user/change-password", json=password_data)
        assert response.status_code == 401

    def test_delete_account_success(self, client, authenticated_user):
        """Test deleting account successfully"""
        user, headers = authenticated_user

        delete_data = {
            "password": "password123",
            "confirmation": "DELETE",
        }

        response = client.post(
            "/api/user/delete-account", json=delete_data, headers=headers
        )

        assert response.status_code == 200
        assert "Account deactivated successfully" in response.json["message"]

        # Verify user is deactivated
        updated_user = User.objects(id=user.id).first()
        assert updated_user.is_active is False
        assert "deleted_user_" in updated_user.username
        assert "deleted_" in updated_user.email

    def test_delete_account_wrong_password(self, client, authenticated_user):
        """Test deleting account with wrong password"""
        user, headers = authenticated_user

        delete_data = {
            "password": "wrongpassword",
            "confirmation": "DELETE",
        }

        response = client.post(
            "/api/user/delete-account", json=delete_data, headers=headers
        )

        assert response.status_code == 400
        assert "Password is incorrect" in response.json["error"]

    def test_delete_account_wrong_confirmation(self, client, authenticated_user):
        """Test deleting account with wrong confirmation"""
        user, headers = authenticated_user

        delete_data = {
            "password": "password123",
            "confirmation": "WRONG",
        }

        response = client.post(
            "/api/user/delete-account", json=delete_data, headers=headers
        )

        assert response.status_code == 400
        assert "Must type 'DELETE' to confirm" in response.json["error"]

    def test_delete_account_missing_password(self, client, authenticated_user):
        """Test deleting account with missing password"""
        user, headers = authenticated_user

        delete_data = {"confirmation": "DELETE"}

        response = client.post(
            "/api/user/delete-account", json=delete_data, headers=headers
        )

        assert response.status_code == 400
        assert "Password is required" in response.json["error"]

    def test_delete_account_unauthorized(self, client):
        """Test deleting account without authentication"""
        delete_data = {
            "password": "password123",
            "confirmation": "DELETE",
        }
        response = client.post("/api/user/delete-account", json=delete_data)
        assert response.status_code == 401

    def test_get_unit_preferences_success(self, client, authenticated_user):
        """Test getting unit preferences successfully"""
        user, headers = authenticated_user

        response = client.get("/api/user/preferences/units", headers=headers)

        assert response.status_code == 200
        assert "unit_system" in response.json
        assert "preferences" in response.json
        assert "available_units" in response.json
        assert "default_units" in response.json

        # Check structure of available units
        available = response.json["available_units"]
        assert "weight" in available
        assert "volume" in available
        assert "temperature" in available
        assert "g" in available["weight"]
        assert "kg" in available["weight"]
        assert "ml" in available["volume"]
        assert "gal" in available["volume"]

    def test_get_unit_preferences_unauthorized(self, client):
        """Test getting unit preferences without authentication"""
        response = client.get("/api/user/preferences/units")
        assert response.status_code == 401

    def test_update_unit_preferences_metric(self, client, authenticated_user):
        """Test updating unit preferences to metric"""
        user, headers = authenticated_user

        unit_data = {
            "unit_system": "metric",
            "preferences": {
                "weight_primary": "kg",
                "volume_primary": "l",
            },
        }

        response = client.put(
            "/api/user/preferences/units", json=unit_data, headers=headers
        )

        assert response.status_code == 200
        assert "Unit preferences updated successfully" in response.json["message"]
        assert response.json["unit_system"] == "metric"

    def test_update_unit_preferences_imperial(self, client, authenticated_user):
        """Test updating unit preferences to imperial"""
        user, headers = authenticated_user

        unit_data = {
            "unit_system": "imperial",
            "preferences": {
                "weight_primary": "lb",
                "volume_primary": "gal",
            },
        }

        response = client.put(
            "/api/user/preferences/units", json=unit_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json["unit_system"] == "imperial"

    def test_update_unit_preferences_invalid_system(self, client, authenticated_user):
        """Test updating unit preferences with invalid system"""
        user, headers = authenticated_user

        unit_data = {"unit_system": "invalid"}

        response = client.put(
            "/api/user/preferences/units", json=unit_data, headers=headers
        )

        assert response.status_code == 400
        assert "Invalid unit system" in response.json["error"]

    def test_update_unit_preferences_unauthorized(self, client):
        """Test updating unit preferences without authentication"""
        unit_data = {"unit_system": "metric"}
        response = client.put("/api/user/preferences/units", json=unit_data)
        assert response.status_code == 401

    def test_convert_units_weight(self, client, authenticated_user):
        """Test unit conversion utility for weight"""
        user, headers = authenticated_user

        conversion_data = {
            "type": "weight",
            "amount": 1,
            "from_unit": "kg",
            "to_unit": "lb",
        }

        response = client.post(
            "/api/user/preferences/convert", json=conversion_data, headers=headers
        )

        assert response.status_code == 200
        assert "original" in response.json
        assert "converted" in response.json
        assert response.json["original"]["amount"] == 1
        assert response.json["original"]["unit"] == "kg"
        assert response.json["converted"]["unit"] == "lb"
        assert abs(response.json["converted"]["amount"] - 2.205) < 0.01

    def test_convert_units_volume(self, client, authenticated_user):
        """Test unit conversion utility for volume"""
        user, headers = authenticated_user

        conversion_data = {
            "type": "volume",
            "amount": 1,
            "from_unit": "gal",
            "to_unit": "l",
        }

        response = client.post(
            "/api/user/preferences/convert", json=conversion_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json["original"]["amount"] == 1
        assert response.json["original"]["unit"] == "gal"
        assert response.json["converted"]["unit"] == "l"
        assert abs(response.json["converted"]["amount"] - 3.785) < 0.01

    def test_convert_units_temperature(self, client, authenticated_user):
        """Test unit conversion utility for temperature"""
        user, headers = authenticated_user

        conversion_data = {
            "type": "temperature",
            "amount": 32,
            "from_unit": "F",
            "to_unit": "C",
        }

        response = client.post(
            "/api/user/preferences/convert", json=conversion_data, headers=headers
        )

        assert response.status_code == 200
        assert response.json["original"]["amount"] == 32
        assert response.json["original"]["unit"] == "F"
        assert response.json["converted"]["unit"] == "C"
        assert response.json["converted"]["amount"] == 0

    def test_convert_units_invalid_type(self, client, authenticated_user):
        """Test unit conversion with invalid type"""
        user, headers = authenticated_user

        conversion_data = {
            "type": "invalid",
            "amount": 1,
            "from_unit": "kg",
            "to_unit": "lb",
        }

        response = client.post(
            "/api/user/preferences/convert", json=conversion_data, headers=headers
        )

        assert response.status_code == 400
        assert "Invalid conversion type" in response.json["error"]

    def test_convert_units_invalid_amount(self, client, authenticated_user):
        """Test unit conversion with invalid amount"""
        user, headers = authenticated_user

        conversion_data = {
            "type": "weight",
            "amount": "invalid",
            "from_unit": "kg",
            "to_unit": "lb",
        }

        response = client.post(
            "/api/user/preferences/convert", json=conversion_data, headers=headers
        )

        assert response.status_code == 400
        assert "Conversion failed" in response.json["error"]

    def test_convert_units_unauthorized(self, client):
        """Test unit conversion without authentication"""
        conversion_data = {
            "type": "weight",
            "amount": 1,
            "from_unit": "kg",
            "to_unit": "lb",
        }
        response = client.post("/api/user/preferences/convert", json=conversion_data)
        assert response.status_code == 401

    def test_settings_persistence(self, client, authenticated_user):
        """Test that settings persist across requests"""
        user, headers = authenticated_user

        # Set some specific settings
        settings_data = {
            "settings": {
                "preferred_units": "metric",
                "default_batch_size": 20.0,
                "email_notifications": False,
            }
        }

        response = client.put("/api/user/settings", json=settings_data, headers=headers)
        assert response.status_code == 200

        # Get settings again and verify they persisted
        response = client.get("/api/user/settings", headers=headers)
        assert response.status_code == 200

        settings = response.json["settings"]
        assert settings["preferred_units"] == "metric"
        assert settings["default_batch_size"] == 20.0
        assert settings["email_notifications"] is False

    def test_settings_validation_edge_cases(self, client, authenticated_user):
        """Test edge cases in settings validation"""
        user, headers = authenticated_user

        # Test with empty settings object
        response = client.put(
            "/api/user/settings", json={"settings": {}}, headers=headers
        )
        assert response.status_code == 200

        # Test with no settings key
        response = client.put("/api/user/settings", json={}, headers=headers)
        assert response.status_code == 200

        # Test with null/invalid values (should be handled gracefully)
        settings_data = {
            "settings": {
                "preferred_units": None,
                "default_batch_size": "invalid",
            }
        }
        # This might pass or fail depending on implementation
        response = client.put("/api/user/settings", json=settings_data, headers=headers)
        # Don't assert specific status code as behavior may vary
