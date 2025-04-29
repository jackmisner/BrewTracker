from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.brew_session import BrewSession
from models.recipe import Recipe

brew_sessions_bp = Blueprint("brew_sessions", __name__)


@brew_sessions_bp.route("", methods=["GET"])
@jwt_required()
def get_brew_sessions():
    current_user_id = get_jwt_identity()

    # Get all brew sessions for the current user
    brew_sessions = BrewSession.query.filter_by(user_id=current_user_id).all()

    return (
        jsonify({"brew_sessions": [session.to_dict() for session in brew_sessions]}),
        200,
    )


@brew_sessions_bp.route("/<int:session_id>", methods=["GET"])
@jwt_required()
def get_brew_session(session_id):
    current_user_id = get_jwt_identity()

    # Get specific brew session
    brew_session = BrewSession.query.filter_by(session_id=session_id).first()

    if not brew_session:
        return jsonify({"error": "Brew session not found"}), 404

    # Check if user owns the brew session
    if brew_session.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    return jsonify({"brew_session": brew_session.to_dict()}), 200


@brew_sessions_bp.route("", methods=["POST"])
@jwt_required()
def create_brew_session():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    if "recipe_id" not in data:
        return jsonify({"error": "Recipe ID is required"}), 400

    # Check if recipe exists and user has access
    recipe = Recipe.query.filter_by(recipe_id=data["recipe_id"]).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    if recipe.user_id != current_user_id and not recipe.is_public:
        return jsonify({"error": "Unauthorized access to recipe"}), 403

    # Create new brew session
    new_session = BrewSession(
        recipe_id=data["recipe_id"],
        user_id=current_user_id,
        brew_date=data.get("brew_date"),
        name=data.get("name"),
        status=data.get("status", "planned"),
        mash_temp=data.get("mash_temp"),
        actual_og=data.get("actual_og"),
        actual_fg=data.get("actual_fg"),
        actual_abv=data.get("actual_abv"),
        actual_efficiency=data.get("actual_efficiency"),
        fermentation_start_date=data.get("fermentation_start_date"),
        fermentation_end_date=data.get("fermentation_end_date"),
        packaging_date=data.get("packaging_date"),
        tasting_notes=data.get("tasting_notes"),
        batch_rating=data.get("batch_rating"),
        photos_url=data.get("photos_url"),
    )

    db.session.add(new_session)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Brew session created successfully",
                "brew_session": new_session.to_dict(),
            }
        ),
        201,
    )


@brew_sessions_bp.route("/<int:session_id>", methods=["PUT"])
@jwt_required()
def update_brew_session(session_id):
    current_user_id = get_jwt_identity()
    data = request.get_json()

    # Find brew session
    brew_session = BrewSession.query.filter_by(session_id=session_id).first()

    if not brew_session:
        return jsonify({"error": "Brew session not found"}), 404

    # Check if user owns the brew session
    if brew_session.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    # Update brew session fields
    for key, value in data.items():
        if hasattr(brew_session, key):
            setattr(brew_session, key, value)

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Brew session updated successfully",
                "brew_session": brew_session.to_dict(),
            }
        ),
        200,
    )


@brew_sessions_bp.route("/<int:session_id>", methods=["DELETE"])
@jwt_required()
def delete_brew_session(session_id):
    current_user_id = get_jwt_identity()

    # Find brew session
    brew_session = BrewSession.query.filter_by(session_id=session_id).first()

    if not brew_session:
        return jsonify({"error": "Brew session not found"}), 404

    # Check if user owns the brew session
    if brew_session.user_id != current_user_id:
        return jsonify({"error": "Unauthorized access"}), 403

    db.session.delete(brew_session)
    db.session.commit()

    return jsonify({"message": "Brew session deleted successfully"}), 200
