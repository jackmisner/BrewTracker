from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import check_password_hash
from models.mongo_models import User
import re

user_settings_bp = Blueprint("user_settings", __name__)


@user_settings_bp.route("/settings", methods=["GET"])
@jwt_required()
def get_user_settings():
    """Get current user settings"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return (
        jsonify(
            {
                "user": user.to_dict(),
                "settings": user.settings.to_dict() if user.settings else {},
            }
        ),
        200,
    )


@user_settings_bp.route("/settings", methods=["PUT"])
@jwt_required()
def update_user_settings():
    """Update user settings"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    settings_data = data.get("settings", {})

    try:
        user.update_settings(settings_data)
        return (
            jsonify(
                {
                    "message": "Settings updated successfully",
                    "settings": user.settings.to_dict(),
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": f"Failed to update settings: {str(e)}"}), 400


@user_settings_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """Update basic profile information"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()

    # Validate email format
    new_email = data.get("email")
    if new_email and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", new_email):
        return jsonify({"error": "Invalid email format"}), 400

    # Check if email is already taken
    if new_email and new_email != user.email:
        existing_user = User.objects(email=new_email).first()
        if existing_user:
            return jsonify({"error": "Email already in use"}), 400

    # Check if username is already taken
    new_username = data.get("username")
    if new_username and new_username != user.username:
        existing_user = User.objects(username=new_username).first()
        if existing_user:
            return jsonify({"error": "Username already taken"}), 400

    try:
        if new_email:
            user.email = new_email
            user.email_verified = False  # Require re-verification

        if new_username:
            user.username = new_username

        user.save()

        return (
            jsonify(
                {"message": "Profile updated successfully", "user": user.to_dict()}
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": f"Failed to update profile: {str(e)}"}), 400


@user_settings_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Change user password"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        return jsonify({"error": "Current password and new password are required"}), 400

    # Verify current password
    if not user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 400

    # Validate new password
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    try:
        user.set_password(new_password)
        user.save()

        return jsonify({"message": "Password changed successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to change password: {str(e)}"}), 400


@user_settings_bp.route("/delete-account", methods=["POST"])
@jwt_required()
def delete_account():
    """Delete user account (with confirmation)"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    password = data.get("password")
    confirmation = data.get("confirmation")

    if not password:
        return jsonify({"error": "Password is required"}), 400

    if confirmation != "DELETE":
        return jsonify({"error": "Must type 'DELETE' to confirm"}), 400

    # Verify password
    if not user.check_password(password):
        return jsonify({"error": "Password is incorrect"}), 400

    try:
        # TODO: Also delete user's recipes, brew sessions, etc.
        # This should be implemented carefully with proper cascade deletion

        # For now, just deactivate the account
        user.is_active = False
        user.username = f"deleted_user_{user.id}"
        user.email = f"deleted_{user.id}@example.com"
        user.save()

        return jsonify({"message": "Account deactivated successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete account: {str(e)}"}), 400


@user_settings_bp.route("/preferences/units", methods=["GET"])
@jwt_required()
def get_unit_preferences():
    """Get user's unit preferences and conversion info"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    from utils.unit_conversions import UnitConverter

    unit_system = user.get_preferred_units()
    unit_preferences = user.get_unit_preferences()

    return (
        jsonify(
            {
                "unit_system": unit_system,
                "preferences": unit_preferences,
                "available_units": {
                    "weight": ["g", "kg", "oz", "lb"],
                    "volume": ["ml", "l", "floz", "cup", "pint", "quart", "gal"],
                    "temperature": ["C", "F"],
                },
                "default_units": UnitConverter.get_preferred_units(unit_system),
            }
        ),
        200,
    )


@user_settings_bp.route("/preferences/convert", methods=["POST"])
@jwt_required()
def convert_units():
    """Convert units for user (utility endpoint)"""
    data = request.get_json()

    try:
        from utils.unit_conversions import UnitConverter

        conversion_type = data.get("type")  # weight, volume, temperature
        amount = float(data.get("amount"))
        from_unit = data.get("from_unit")
        to_unit = data.get("to_unit")

        if conversion_type == "weight":
            result = UnitConverter.convert_weight(amount, from_unit, to_unit)
        elif conversion_type == "volume":
            result = UnitConverter.convert_volume(amount, from_unit, to_unit)
        elif conversion_type == "temperature":
            result = UnitConverter.convert_temperature(amount, from_unit, to_unit)
        else:
            return jsonify({"error": "Invalid conversion type"}), 400

        return (
            jsonify(
                {
                    "original": {"amount": amount, "unit": from_unit},
                    "converted": {"amount": round(result, 3), "unit": to_unit},
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": f"Conversion failed: {str(e)}"}), 400
