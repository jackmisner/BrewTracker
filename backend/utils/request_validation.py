"""
Request validation utilities for secure API endpoint handling.

Provides decorators and utilities for validating incoming requests.
"""

import json
from functools import wraps
from typing import Any, Dict, Optional

from flask import jsonify, request
from marshmallow import Schema, ValidationError

from utils.input_sanitization import InputSanitizer


def validate_json_request(
    max_size_mb: float = 1.0, required_fields: Optional[list] = None
):
    """
    Decorator to validate JSON requests with size limits and field requirements.

    Args:
        max_size_mb: Maximum request size in megabytes
        required_fields: List of required fields in JSON payload
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check content length
            max_size_bytes = int(max_size_mb * 1024 * 1024)
            if request.content_length and request.content_length > max_size_bytes:
                return (
                    jsonify(
                        {"error": f"Request too large. Maximum size: {max_size_mb}MB"}
                    ),
                    413,
                )

            # Check content type
            if not request.is_json:
                return jsonify({"error": "Content-Type must be application/json"}), 400

            # Validate JSON structure
            try:
                data = request.get_json(force=True)
                if not isinstance(data, dict):
                    return (
                        jsonify({"error": "Invalid JSON format. Expected object."}),
                        400,
                    )
            except Exception as e:
                return jsonify({"error": "Invalid JSON format"}), 400

            # Check required fields
            if required_fields:
                missing_fields = [
                    field for field in required_fields if field not in data
                ]
                if missing_fields:
                    return (
                        jsonify(
                            {
                                "error": f"Missing required fields: {', '.join(missing_fields)}"
                            }
                        ),
                        400,
                    )

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def validate_with_schema(schema_class: Schema):
    """
    Decorator to validate request data against a Marshmallow schema.

    Args:
        schema_class: Marshmallow schema class for validation
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                schema = schema_class()
                data = request.get_json()

                # Validate and deserialize data
                validated_data = schema.load(data)

                # Add validated data to request context
                request.validated_data = validated_data

                return f(*args, **kwargs)

            except ValidationError as e:
                return (
                    jsonify({"error": "Validation failed", "details": e.messages}),
                    400,
                )
            except Exception as e:
                return jsonify({"error": "Request validation error"}), 400

        return decorated_function

    return decorator


def sanitize_string_input(
    value: Any, max_length: int = 1000, allow_empty: bool = True
) -> str:
    """
    Sanitize string input using the centralized InputSanitizer.
    
    Args:
        value: Input value to sanitize
        max_length: Maximum allowed length
        allow_empty: Whether to allow empty strings

    Returns:
        Sanitized string
    """
    result = InputSanitizer.sanitize_string(
        value=value, 
        max_length=max_length, 
        allow_empty=allow_empty
    )
    # Match expected return types - return empty string instead of None when allow_empty=True
    if result is None and allow_empty:
        return ""
    return result


def validate_mongodb_objectid(object_id: str) -> bool:
    """
    Validate MongoDB ObjectId format.

    Args:
        object_id: String to validate

    Returns:
        True if valid ObjectId format
    """
    import re

    if not isinstance(object_id, str):
        return False

    # ObjectId is 24 character hex string
    return bool(re.match(r"^[0-9a-fA-F]{24}$", object_id))


def validate_pagination_params(page: Any = None, per_page: Any = None) -> tuple:
    """
    Validate and sanitize pagination parameters using centralized InputSanitizer.

    Args:
        page: Page number
        per_page: Items per page

    Returns:
        Tuple of (validated_page, validated_per_page)
    """
    return InputSanitizer.sanitize_pagination_params(page=page, per_page=per_page)


class RequestSizeValidator:
    """Utility class for validating request sizes."""

    @staticmethod
    def check_json_size(max_mb: float = 1.0):
        """Check if JSON request size is within limits."""
        if request.content_length:
            max_bytes = int(max_mb * 1024 * 1024)
            if request.content_length > max_bytes:
                return False, f"Request too large (max {max_mb}MB)"
        return True, None

    @staticmethod
    def check_file_size(file, max_mb: float = 10.0):
        """Check if uploaded file size is within limits."""
        file.seek(0, 2)  # Seek to end
        size = file.tell()
        file.seek(0)  # Reset position

        max_bytes = int(max_mb * 1024 * 1024)
        if size > max_bytes:
            return False, f"File too large (max {max_mb}MB)"
        return True, None
