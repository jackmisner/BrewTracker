from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime, timedelta, UTC
from models.mongo_models import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    # Check if user exists
    if User.objects(username=data.get("username")).first():
        return jsonify({"error": "Username already exists"}), 400

    if User.objects(email=data.get("email")).first():
        return jsonify({"error": "Email already exists"}), 400

    # Create new user
    user = User(username=data.get("username"), email=data.get("email"))
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
