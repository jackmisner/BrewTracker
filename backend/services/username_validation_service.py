"""
Username validation service for BrewTracker.

Provides centralized username validation including reserved username protection
and pattern-based filtering to prevent administrative impersonation and system conflicts.
"""

import re
from typing import List, Tuple


class UsernameValidationService:
    """Service for validating usernames against reserved names and patterns."""

    # Exact reserved usernames (case-insensitive)
    EXACT_RESERVED = {
        # Administrative
        "admin",
        "administrator",
        "moderator",
        "mod",
        "super",
        "superuser",
        "root",
        "sudo",
        "operator",
        "manager",
        # System/Service
        "system",
        "service",
        "daemon",
        "api",
        "www",
        "ftp",
        "mail",
        "smtp",
        "noreply",
        "no-reply",
        "postmaster",
        "webmaster",
        # Application-specific
        "brewtracker",
        "anonymous",
        "deleted",
        "community",
        "public",
        "guest",
        "user",
        "users",
        "account",
        "accounts",
        # Support/Contact
        "support",
        "help",
        "contact",
        "info",
        "about",
        "feedback",
        "abuse",
        "security",
        "legal",
        "privacy",
        "terms",
        # Technical/Confusing
        "null",
        "undefined",
        "none",
        "empty",
        "void",
        "blank",
        "test",
        "demo",
        "example",
        "sample",
        "temp",
        "temporary",
        # Common variations
        "sysadmin",
        "hostmaster",
        "usenet",
        "news",
        "uucp",
    }

    # Pattern-based reserved usernames (case-insensitive regex)
    RESERVED_PATTERNS = [
        r"^admin.*",  # admin, admin123, administrator, etc.
        r".*admin.*",  # sysadmin, webadmin, etc.
        r"^mod.*",  # mod, moderator, etc.
        r".*mod$",  # sysmod, webmod, etc.
        r"^system.*",  # system, sys_user, etc.
        r".*system.*",  # websystem, app_system, etc.
        r"^root.*",  # root, root_user, etc.
        r"^support.*",  # support, support_team, etc.
        r".*support$",  # tech_support, user_support, etc.
        r"^api.*",  # api, api_user, etc.
        r".*api$",  # rest_api, web_api, etc.
        r"^anonymous.*",  # anonymous, anon_user, etc.
        r".*anonymous.*",  # anonymous_user, etc.
        r"^deleted.*",  # deleted, deleted_user, etc.
        r".*deleted.*",  # user_deleted, etc.
        r"^brewtracker.*",  # brewtracker, brewtracker_admin, etc.
        r".*brewtracker.*",  # admin_brewtracker, etc.
    ]

    @classmethod
    def is_username_reserved(cls, username: str) -> Tuple[bool, str]:
        """
        Check if a username is reserved.

        Args:
            username: The username to validate

        Returns:
            Tuple of (is_reserved: bool, reason: str)
        """
        if not username:
            return True, "Username cannot be empty"

        username_lower = username.lower().strip()

        # Check exact reserved names
        if username_lower in cls.EXACT_RESERVED:
            return True, f"Username '{username}' is reserved for system use"

        # Check pattern-based reserved names
        for pattern in cls.RESERVED_PATTERNS:
            if re.match(pattern, username_lower):
                return (
                    True,
                    f"Username '{username}' matches a reserved pattern and cannot be used",
                )

        return False, ""

    @classmethod
    def validate_username_format(cls, username: str) -> Tuple[bool, str]:
        """
        Validate username format requirements.

        Args:
            username: The username to validate

        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        if not username:
            return False, "Username is required"

        username = username.strip()

        # Length requirements
        if len(username) < 3:
            return False, "Username must be at least 3 characters long"

        if len(username) > 30:
            return False, "Username must be no more than 30 characters long"

        # Character requirements
        if not re.match(r"^[a-zA-Z0-9_-]+$", username):
            return (
                False,
                "Username can only contain letters, numbers, underscores, and hyphens",
            )

        # Cannot start or end with special characters
        if username.startswith(("_", "-")) or username.endswith(("_", "-")):
            return False, "Username cannot start or end with underscores or hyphens"

        # Cannot have consecutive special characters
        if "__" in username or "--" in username or "_-" in username or "-_" in username:
            return False, "Username cannot contain consecutive special characters"

        return True, ""

    @classmethod
    def validate_username(cls, username: str) -> Tuple[bool, str]:
        """
        Comprehensive username validation.

        Args:
            username: The username to validate

        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        # First check format
        is_valid_format, format_error = cls.validate_username_format(username)
        if not is_valid_format:
            return False, format_error

        # Then check if reserved
        is_reserved, reservation_error = cls.is_username_reserved(username)
        if is_reserved:
            return False, reservation_error

        return True, ""

    @classmethod
    def suggest_alternatives(cls, username: str, max_suggestions: int = 3) -> List[str]:
        """
        Suggest alternative usernames if the requested one is invalid.

        Args:
            username: The requested username
            max_suggestions: Maximum number of suggestions to return

        Returns:
            List of suggested alternative usernames
        """
        suggestions = []
        base_username = username.lower().strip()

        # Try simple numeric suffixes
        for i in range(1, max_suggestions + 1):
            suggestion = f"{base_username}{i}"
            is_valid, _ = cls.validate_username(suggestion)
            if is_valid:
                suggestions.append(suggestion)

        # Try year suffix if we need more suggestions
        if len(suggestions) < max_suggestions:
            from datetime import datetime

            year = datetime.now().year
            suggestion = f"{base_username}{year}"
            is_valid, _ = cls.validate_username(suggestion)
            if is_valid:
                suggestions.append(suggestion)

        return suggestions[:max_suggestions]
