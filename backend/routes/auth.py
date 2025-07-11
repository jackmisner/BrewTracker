from datetime import UTC, datetime, timedelta

import requests
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from models.mongo_models import User, UserSettings

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
