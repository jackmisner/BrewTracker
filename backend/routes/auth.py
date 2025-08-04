import re
from datetime import UTC, datetime, timedelta

import requests
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from models.mongo_models import User, UserSettings
from services.email_service import EmailService
from services.google_oauth_service import GoogleOAuthService
from services.username_validation_service import UsernameValidationService

auth_bp = Blueprint("auth", __name__)


def validate_password(password):
    """
    Validate password strength according to security requirements:
    - At least 8 characters
    - At least one lowercase letter
    - At least one uppercase letter
    - At least one number
    - At least one special character from ~!@#$%^&*()_-+={}|:;"'<,>.?/
    """
    if not password:
        return False, "Password is required"

    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"

    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"

    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"

    if not re.search(r'[~!@#$%^&*()_\-+={}|\\:;"\'<,>.?/]', password):
        return (
            False,
            "Password must contain at least one special character (~!@#$%^&*()_-+={}|:;\"'<,>.?/)",
        )

    return True, "Password is valid"


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

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    # Validate username format and check if reserved
    is_valid_username, username_error = UsernameValidationService.validate_username(
        username
    )
    if not is_valid_username:
        return jsonify({"error": username_error}), 400

    # Check if username already exists
    if User.objects(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    # Check if email already exists
    if User.objects(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    # Validate password strength
    is_valid_password, password_error = validate_password(password)
    if not is_valid_password:
        return jsonify({"error": password_error}), 400

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
    user = User(username=username, email=email, settings=settings)
    user.set_password(password)
    user.save()

    # Send verification email
    verification_sent = EmailService.send_verification_email(user)

    response_message = "User created successfully"
    if verification_sent:
        response_message += ". Please check your email to verify your account."
    else:
        response_message += ". Warning: Verification email could not be sent."

    return (
        jsonify(
            {"message": response_message, "verification_email_sent": verification_sent}
        ),
        201,
    )


@auth_bp.route("/validate-username", methods=["POST"])
def validate_username():
    """Validate username for registration"""
    data = request.get_json()
    username = data.get("username", "").strip()

    if not username:
        return jsonify({"valid": False, "error": "Username is required"}), 400

    # Validate username format and check if reserved
    is_valid_username, username_error = UsernameValidationService.validate_username(
        username
    )
    if not is_valid_username:
        suggestions = UsernameValidationService.suggest_alternatives(username)
        return (
            jsonify(
                {"valid": False, "error": username_error, "suggestions": suggestions}
            ),
            200,
        )

    # Check if username already exists
    if User.objects(username=username).first():
        suggestions = UsernameValidationService.suggest_alternatives(username)
        return (
            jsonify(
                {
                    "valid": False,
                    "error": "Username already exists",
                    "suggestions": suggestions,
                }
            ),
            200,
        )

    return jsonify({"valid": True}), 200


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

    # Get user location preferences from IP address (same logic as regular registration)
    ip = get_ip()
    geo = get_geo_info(ip)
    use_metric = geo["country_code"] != "US"

    # Create user settings with IP-based defaults
    settings = UserSettings(
        preferred_units="metric" if use_metric else "imperial",
        default_batch_size=19.0 if use_metric else 5.0,
        timezone=geo["timezone"],
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


@auth_bp.route("/send-verification", methods=["POST"])
@jwt_required()
def send_verification_email():
    """Send email verification to current user"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.email_verified:
        return jsonify({"message": "Email is already verified"}), 200

    # Check rate limiting
    can_send, error_message = EmailService.can_resend_verification(user)
    if not can_send:
        return jsonify({"error": error_message}), 429

    # Send verification email
    success = EmailService.send_verification_email(user)

    if success:
        return jsonify({"message": "Verification email sent successfully"}), 200
    else:
        return jsonify({"error": "Failed to send verification email"}), 500


@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """Verify email using token"""
    try:
        data = request.get_json()
        token = data.get("token")

        if not token:
            return jsonify({"error": "Verification token is required"}), 400

        # Verify the token
        result = EmailService.verify_email_token(token)

        if result["success"]:
            # Auto-login: create JWT token for the verified user
            if "user" in result:
                verified_user = result["user"]

                # Create access token for auto-login
                expires = timedelta(days=1)
                access_token = create_access_token(
                    identity=str(verified_user.id), expires_delta=expires
                )

                return (
                    jsonify(
                        {
                            "message": result["message"],
                            "access_token": access_token,
                            "user": verified_user.to_dict(),
                        }
                    ),
                    200,
                )
            else:
                return jsonify({"message": result["message"]}), 200
        else:
            return jsonify({"error": result["error"]}), 400

    except Exception as e:
        return jsonify({"error": "Internal server error during verification"}), 500


@auth_bp.route("/resend-verification", methods=["POST"])
@jwt_required()
def resend_verification():
    """Resend verification email (with rate limiting)"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.email_verified:
        return jsonify({"message": "Email is already verified"}), 200

    # Check rate limiting
    can_send, error_message = EmailService.can_resend_verification(user)
    if not can_send:
        return jsonify({"error": error_message}), 429

    # Send verification email
    success = EmailService.send_verification_email(user)

    if success:
        return jsonify({"message": "Verification email sent successfully"}), 200
    else:
        return jsonify({"error": "Failed to send verification email"}), 500


@auth_bp.route("/verification-status", methods=["GET"])
@jwt_required()
def get_verification_status():
    """Get current user's email verification status"""
    user_id = get_jwt_identity()
    user = User.objects(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return (
        jsonify(
            {
                "email_verified": user.email_verified,
                "email": user.email,
                "verification_sent_at": (
                    user.email_verification_sent_at.isoformat()
                    if user.email_verification_sent_at
                    else None
                ),
            }
        ),
        200,
    )
