from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from models import db
from models.user import User
from datetime import datetime

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    # Check if required fields are present
    if not all(k in data for k in ("username", "email", "password")):
        return jsonify({"error": "Missing required fields"}), 400

    # Check if user already exists
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already exists"}), 409

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 409

    # Create new user
    new_user = User(username=data["username"], email=data["email"])
    new_user.set_password(data["password"])

    db.session.add(new_user)
    db.session.commit()

    return (
        jsonify(
            {"message": "User registered successfully", "user": new_user.to_dict()}
        ),
        201,
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    # Check if required fields are present
    if not all(k in data for k in ("username", "password")):
        return jsonify({"error": "Missing username or password"}), 400

    # Find user
    user = User.query.filter_by(username=data["username"]).first()

    # Verify user and password
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid username or password"}), 401

    # Update last login time
    user.last_login = datetime.utcnow()
    db.session.commit()

    # Generate access token
    access_token = create_access_token(identity=user.user_id)

    return (
        jsonify(
            {
                "message": "Login successful",
                "access_token": access_token,
                "user": user.to_dict(),
            }
        ),
        200,
    )


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"user": user.to_dict()}), 200
