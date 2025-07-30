from datetime import UTC, datetime, timedelta

import requests
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from models.mongo_models import User, UserSettings
from services.google_oauth_service import GoogleOAuthService

auth_bp = Blueprint("auth", __name__)


def get_ip():
    if request.headers.getlist("X-Forwarded-For"):
        return request.headers.getlist("X-Forwarded-For")[0]
    return request.remote_addr


def get_geo_info(ip):
    try:
        res = requests.get(f"http://ip-api.com/json/{ip}")
        if res.status_code == 200:
            data = res.json()
            return {
                "country_code": data.get("countryCode"),
                "timezone": data.get("timezone"),
            }
    except Exception as e:
        print(f"[IP Geo] Lookup failed: {e}")
    return {"country_code": None, "timezone": "UTC"}


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if User.objects(username=data.get("username")).first():
        return jsonify({"error": "Username already exists"}), 400

    if User.objects(email=data.get("email")).first():
        return jsonify({"error": "Email already exists"}), 400

    # Get user IP and geo info
    ip = get_ip()
    geo = get_geo_info(ip)
    use_metric = geo["country_code"] != "US"

    # Dynamically configure UserSettings
    settings = UserSettings(
        preferred_units="metric" if use_metric else "imperial",
        default_batch_size=19.0 if use_metric else 5.0,
        timezone=geo["timezone"],
    )

    # Create and save user
    user = User(
        username=data.get("username"), email=data.get("email"), settings=settings
    )
    user.set_password(data.get("password"))
    user.save()

    return jsonify({"message": "User created successfully"}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.objects(username=data.get("username")).first()

    if user and user.check_password(data.get("password")):
        # Update last login
        user.last_login = datetime.now(UTC)
        user.save()

        # Create access token
        expires = timedelta(days=1)
        access_token = create_access_token(identity=str(user.id), expires_delta=expires)

        # Return both token and basic user info
        return jsonify({"access_token": access_token, "user": user.to_dict()}), 200

    return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user.to_dict()), 200


@auth_bp.route("/google", methods=["POST"])
def google_auth():
    """Handle Google OAuth authentication"""
    data = request.get_json()
    google_token = data.get("token")

    if not google_token:
        return jsonify({"error": "Google token is required"}), 400

    # Verify Google token
    google_info = GoogleOAuthService.verify_google_token(google_token)
    if not google_info:
        return jsonify({"error": "Invalid Google token"}), 401

    # Check if user exists by Google ID
    user = User.find_by_google_id(google_info["google_id"])

    if user:
        # Existing Google user - sign them in
        user.last_login = datetime.now(UTC)
        user.save()

        # Create access token
        expires = timedelta(days=1)
        access_token = create_access_token(identity=str(user.id), expires_delta=expires)

        return (
            jsonify(
                {
                    "access_token": access_token,
                    "user": user.to_dict(),
                    "message": "Login successful",
                }
            ),
            200,
        )

    # Check if user exists by email (account linking scenario)
    existing_user = User.find_by_email(google_info["email"])

    if existing_user:
        # User exists with email but no Google ID - link accounts
        existing_user.set_google_info(
            google_info["google_id"], google_info.get("picture")
        )
        existing_user.email_verified = True
        existing_user.last_login = datetime.now(UTC)
        existing_user.save()

        # Create access token
        expires = timedelta(days=1)
        access_token = create_access_token(
            identity=str(existing_user.id), expires_delta=expires
        )

        return (
            jsonify(
                {
                    "access_token": access_token,
                    "user": existing_user.to_dict(),
                    "message": "Account linked successfully",
                }
            ),
            200,
        )

    # New user - create account
    username = GoogleOAuthService.generate_username_from_google_info(google_info)

    # Get location preferences (you might want to enhance this)
    preferred_units, default_batch_size = (
        GoogleOAuthService.get_user_location_preferences(google_info)
    )

    # Create user settings
    settings = UserSettings(
        preferred_units=preferred_units,
        default_batch_size=default_batch_size,
        timezone="UTC",  # Default, user can change later
    )

    # Create new user
    user = User(username=username, email=google_info["email"], settings=settings)

    # Set Google authentication info
    user.set_google_info(google_info["google_id"], google_info.get("picture"))
    user.save()

    # Create access token
    expires = timedelta(days=1)
    access_token = create_access_token(identity=str(user.id), expires_delta=expires)

    return (
        jsonify(
            {
                "access_token": access_token,
                "user": user.to_dict(),
                "message": "Account created successfully",
            }
        ),
        201,
    )


@auth_bp.route("/link-google", methods=["POST"])
@jwt_required()
def link_google_account():
    """Link Google account to existing local account"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.auth_provider == "google":
        return jsonify({"error": "Account is already a Google account"}), 400

    data = request.get_json()
    google_token = data.get("token")

    if not google_token:
        return jsonify({"error": "Google token is required"}), 400

    # Verify Google token
    google_info = GoogleOAuthService.verify_google_token(google_token)
    if not google_info:
        return jsonify({"error": "Invalid Google token"}), 401

    # Check if Google account is already linked to another user
    existing_google_user = User.find_by_google_id(google_info["google_id"])
    if existing_google_user:
        return (
            jsonify({"error": "Google account is already linked to another user"}),
            409,
        )

    # Check if email matches
    if user.email != google_info["email"]:
        return (
            jsonify({"error": "Google account email must match your current email"}),
            400,
        )

    # Link the accounts
    user.set_google_info(google_info["google_id"], google_info.get("picture"))
    user.save()

    return (
        jsonify(
            {"message": "Google account linked successfully", "user": user.to_dict()}
        ),
        200,
    )


@auth_bp.route("/unlink-google", methods=["POST"])
@jwt_required()
def unlink_google_account():
    """Unlink Google account from user account"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.auth_provider != "google":
        return jsonify({"error": "Account is not linked to Google"}), 400

    if not user.password_hash:
        return (
            jsonify(
                {
                    "error": "Cannot unlink Google account without setting a password first"
                }
            ),
            400,
        )

    # Unlink Google account
    user.google_id = None
    user.auth_provider = "local"
    user.google_profile_picture = None
    user.save()

    return (
        jsonify(
            {"message": "Google account unlinked successfully", "user": user.to_dict()}
        ),
        200,
    )
