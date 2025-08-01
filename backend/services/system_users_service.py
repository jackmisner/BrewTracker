"""
System users bootstrap service for BrewTracker.

Manages creation and maintenance of special system accounts used for
application functionality like anonymous recipe attribution and automated processes.
"""

import secrets
import string
from datetime import UTC, datetime
from typing import Dict, Optional

from models.mongo_models import User, UserSettings


class SystemUsersService:
    """Service for managing system user accounts."""

    # System user definitions
    SYSTEM_USERS = {
        "anonymous": {
            "username": "Anonymous User",
            "email": "anonymous@brewtracker.system",
            "description": "System account for anonymous recipe attribution when users delete their accounts",
            "settings": {
                "preferred_units": "imperial",
                "default_batch_size": 5.0,
                "timezone": "UTC",
                "contribute_anonymous_data": False,
                "share_yeast_performance": False,
                "share_recipe_metrics": False,
                "public_recipes_default": False,
            },
        },
        "brewtracker_system": {
            "username": "BrewTracker System",
            "email": "system@brewtracker.system",
            "description": "System account for automated processes and system-generated content",
            "settings": {
                "preferred_units": "imperial",
                "default_batch_size": 5.0,
                "timezone": "UTC",
                "contribute_anonymous_data": False,
                "share_yeast_performance": False,
                "share_recipe_metrics": False,
                "public_recipes_default": False,
            },
        },
        "community": {
            "username": "Community",
            "email": "community@brewtracker.system",
            "description": "System account for community-contributed recipes and shared content",
            "settings": {
                "preferred_units": "imperial",
                "default_batch_size": 5.0,
                "timezone": "UTC",
                "contribute_anonymous_data": True,
                "share_yeast_performance": True,
                "share_recipe_metrics": True,
                "public_recipes_default": True,
            },
        },
    }

    @classmethod
    def _generate_secure_password(cls, length: int = 32) -> str:
        """Generate a cryptographically secure random password."""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return "".join(secrets.choice(alphabet) for _ in range(length))

    @classmethod
    def _create_system_user(cls, user_key: str, user_config: Dict) -> Optional[User]:
        """
        Create a single system user.

        Args:
            user_key: The key identifying the system user
            user_config: The configuration dictionary for the user

        Returns:
            Created User instance or None if creation failed
        """
        try:
            # Check if user already exists
            existing_user = User.objects(username=user_config["username"]).first()
            if existing_user:
                print(
                    f"[SystemUsers] System user '{user_config['username']}' already exists"
                )
                return existing_user

            # Create user settings
            settings_config = user_config["settings"]
            settings = UserSettings(
                contribute_anonymous_data=settings_config.get(
                    "contribute_anonymous_data", False
                ),
                share_yeast_performance=settings_config.get(
                    "share_yeast_performance", False
                ),
                share_recipe_metrics=settings_config.get("share_recipe_metrics", False),
                public_recipes_default=settings_config.get(
                    "public_recipes_default", False
                ),
                default_batch_size=settings_config.get("default_batch_size", 5.0),
                preferred_units=settings_config.get("preferred_units", "imperial"),
                timezone=settings_config.get("timezone", "UTC"),
            )

            # Create system user with secure random password
            user = User(
                username=user_config["username"],
                email=user_config["email"],
                settings=settings,
                is_active=True,
                created_at=datetime.now(UTC),
            )

            # Set secure password (system users should never login normally)
            secure_password = cls._generate_secure_password()
            user.set_password(secure_password)

            # Add system user flag (we'll need to add this field to the User model)
            # For now, we'll use a special note in the created_at field or description

            user.save()
            print(f"[SystemUsers] Created system user: {user_config['username']}")
            return user

        except Exception as e:
            print(
                f"[SystemUsers] Failed to create system user '{user_config['username']}': {e}"
            )
            return None

    @classmethod
    def bootstrap_system_users(cls) -> Dict[str, Optional[User]]:
        """
        Create all system users if they don't exist.

        Returns:
            Dictionary mapping user keys to User instances (or None if creation failed)
        """
        print("[SystemUsers] Starting system users bootstrap...")

        created_users = {}

        for user_key, user_config in cls.SYSTEM_USERS.items():
            user = cls._create_system_user(user_key, user_config)
            created_users[user_key] = user

        success_count = sum(1 for user in created_users.values() if user is not None)
        total_count = len(cls.SYSTEM_USERS)

        print(
            f"[SystemUsers] Bootstrap complete: {success_count}/{total_count} system users ready"
        )
        return created_users

    @classmethod
    def get_system_user(cls, user_key: str) -> Optional[User]:
        """
        Get a system user by key.

        Args:
            user_key: The key identifying the system user ('anonymous', 'brewtracker_system', 'community')

        Returns:
            User instance or None if not found
        """
        if user_key not in cls.SYSTEM_USERS:
            return None

        user_config = cls.SYSTEM_USERS[user_key]
        return User.objects(username=user_config["username"]).first()

    @classmethod
    def get_anonymous_user(cls) -> Optional[User]:
        """Get the Anonymous User system account."""
        return cls.get_system_user("anonymous")

    @classmethod
    def get_community_user(cls) -> Optional[User]:
        """Get the Community system account."""
        return cls.get_system_user("community")

    @classmethod
    def get_brewtracker_system_user(cls) -> Optional[User]:
        """Get the BrewTracker System account."""
        return cls.get_system_user("brewtracker_system")

    @classmethod
    def is_system_user(cls, user: User) -> bool:
        """
        Check if a user is a system user.

        Args:
            user: User instance to check

        Returns:
            True if the user is a system user
        """
        if not user:
            return False

        system_usernames = {config["username"] for config in cls.SYSTEM_USERS.values()}
        return user.username in system_usernames

    @classmethod
    def is_system_username(cls, username: str) -> bool:
        """
        Check if a username belongs to a system user.

        Args:
            username: Username to check

        Returns:
            True if the username is a system user
        """
        if not username:
            return False

        system_usernames = {config["username"] for config in cls.SYSTEM_USERS.values()}
        return username in system_usernames

    @classmethod
    def validate_system_user_integrity(cls) -> Dict[str, bool]:
        """
        Validate that all system users exist and are properly configured.

        Returns:
            Dictionary mapping user keys to existence status
        """
        integrity_status = {}

        for user_key, user_config in cls.SYSTEM_USERS.items():
            user = User.objects(username=user_config["username"]).first()
            integrity_status[user_key] = user is not None

            if user is None:
                print(
                    f"[SystemUsers] WARNING: System user '{user_config['username']}' is missing!"
                )

        return integrity_status
