"""
User deletion service for BrewTracker.

Provides comprehensive user account deletion with options for preserving
public contributions to the community while ensuring complete removal of private data.
"""

from datetime import UTC, datetime
from typing import Dict, List, Optional

from bson import ObjectId

from models.mongo_models import BrewSession, Recipe, User


class UserDeletionService:
    """Service for handling comprehensive user account deletion."""

    @classmethod
    def get_user_data_summary(cls, user_id: str) -> Dict:
        """
        Get a summary of data associated with a user account.

        Args:
            user_id: The ID of the user to analyze

        Returns:
            Dictionary containing data summary
        """
        try:
            user_object_id = ObjectId(user_id)
        except Exception:
            return {"error": "Invalid user ID"}

        # Count recipes
        public_recipes = Recipe.objects(user_id=user_object_id, is_public=True).count()
        private_recipes = Recipe.objects(
            user_id=user_object_id, is_public=False
        ).count()

        # Count brew sessions
        brew_sessions = BrewSession.objects(user_id=user_object_id).count()

        return {
            "public_recipes": public_recipes,
            "private_recipes": private_recipes,
            "brew_sessions": brew_sessions,
            "total_recipes": public_recipes + private_recipes,
        }

    @classmethod
    def delete_user_data(
        cls, user_id: str, preserve_public_recipes: bool = True
    ) -> Dict:
        """
        Delete user data with option to preserve public contributions.

        Args:
            user_id: The ID of the user to delete
            preserve_public_recipes: If True, transfer public recipes to Anonymous User

        Returns:
            Dictionary containing deletion results
        """
        try:
            user_object_id = ObjectId(user_id)
        except Exception:
            return {"error": "Invalid user ID", "success": False}

        # Get user to validate existence
        user = User.objects(id=user_object_id).first()
        if not user:
            return {"error": "User not found", "success": False}

        # Prevent deletion of system users (identified by @brewtracker.system email)
        if user.email and user.email.endswith("@brewtracker.system"):
            return {"error": "Cannot delete system users", "success": False}

        # Get data summary before deletion
        data_summary = cls.get_user_data_summary(user_id)
        if "error" in data_summary:
            return data_summary

        try:
            deletion_results = {
                "success": True,
                "user_id": user_id,
                "username": user.username,
                "preserve_public_recipes": preserve_public_recipes,
                "data_summary": data_summary,
                "actions_taken": [],
            }

            # Handle public recipes based on user choice
            if preserve_public_recipes and data_summary["public_recipes"] > 0:
                anonymous_user = User.objects(username="Anonymous User").first()
                if not anonymous_user:
                    return {
                        "error": "Anonymous User system account not found. Cannot preserve public recipes.",
                        "success": False,
                    }

                # Transfer public recipes to Anonymous User
                public_recipes_updated = Recipe.objects(
                    user_id=user_object_id, is_public=True
                ).update(
                    set__user_id=anonymous_user.id, set__updated_at=datetime.now(UTC)
                )

                deletion_results["actions_taken"].append(
                    f"Transferred {public_recipes_updated} public recipes to Anonymous User"
                )
            else:
                # Delete all public recipes
                public_recipes_deleted = Recipe.objects(
                    user_id=user_object_id, is_public=True
                ).count()

                Recipe.objects(user_id=user_object_id, is_public=True).delete()

                if public_recipes_deleted > 0:
                    deletion_results["actions_taken"].append(
                        f"Deleted {public_recipes_deleted} public recipes"
                    )

            # Delete all private recipes
            private_recipes_deleted = Recipe.objects(
                user_id=user_object_id, is_public=False
            ).count()

            Recipe.objects(user_id=user_object_id, is_public=False).delete()

            if private_recipes_deleted > 0:
                deletion_results["actions_taken"].append(
                    f"Deleted {private_recipes_deleted} private recipes"
                )

            # Delete all brew sessions
            brew_sessions_deleted = BrewSession.objects(user_id=user_object_id).count()
            BrewSession.objects(user_id=user_object_id).delete()

            if brew_sessions_deleted > 0:
                deletion_results["actions_taken"].append(
                    f"Deleted {brew_sessions_deleted} brew sessions"
                )

            # Delete user account
            user.delete()
            deletion_results["actions_taken"].append("Deleted user account")

            # Log the deletion for audit purposes
            print(
                f"[UserDeletion] Successfully deleted user {user.username} (ID: {user_id})"
            )
            print(
                f"[UserDeletion] Actions: {', '.join(deletion_results['actions_taken'])}"
            )

            return deletion_results

        except Exception as e:
            error_msg = f"Failed to delete user data: {str(e)}"
            print(f"[UserDeletion] ERROR: {error_msg}")
            return {"error": error_msg, "success": False}

    @classmethod
    def export_user_data(cls, user_id: str) -> Optional[Dict]:
        """
        Export user data for backup before deletion.

        Args:
            user_id: The ID of the user to export

        Returns:
            Dictionary containing user data or None if error
        """
        try:
            user_object_id = ObjectId(user_id)
        except Exception:
            return None

        user = User.objects(id=user_object_id).first()
        if not user:
            return None

        try:
            # Get user data
            user_data = {
                "export_timestamp": datetime.now(UTC).isoformat(),
                "user": {
                    "username": user.username,
                    "email": user.email,
                    "created_at": (
                        user.created_at.isoformat() if user.created_at else None
                    ),
                    "settings": {
                        "preferred_units": (
                            user.settings.preferred_units
                            if user.settings
                            else "imperial"
                        ),
                        "default_batch_size": (
                            user.settings.default_batch_size if user.settings else 5.0
                        ),
                        "timezone": user.settings.timezone if user.settings else "UTC",
                    },
                },
                "recipes": [],
                "brew_sessions": [],
            }

            # Export recipes
            recipes = Recipe.objects(user_id=user_object_id)
            for recipe in recipes:
                recipe_data = {
                    "name": recipe.name,
                    "style": recipe.style,
                    "batch_size": recipe.batch_size,
                    "batch_size_unit": recipe.batch_size_unit,
                    "is_public": recipe.is_public,
                    "created_at": (
                        recipe.created_at.isoformat() if recipe.created_at else None
                    ),
                    "description": recipe.description,
                    "notes": recipe.notes,
                    "estimated_og": recipe.estimated_og,
                    "estimated_fg": recipe.estimated_fg,
                    "estimated_abv": recipe.estimated_abv,
                    "estimated_ibu": recipe.estimated_ibu,
                    "estimated_srm": recipe.estimated_srm,
                }
                user_data["recipes"].append(recipe_data)

            # Export brew sessions
            brew_sessions = BrewSession.objects(user_id=user_object_id)
            for session in brew_sessions:
                session_data = {
                    "name": session.name,
                    "status": session.status,
                    "brew_date": (
                        session.brew_date.isoformat() if session.brew_date else None
                    ),
                    "actual_og": session.actual_og,
                    "actual_fg": session.actual_fg,
                    "actual_abv": session.actual_abv,
                    "notes": session.notes,
                }
                user_data["brew_sessions"].append(session_data)

            return user_data

        except Exception as e:
            print(f"[UserDeletion] Failed to export user data: {e}")
            return None

    @classmethod
    def validate_deletion_preconditions(cls, user_id: str) -> Dict:
        """
        Validate that user deletion can proceed safely.

        Args:
            user_id: The ID of the user to validate

        Returns:
            Dictionary containing validation results
        """
        try:
            user_object_id = ObjectId(user_id)
        except Exception:
            return {"valid": False, "error": "Invalid user ID"}

        user = User.objects(id=user_object_id).first()
        if not user:
            return {"valid": False, "error": "User not found"}

        # Check if user is a system user (identified by @brewtracker.system email)
        if user.email and user.email.endswith("@brewtracker.system"):
            return {"valid": False, "error": "Cannot delete system users"}

        # Check system integrity (Anonymous User exists for public recipe preservation)
        anonymous_user = User.objects(username="Anonymous User").first()
        if not anonymous_user:
            return {
                "valid": False,
                "error": "Anonymous User system account missing. Public recipe preservation unavailable.",
            }

        return {"valid": True}

    @classmethod
    def get_deletion_impact_preview(
        cls, user_id: str, preserve_public_recipes: bool = True
    ) -> Dict:
        """
        Preview the impact of user deletion without performing it.

        Args:
            user_id: The ID of the user
            preserve_public_recipes: Whether public recipes would be preserved

        Returns:
            Dictionary describing what would happen
        """
        validation = cls.validate_deletion_preconditions(user_id)
        if not validation["valid"]:
            return validation

        data_summary = cls.get_user_data_summary(user_id)
        if "error" in data_summary:
            return data_summary

        preview = {
            "valid": True,
            "data_summary": data_summary,
            "preserve_public_recipes": preserve_public_recipes,
            "impact": [],
        }

        if preserve_public_recipes:
            if data_summary["public_recipes"] > 0:
                preview["impact"].append(
                    f"{data_summary['public_recipes']} public recipes will be transferred to Anonymous User"
                )
        else:
            if data_summary["public_recipes"] > 0:
                preview["impact"].append(
                    f"{data_summary['public_recipes']} public recipes will be PERMANENTLY DELETED"
                )

        if data_summary["private_recipes"] > 0:
            preview["impact"].append(
                f"{data_summary['private_recipes']} private recipes will be permanently deleted"
            )

        if data_summary["brew_sessions"] > 0:
            preview["impact"].append(
                f"{data_summary['brew_sessions']} brew sessions will be permanently deleted"
            )

        preview["impact"].append("User account will be permanently deleted")

        return preview
