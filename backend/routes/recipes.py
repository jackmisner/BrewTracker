from collections import deque

from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from mongoengine.errors import NotUniqueError, OperationError, ValidationError
from mongoengine.queryset.visitor import Q
import logging

from models.mongo_models import Recipe, User
from services.mongodb_service import MongoDBService
from utils.recipe_api_calculator import calculate_all_metrics_preview

recipes_bp = Blueprint("recipes", __name__)

logger = logging.getLogger(__name__)


@recipes_bp.route("", methods=["GET"])
@jwt_required()
def get_recipes():
    user_id = get_jwt_identity()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 10))

    # Use unit-aware method
    result = MongoDBService.get_user_recipes_with_units(user_id, page, per_page)

    # Since get_user_recipes_with_units now returns dictionaries directly,
    # we don't need to call to_dict() on them
    recipes = result["items"]

    return (
        jsonify(
            {
                "recipes": recipes,
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


@recipes_bp.route("/defaults", methods=["GET"])
@jwt_required()
def get_recipe_defaults():
    """Get default values for new recipes based on user preferences"""
    user_id = get_jwt_identity()

    try:
        user = User.objects(id=user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        unit_system = user.get_preferred_units()
        default_batch_size = user.get_default_batch_size()

        # Provide unit-appropriate defaults
        defaults = {
            "batch_size": default_batch_size,
            "efficiency": 75.0,
            "boil_time": 60,
            "unit_system": unit_system,
            "suggested_units": {
                "grain": "kg" if unit_system == "metric" else "lb",
                "hop": "g" if unit_system == "metric" else "oz",
                "yeast": "pkg",
                "other": "g" if unit_system == "metric" else "oz",
                "volume": "l" if unit_system == "metric" else "gal",
                "temperature": "c" if unit_system == "metric" else "f",
            },
            "typical_batch_sizes": (
                [
                    {"value": 10, "label": "10 L", "description": "Small batch"},
                    {"value": 19, "label": "19 L", "description": "Standard batch"},
                    {"value": 23, "label": "23 L", "description": "Large batch"},
                    {"value": 38, "label": "38 L", "description": "Very large batch"},
                ]
                if unit_system == "metric"
                else [
                    {"value": 2.5, "label": "2.5 gal", "description": "Small batch"},
                    {"value": 5, "label": "5 gal", "description": "Standard batch"},
                    {"value": 6, "label": "6 gal", "description": "Large batch"},
                    {"value": 10, "label": "10 gal", "description": "Very large batch"},
                ]
            ),
        }

        return jsonify(defaults), 200

    except Exception as e:
        print(f"Error getting recipe defaults: {e}")
        return jsonify({"error": "Failed to get recipe defaults"}), 500


@recipes_bp.route("/<recipe_id>", methods=["GET"])
@jwt_required()
def get_recipe(recipe_id):
    user_id = get_jwt_identity()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    # Use unit-aware method
    recipe_data = MongoDBService.get_recipe_for_user(recipe_id, user_id)

    if not recipe_data:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user has access to this recipe
    recipe = Recipe.objects(id=recipe_id).first()
    if str(recipe.user_id) != user_id and not recipe.is_public:
        return jsonify({"error": "Access denied"}), 403

    # Ensure unit_system is included in the response
    if "unit_system" not in recipe_data:
        recipe_data["unit_system"] = getattr(recipe, "unit_system", "imperial")

    return jsonify(recipe_data), 200


@recipes_bp.route("", methods=["POST"])
@jwt_required()
def create_recipe():
    """Create a new recipe"""
    user_id = get_jwt_identity()
    data = request.get_json()
    data["user_id"] = ObjectId(user_id)
    try:
        # Get user's current unit system preference
        user = User.objects(id=user_id).first()
        user_preferred_units = user.get_preferred_units() if user else "imperial"

        # Use explicit unit system from data if provided, otherwise use user preference
        if "unit_system" not in data:
            data["unit_system"] = user_preferred_units

        # Create recipe with unit system
        recipe = MongoDBService.create_recipe(data, user_id)

        if recipe is None:
            print(
                f"Error: MongoDBService.create_recipe returned None for user {user_id}"
            )
            print(f"Recipe data: {data}")
            return (
                jsonify(
                    {"error": "Failed to create recipe: Database operation failed"}
                ),
                400,
            )

        return (
            jsonify(
                {
                    "message": "Recipe created successfully",
                    "recipe": recipe.to_dict_with_user_context(user_id),
                    "recipe_id": str(recipe.id),
                }
            ),
            201,
        )

    except Exception as e:
        print(f"Exception in create_recipe route: {e}")
        print(f"Recipe data: {data}")
        import traceback

        traceback.print_exc()
        return jsonify({"error": f"Failed to create recipe: {str(e)}"}), 400


@recipes_bp.route("/<recipe_id>", methods=["PUT"])
@jwt_required()
def update_recipe(recipe_id):
    user_id = get_jwt_identity()
    data = request.get_json()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    try:
        # Check if recipe exists and belongs to user
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        if str(recipe.user_id) != user_id:
            return jsonify({"error": "Access denied"}), 403

        # Update recipe
        updated_recipe, message = MongoDBService.update_recipe(recipe_id, data)

        if updated_recipe:
            return jsonify(updated_recipe.to_dict_with_user_context(user_id)), 200
        else:
            return jsonify({"error": message}), 400
    except ValidationError as e:
        logger.warning("Validation error in update_recipe: %s", e)

        # Extract detailed validation error information
        error_details: list[str] = []

        def _flatten(prefix, node):
            if node is None:
                return
            if isinstance(node, (list, tuple)):
                for i, item in enumerate(node):
                    _flatten(f"{prefix}[{i}]" if prefix else f"[{i}]", item)
                return
            if isinstance(node, dict):
                for key, val in node.items():
                    next_prefix = f"{prefix}.{key}" if prefix else str(key)
                    _flatten(next_prefix, val)
                return
            if hasattr(node, "message"):
                error_details.append(f"{prefix}: {node.message}")
            else:
                error_details.append(f"{prefix}: {node}")

        if hasattr(e, "to_dict"):
            _flatten("", e.to_dict() or {})
        elif hasattr(e, "message") and e.message:
            error_details.append(str(e.message))

        # Create a more informative error message
        detailed_error = (
            f"Validation failed: {'; '.join(error_details)}"
            if error_details
            else str(e)
        )

        return (
            jsonify(
                {
                    "error": detailed_error,
                    "validation_details": error_details if error_details else [str(e)],
                }
            ),
            422,
        )
    except NotUniqueError as e:
        logger.warning("Duplicate key in update_recipe: %s", e)
        return jsonify({"error": "Recipe already exists"}), 409
    except OperationError as e:
        logger.warning("Update failed: %s", e)
        return jsonify({"error": "Failed to update recipe"}), 400
    except Exception:
        logger.exception("Unexpected error in update_recipe")
        return jsonify({"error": "Failed to update recipe"}), 500


@recipes_bp.route("/<recipe_id>", methods=["DELETE"])
@jwt_required()
def delete_recipe(recipe_id):
    user_id = get_jwt_identity()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    try:
        # Check if recipe exists and belongs to user
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        if str(recipe.user_id) != user_id:
            return jsonify({"error": "Access denied"}), 403

        # Delete recipe
        recipe.delete()

        return jsonify({"message": "Recipe deleted successfully"}), 200
    except ValidationError as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Invalid recipe ID format"}), 400


@recipes_bp.route("/<recipe_id>/brew-sessions", methods=["GET"])
@jwt_required()
def get_recipe_brew_sessions(recipe_id):
    """Get all brew sessions for a specific recipe"""
    user_id = get_jwt_identity()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    try:
        # First verify the recipe exists and user has access
        recipe = Recipe.objects(id=recipe_id).first()
        if not recipe:
            return jsonify({"error": "Recipe not found"}), 404

        if str(recipe.user_id) != user_id and not recipe.is_public:
            return jsonify({"error": "Access denied"}), 403

        # Get brew sessions for this recipe
        sessions = MongoDBService.get_recipe_brew_sessions(recipe_id)

        # Filter sessions to only include user's own sessions
        user_sessions = [
            session for session in sessions if str(session.user_id) == user_id
        ]

        # Convert to dict format
        sessions_data = [session.to_dict() for session in user_sessions]

        return (
            jsonify({"brew_sessions": sessions_data, "total": len(sessions_data)}),
            200,
        )

    except Exception as e:
        print(f"Error fetching recipe brew sessions: {e}")
        return jsonify({"error": "Failed to fetch brew sessions"}), 500


@recipes_bp.route("/<recipe_id>/metrics", methods=["GET"])
@jwt_required()
def get_recipe_metrics(recipe_id):
    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    # Calculate recipe statistics
    stats = MongoDBService.calculate_recipe_stats(recipe_id)

    # Check if stats is None, empty dict, or has no meaningful data
    if not stats or (isinstance(stats, dict) and not any(stats.values())):
        return jsonify({"message": "No completed brew sessions for this recipe"}), 404
    else:
        return jsonify(stats), 200


@recipes_bp.route("/calculate-metrics-preview", methods=["POST"])
@jwt_required()
def calculate_metrics_preview():
    """Calculate metrics for a recipe that hasn't been saved to the database yet"""
    try:
        data = request.get_json()

        # Validate required fields and types
        if not isinstance(data.get("batch_size"), (int, float)):
            return (
                jsonify(
                    {
                        "error": "Failed to calculate metrics: batch_size must be a number"
                    }
                ),
                400,
            )

        if not isinstance(data.get("ingredients", []), list):
            return (
                jsonify(
                    {"error": "Failed to calculate metrics: ingredients must be a list"}
                ),
                400,
            )

        # Calculate metrics
        metrics = calculate_all_metrics_preview(data)

        # Check if metrics calculation failed (returned None or empty)
        if metrics is None:
            return jsonify({"error": "Failed to calculate metrics"}), 400

        return jsonify(metrics), 200
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return jsonify({"error": f"Failed to calculate metrics: {str(e)}"}), 400


@recipes_bp.route("/<recipe_id>/clone", methods=["POST"])
@jwt_required()
def clone_recipe(recipe_id):
    user_id = get_jwt_identity()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    # Clone the recipe
    cloned_recipe, message = MongoDBService.clone_recipe(recipe_id, user_id)

    if cloned_recipe:
        return jsonify(cloned_recipe.to_dict_with_user_context(user_id)), 201
    else:
        return jsonify({"error": message}), 400


@recipes_bp.route("/<recipe_id>/clone-public", methods=["POST"])
@jwt_required()
def clone_public_recipe(recipe_id):
    user_id = get_jwt_identity()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    # Get original author from request body
    data = request.get_json()
    original_author = data.get("originalAuthor", "Unknown") if data else "Unknown"

    # Clone the public recipe
    cloned_recipe, message = MongoDBService.clone_public_recipe(
        recipe_id, user_id, original_author
    )

    if cloned_recipe:
        return jsonify(cloned_recipe.to_dict_with_user_context(user_id)), 201
    else:
        return jsonify({"error": message}), 400


@recipes_bp.route("/<recipe_id>/versions", methods=["GET"])
@jwt_required()
def get_recipe_versions(recipe_id):
    user_id = get_jwt_identity()

    try:
        # Validate ObjectId format
        ObjectId(recipe_id)
    except (InvalidId, ValueError):
        return jsonify({"error": "Invalid recipe ID format"}), 400

    # Get the recipe
    recipe = Recipe.objects(id=recipe_id).first()
    if not recipe:
        return jsonify({"error": "Recipe not found"}), 404

    # Check if user has access
    if str(recipe.user_id) != user_id and not recipe.is_public:
        return jsonify({"error": "Access denied"}), 403

    # Build complete version history
    version_history = _get_complete_version_history(recipe, user_id)

    return jsonify(version_history), 200


def _get_complete_version_history(current_recipe, viewer_id):
    """Build complete version history for a recipe with proper access controls"""

    is_owner = str(current_recipe.user_id) == viewer_id

    # Find the root recipe (traverse up the parent chain with access checks)
    ancestors = []
    temp_recipe = current_recipe
    while temp_recipe and temp_recipe.parent_recipe_id:
        parent = Recipe.objects(id=temp_recipe.parent_recipe_id).first()
        if parent:
            # Check if viewer has access to this parent
            parent_is_accessible = str(parent.user_id) == viewer_id or parent.is_public
            if parent_is_accessible:
                ancestors.insert(0, parent)  # Insert at beginning to maintain order
                temp_recipe = parent
            else:
                # Stop traversal if viewer lacks access to prevent leaking private ancestors
                break
        else:
            break

    # The root is the first ancestor or the current recipe if no parents
    root_recipe = ancestors[0] if ancestors else current_recipe

    # Get all recipes in this version family (root + all descendants, recursively)
    all_recipes = []
    seen_ids = set()
    frontier = deque([root_recipe])  # Use deque for O(1) pop operations
    while frontier:
        node = frontier.popleft()  # O(1) operation with deque
        node_id_str = str(node.id)
        if node_id_str in seen_ids:
            continue
        seen_ids.add(node_id_str)
        all_recipes.append(node)

        # Build children query with proper access controls
        children_query = Recipe.objects(parent_recipe_id=node.id)

        # If viewer is not the owner of the current recipe being viewed,
        # scope children to current recipe owner and filter by is_public for non-owners
        if not is_owner:
            children_query = children_query.filter(is_public=True)

        # Scope to the current recipe's owner (not root) for proper branch discovery
        children_query = children_query.filter(user_id=current_recipe.user_id)

        children = list(children_query)
        frontier.extend(children)

    # Sort by version (stable tie-break on id to keep ordering deterministic)
    all_recipes.sort(key=lambda r: ((r.version or 1), str(r.id)))

    # Build formatted version list
    all_versions = []
    immediate_parent = None
    root_recipe_info = None

    for i, recipe in enumerate(all_recipes):
        version_info = {
            "recipe_id": str(recipe.id),
            "name": recipe.name,
            "version": recipe.version,
            "unit_system": getattr(recipe, "unit_system", "imperial"),
            "is_current": str(recipe.id) == str(current_recipe.id),
            "is_root": str(recipe.id) == str(root_recipe.id),
            "is_available": True,  # All recipes in family are available
        }
        all_versions.append(version_info)

        # Track root recipe info
        if version_info["is_root"]:
            root_recipe_info = {
                "recipe_id": version_info["recipe_id"],
                "name": version_info["name"],
                "version": version_info["version"],
                "unit_system": version_info["unit_system"],
            }

        # Track immediate parent by parent_recipe_id, not by index
        if version_info["is_current"] and current_recipe.parent_recipe_id:
            # Find parent in all_recipes by matching parent_recipe_id
            for parent_recipe in all_recipes:
                if str(parent_recipe.id) == str(current_recipe.parent_recipe_id):
                    immediate_parent = {
                        "recipe_id": str(parent_recipe.id),
                        "name": parent_recipe.name,
                        "version": parent_recipe.version,
                        "unit_system": getattr(
                            parent_recipe, "unit_system", "imperial"
                        ),
                    }
                    break

    # Handle edge case where current recipe is not found in family
    # (could happen if parent_recipe_id points to root but current isn't in descendants)
    current_found = any(v["is_current"] for v in all_versions)
    if not current_found:
        # Add current recipe to the list
        current_version_info = {
            "recipe_id": str(current_recipe.id),
            "name": current_recipe.name,
            "version": current_recipe.version,
            "unit_system": getattr(current_recipe, "unit_system", "imperial"),
            "is_current": True,
            "is_root": False,
            "is_available": True,
        }
        all_versions.append(current_version_info)

        # Re-sort after adding current recipe using stable sorting
        all_versions.sort(key=lambda v: (v["version"], v["recipe_id"]))

        # Find immediate parent by parent_recipe_id, not by index
        if current_recipe.parent_recipe_id:
            for version in all_versions:
                if version["recipe_id"] == str(current_recipe.parent_recipe_id):
                    immediate_parent = {
                        "recipe_id": version["recipe_id"],
                        "name": version["name"],
                        "version": version["version"],
                        "unit_system": version["unit_system"],
                    }
                    break

    # Get direct children of current recipe (for backward compatibility)
    # Scope to owner's children for owners, public children for non-owners
    child_versions = []
    children_query = Recipe.objects(parent_recipe_id=current_recipe.id)

    # Apply access control for child versions
    if is_owner:
        # Owner sees only their own child recipes
        children_query = children_query.filter(user_id=current_recipe.user_id)
    else:
        # Non-owners see only public child recipes
        children_query = children_query.filter(is_public=True)

    children = children_query
    for child in children:
        child_versions.append(
            {
                "recipe_id": str(child.id),
                "name": child.name,
                "version": child.version,
                "unit_system": getattr(child, "unit_system", "imperial"),
            }
        )

    return {
        "current_version": current_recipe.version,
        "immediate_parent": immediate_parent,
        "root_recipe": root_recipe_info,
        "all_versions": all_versions,
        "total_versions": len(all_versions),
        # Keep these for backward compatibility
        "parent_recipe": root_recipe_info,  # Legacy field
        "child_versions": child_versions,  # Legacy field
    }


@recipes_bp.route("/public", methods=["GET"])
@jwt_required(optional=True)
def get_public_recipes():
    """Get all public recipes from all users"""
    # Get current user ID
    current_user_id = get_jwt_identity()
    page = max(int(request.args.get("page", 1)), 1)  # Ensure page is at least 1
    per_page = max(
        int(request.args.get("per_page", 10)), 1
    )  # Ensure per_page is at least 1
    style_filter = request.args.get("style", None)
    search_query = request.args.get("search", None)
    category_filter = request.args.get("category", None)

    # Build query filters for mongoengine
    filters = {"is_public": True}

    if style_filter:
        # Use mongoengine Q objects for OR conditions
        style_conditions = Q(style__iexact=style_filter) | Q(
            style__icontains=style_filter
        )
        filters.update({"__raw__": style_conditions.to_query(Recipe)})

    if category_filter:
        # Filter by beer category
        style_keywords = get_category_keywords(category_filter)
        if style_keywords:
            filters["style__in"] = style_keywords

    if search_query:
        # Enhanced search in name, description, and style
        search_conditions = (
            Q(name__icontains=search_query)
            | Q(description__icontains=search_query)
            | Q(style__icontains=search_query)
        )

        if "__raw__" in filters:
            # Combine with existing conditions
            existing_query = filters["__raw__"]
            combined_query = {
                "$and": [existing_query, search_conditions.to_query(Recipe)]
            }
            filters["__raw__"] = combined_query
        else:
            filters["__raw__"] = search_conditions.to_query(Recipe)

    # Calculate pagination
    skip = (page - 1) * per_page

    try:
        # Get public recipes
        if "__raw__" in filters:
            raw_query = filters.pop("__raw__")
            recipes = (
                Recipe.objects(__raw__=raw_query, **filters)
                .order_by("-created_at")
                .skip(skip)
                .limit(per_page)
            )
            total = Recipe.objects(__raw__=raw_query, **filters).count()
        else:
            recipes = (
                Recipe.objects(**filters)
                .order_by("-created_at")
                .skip(skip)
                .limit(per_page)
            )
            total = Recipe.objects(**filters).count()

        # Include username and enhanced metadata for each recipe
        recipes_with_metadata = []
        for recipe in recipes:
            raw_viewer_id = get_jwt_identity()
            try:
                viewer_id = ObjectId(raw_viewer_id) if raw_viewer_id else None
            except (InvalidId, TypeError):
                viewer_id = None
            recipe_dict = recipe.to_dict_with_user_context(viewer_id)

            # Get the username
            user = User.objects(id=recipe.user_id).first()
            recipe_dict["username"] = user.username if user else "Unknown"

            # Add style analysis if metrics are available
            if all(
                v is not None
                for v in [
                    recipe.estimated_og,
                    recipe.estimated_abv,
                    recipe.estimated_ibu,
                ]
            ):
                recipe_dict["has_metrics"] = True
                recipe_dict["style_category"] = (
                    classify_beer_style(recipe.style) if recipe.style else None
                )
            else:
                recipe_dict["has_metrics"] = False

            recipes_with_metadata.append(recipe_dict)

        # Calculate pagination metadata
        total_pages = (total + per_page - 1) // per_page

        return (
            jsonify(
                {
                    "recipes": recipes_with_metadata,
                    "pagination": {
                        "page": page,
                        "pages": total_pages,
                        "per_page": per_page,
                        "total": total,
                        "has_next": page < total_pages,
                        "has_prev": page > 1,
                        "next_num": page + 1 if page < total_pages else None,
                        "prev_num": page - 1 if page > 1 else None,
                    },
                }
            ),
            200,
        )
    except Exception as e:
        print(f"Error in get_public_recipes: {e}")
        return jsonify({"error": "Failed to fetch public recipes"}), 500


def classify_beer_style(style_name):
    """Basic beer style classification"""
    if not style_name:
        return None

    style_lower = style_name.lower()

    if any(word in style_lower for word in ["ipa", "pale ale", "amber", "brown ale"]):
        return "ale"
    elif any(word in style_lower for word in ["lager", "pilsner", "märzen", "bock"]):
        return "lager"
    elif any(word in style_lower for word in ["stout", "porter"]):
        return "dark"
    elif any(word in style_lower for word in ["wheat", "weizen", "wit"]):
        return "wheat"
    elif any(word in style_lower for word in ["sour", "lambic", "gose"]):
        return "sour"
    else:
        return "other"


def get_category_keywords(category):
    """Get style keywords for a category"""
    categories = {
        "ale": ["IPA", "Pale Ale", "Amber Ale", "Brown Ale", "ESB", "Barleywine"],
        "lager": ["Pilsner", "Lager", "Märzen", "Bock", "Schwarzbier"],
        "dark": ["Stout", "Porter", "Black IPA"],
        "wheat": ["Wheat Beer", "Weizen", "Witbier", "Hefeweizen"],
        "sour": ["Sour", "Lambic", "Gose", "Berliner Weisse"],
    }

    return categories.get(category.lower(), [])
