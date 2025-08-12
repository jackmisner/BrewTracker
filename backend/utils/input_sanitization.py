"""
Input sanitization utilities for BrewTracker API.

Provides comprehensive sanitization for different types of user input.
"""

import html
import re
from typing import Any, Dict, List, Optional, Union

from markupsafe import escape


class InputSanitizer:
    """Comprehensive input sanitization utility."""

    # Regex patterns for validation
    EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
    USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{3,30}$")
    SAFE_STRING_PATTERN = re.compile(r"^[a-zA-Z0-9\s\-_.,!?()]+$")

    # Dangerous characters and patterns
    DANGEROUS_CHARS = ["<", ">", '"', "'", "&", "\x00", "\r", "\n"]
    # Note: SQL injection patterns removed - BrewTracker uses MongoDB with safe query methods

    @classmethod
    def sanitize_string(
        cls,
        value: Any,
        max_length: int = 1000,
        allow_empty: bool = True,
        remove_html: bool = True,
        strict: bool = False,
    ) -> Optional[str]:
        """
        Sanitize string input comprehensively.

        Args:
            value: Input value to sanitize
            max_length: Maximum allowed length
            allow_empty: Whether to allow empty strings
            remove_html: Whether to remove/escape HTML
            strict: Whether to apply strict character filtering

        Returns:
            Sanitized string or None
        """
        if value is None:
            return "" if allow_empty else None

        # Convert to string
        if not isinstance(value, str):
            value = str(value)

        # Remove null bytes and control characters
        value = "".join(
            char for char in value if ord(char) >= 32 or char in ["\t", "\n"]
        )

        # HTML handling - remove tags first, then escape
        if remove_html:
            # First remove HTML tags from raw markup
            value = re.sub(r"<[^>]*>", "", value)
            # Then escape remaining HTML entities
            value = html.escape(value)

        # Remove dangerous characters
        for char in cls.DANGEROUS_CHARS:
            value = value.replace(char, "")

        # Strict character filtering
        if strict and not cls.SAFE_STRING_PATTERN.match(value.replace(" ", "")):
            # Keep only safe characters
            value = re.sub(r"[^a-zA-Z0-9\s\-_.,!?()]", "", value)

        # Limit length and strip whitespace
        sanitized = value[:max_length].strip()

        # Normalize whitespace
        sanitized = re.sub(r"\s+", " ", sanitized)

        if not sanitized and not allow_empty:
            return None

        return sanitized

    @classmethod
    def sanitize_email(cls, email: str) -> Optional[str]:
        """
        Sanitize and validate email address.

        Args:
            email: Email address to sanitize

        Returns:
            Sanitized email or None if invalid
        """
        if not email or not isinstance(email, str):
            return None

        # Basic sanitization
        email = email.strip().lower()

        # Remove dangerous characters
        for char in cls.DANGEROUS_CHARS:
            if char in email:
                return None

        # Validate format
        if not cls.EMAIL_PATTERN.match(email):
            return None

        # Length check
        if len(email) > 254:  # RFC standard
            return None

        return email

    @classmethod
    def sanitize_username(cls, username: str) -> Optional[str]:
        """
        Sanitize and validate username.

        Args:
            username: Username to sanitize

        Returns:
            Sanitized username or None if invalid
        """
        if not username or not isinstance(username, str):
            return None

        # Basic sanitization
        username = username.strip()

        # Validate pattern
        if not cls.USERNAME_PATTERN.match(username):
            return None

        return username

    @classmethod
    def sanitize_recipe_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize recipe data comprehensively.

        Args:
            data: Recipe data dictionary

        Returns:
            Sanitized recipe data
        """
        sanitized = {}

        # Recipe name
        if "name" in data:
            sanitized["name"] = cls.sanitize_string(
                data["name"], max_length=100, allow_empty=False
            )

        # Description
        if "description" in data:
            sanitized["description"] = cls.sanitize_string(
                data["description"], max_length=2000
            )

        # Style
        if "style" in data:
            sanitized["style"] = cls.sanitize_string(data["style"], max_length=100)

        # Numeric fields (ensure they're valid numbers)
        numeric_fields = [
            "batch_size",
            "boil_time",
            "efficiency",
            "mash_temp",
            "mash_time",
        ]
        for field in numeric_fields:
            if field in data:
                try:
                    value = float(data[field])
                    # Reasonable bounds checking
                    if field == "batch_size" and (value < 0.1 or value > 1000):
                        continue
                    if field == "boil_time" and (value < 0 or value > 600):
                        continue
                    if field == "efficiency" and (value < 0 or value > 100):
                        continue
                    sanitized[field] = value
                except (ValueError, TypeError):
                    continue

        # Boolean fields
        boolean_fields = ["is_public", "is_extract"]
        for field in boolean_fields:
            if field in data:
                sanitized[field] = bool(data[field])

        # Lists (like tags)
        if "tags" in data and isinstance(data["tags"], list):
            sanitized_tags = []
            for tag in data["tags"][:10]:  # Limit to 10 tags
                sanitized_tag = cls.sanitize_string(
                    str(tag), max_length=50, allow_empty=False, strict=True
                )
                if sanitized_tag:
                    sanitized_tags.append(sanitized_tag)
            sanitized["tags"] = sanitized_tags

        return sanitized

    @classmethod
    def sanitize_search_query(cls, query: str) -> Optional[str]:
        """
        Sanitize search query to prevent injection attacks.

        Args:
            query: Search query string

        Returns:
            Sanitized query or None
        """
        if not query or not isinstance(query, str):
            return None

        # Basic sanitization
        query = query.strip()

        # Length check
        if len(query) > 200:
            query = query[:200]

        # Note: SQL injection prevention should be handled via parameterized queries/ORM
        # at the database layer, not through input keyword filtering

        # Remove dangerous characters
        for char in cls.DANGEROUS_CHARS:
            query = query.replace(char, "")

        # Remove excessive whitespace
        query = re.sub(r"\s+", " ", query).strip()

        if not query or len(query) < 2:
            return None

        return query

    # Note: SQL injection checking via keyword matching has been removed as it is
    # ineffective and causes false positives. Use parameterized queries/ORM APIs
    # to prevent SQL injection at the database layer.

    @classmethod
    def sanitize_pagination_params(
        cls, page: Any = None, per_page: Any = None
    ) -> tuple:
        """
        Sanitize pagination parameters.

        Args:
            page: Page number
            per_page: Items per page

        Returns:
            Tuple of (page, per_page)
        """
        try:
            page = max(1, min(10000, int(page or 1)))  # Cap at reasonable max
        except (ValueError, TypeError):
            page = 1

        try:
            per_page = min(100, max(1, int(per_page or 10)))  # Cap at 100 items
        except (ValueError, TypeError):
            per_page = 10

        return page, per_page
