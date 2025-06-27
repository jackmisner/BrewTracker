from bson import ObjectId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models.mongo_models import BrewSession, Recipe
from services.mongodb_service import MongoDBService

brew_sessions_bp = Blueprint("brew_sessions", __name__)


@brew_sessions_bp.route("", methods=["GET"])
@jwt_required()
def get_brew_sessions():
    user_id = get_jwt_identity()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))

    result = MongoDBService.get_user_brew_sessions(user_id, page, per_page)

    sessions = [session.to_dict() for session in result["items"]]

    return (
        jsonify(
            {
                "brew_sessions": sessions,
                "pagination": {
                    "page": result["page"],
                    "pages": result["pages"],
                    "per_page": result["per_page"],
                    "total": result["total"],
                    "has_next": result["has_next"],
                    "has_prev": result["has_prev"],
                    "next_num": result["next_num"],
                    "prev_num": result["prev_num"],
                },
            }
        ),
        200,
    )


@brew_sessions_bp.route("/<session_id>", methods=["GET"])
@jwt_required()
def get_brew_session(session_id):
    session = BrewSession.objects(id=session_id).first()

    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    # Check if user has access
    user_id = get_jwt_identity()
    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    return jsonify(session.to_dict()), 200


@brew_sessions_bp.route("", methods=["POST"])
@jwt_required()
def create_brew_session():
    user_id = get_jwt_identity()
    data = request.get_json()

    # Add user_id to the session data
    data["user_id"] = ObjectId(user_id)

    # Create brew session
    session = MongoDBService.create_brew_session(data)

    if session:
        return jsonify(session.to_dict()), 201
    else:
        return jsonify({"error": "Failed to create brew session"}), 400


@brew_sessions_bp.route("/<session_id>", methods=["PUT"])
@jwt_required()
def update_brew_session(session_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check if session exists and belongs to user
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    try:
        # Update session
        updated_session, message = MongoDBService.update_brew_session(session_id, data)

        if updated_session:
            # Try to serialize the session data
            try:
                session_dict = updated_session.to_dict()
                return jsonify(session_dict), 200
            except Exception as serialization_error:
                print(f"Serialization error: {serialization_error}")
                import traceback

                traceback.print_exc()
                return jsonify({"error": "Failed to serialize session data"}), 500
        else:
            return jsonify({"error": message}), 400

    except Exception as e:
        print(f"Update endpoint error: {e}")
        import traceback

        traceback.print_exc()
        return jsonify({"error": "Internal server error during update"}), 500


@brew_sessions_bp.route("/<session_id>", methods=["DELETE"])
@jwt_required()
def delete_brew_session(session_id):
    user_id = get_jwt_identity()

    # Check if session exists and belongs to user
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Delete session
    session.delete()

    return jsonify({"message": "Brew session deleted successfully"}), 200


# Fermentation data endpoints
@brew_sessions_bp.route("/<session_id>/fermentation", methods=["GET"])
@jwt_required()
def get_fermentation_data(session_id):
    user_id = get_jwt_identity()

    # Check access permission
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Get fermentation data
    data, message = MongoDBService.get_fermentation_data(session_id)

    # Always return 200 if session exists and user has access
    # data will be an empty list if no fermentation data exists
    if data is not None:
        return jsonify(data), 200
    else:
        # Only return 404 if there's a real error (like session not found)
        # For other errors, return 500
        if "not found" in message.lower():
            return jsonify({"error": message}), 404
        else:
            return jsonify({"error": message}), 500


@brew_sessions_bp.route("/<session_id>/fermentation", methods=["POST"])
@jwt_required()
def add_fermentation_entry(session_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check access permission
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Add fermentation entry
    success, message = MongoDBService.add_fermentation_entry(session_id, data)

    if success:
        # Get updated fermentation data
        updated_data, _ = MongoDBService.get_fermentation_data(session_id)
        return jsonify(updated_data), 201
    else:
        return jsonify({"error": message}), 400


@brew_sessions_bp.route("/<session_id>/fermentation/<int:entry_index>", methods=["PUT"])
@jwt_required()
def update_fermentation_entry(session_id, entry_index):
    user_id = get_jwt_identity()
    data = request.get_json()

    # Check access permission
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Update fermentation entry
    success, message = MongoDBService.update_fermentation_entry(
        session_id, entry_index, data
    )

    if success:
        # Get updated fermentation data
        updated_data, _ = MongoDBService.get_fermentation_data(session_id)
        return jsonify(updated_data), 200
    else:
        return jsonify({"error": message}), 400


@brew_sessions_bp.route(
    "/<session_id>/fermentation/<int:entry_index>", methods=["DELETE"]
)
@jwt_required()
def delete_fermentation_entry(session_id, entry_index):
    user_id = get_jwt_identity()

    # Check access permission
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Delete fermentation entry
    success, message = MongoDBService.delete_fermentation_entry(session_id, entry_index)

    if success:
        # Get updated fermentation data
        updated_data, _ = MongoDBService.get_fermentation_data(session_id)
        return jsonify(updated_data), 200
    else:
        return jsonify({"error": message}), 400


@brew_sessions_bp.route("/<session_id>/fermentation/stats", methods=["GET"])
@jwt_required()
def get_fermentation_stats(session_id):
    user_id = get_jwt_identity()

    # Check access permission
    session = BrewSession.objects(id=session_id).first()
    if not session:
        return jsonify({"error": "Brew session not found"}), 404

    if str(session.user_id) != user_id:
        return jsonify({"error": "Access denied"}), 403

    # Get fermentation statistics
    stats, message = MongoDBService.get_fermentation_stats(session_id)

    if stats is not None:
        return jsonify(stats), 200
    else:
        return jsonify({"error": message}), 404
