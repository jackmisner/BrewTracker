"""
Centralized error handling for BrewTracker API.

Provides consistent error responses and logging without information disclosure.
"""

import logging
import traceback
from functools import wraps

from flask import Flask, jsonify, request, has_request_context
from flask_jwt_extended.exceptions import JWTExtendedException
from marshmallow import ValidationError as MarshmallowValidationError
from mongoengine.errors import DoesNotExist, NotUniqueError, ValidationError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


def setup_error_handlers(app: Flask):
    """Set up global error handlers for the Flask application."""

    @app.errorhandler(400)
    def bad_request(error):
        """Handle bad request errors."""
        # Safely get error details without exposing sensitive information
        error_type = type(error).__name__
        error_msg = str(error)[:100] if str(error) else "Unknown error"  # Truncate message
        remote_addr = "unknown"
        if has_request_context():
            try:
                remote_addr = request.remote_addr or "unknown"
            except Exception:
                pass
        
        logger.warning(f"Bad request from {remote_addr}: {error_type} - {error_msg}")
        return (
            jsonify(
                {
                    "error": "Bad request",
                    "message": "The request could not be processed",
                }
            ),
            400,
        )

    @app.errorhandler(401)
    def unauthorized(error):
        """Handle unauthorized errors."""
        logger.warning(f"Unauthorized access attempt from {request.remote_addr}")
        return (
            jsonify({"error": "Unauthorized", "message": "Authentication required"}),
            401,
        )

    @app.errorhandler(403)
    def forbidden(error):
        """Handle forbidden errors."""
        logger.warning(f"Forbidden access attempt from {request.remote_addr}")
        return jsonify({"error": "Forbidden", "message": "Access denied"}), 403

    @app.errorhandler(404)
    def not_found(error):
        """Handle not found errors."""
        return (
            jsonify(
                {
                    "error": "Not found",
                    "message": "The requested resource was not found",
                }
            ),
            404,
        )

    @app.errorhandler(413)
    def request_too_large(error):
        """Handle request too large errors."""
        logger.warning(f"Request too large from {request.remote_addr}")
        return (
            jsonify(
                {
                    "error": "Request too large",
                    "message": "The request payload is too large",
                }
            ),
            413,
        )

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        """Handle rate limit errors."""
        logger.warning(f"Rate limit exceeded from {request.remote_addr}")
        return (
            jsonify(
                {
                    "error": "Rate limit exceeded",
                    "message": "Too many requests. Please try again later.",
                }
            ),
            429,
        )

    @app.errorhandler(500)
    def internal_server_error(error):
        """Handle internal server errors."""
        logger.error(f"Internal server error: {error}", exc_info=True)
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "message": "An unexpected error occurred",
                }
            ),
            500,
        )

    # JWT specific errors
    @app.errorhandler(JWTExtendedException)
    def handle_jwt_exceptions(error):
        """Handle JWT related errors."""
        logger.warning(f"JWT error from {request.remote_addr}: {error.__class__.__name__}")
        return (
            jsonify(
                {"error": "Authentication error", "message": "Invalid or expired token"}
            ),
            401,
        )

    # Database specific errors
    @app.errorhandler(ValidationError)
    def handle_mongoengine_validation_error(error):
        """Handle MongoEngine validation errors."""
        logger.warning(f"Database validation error: {error}")
        return (
            jsonify(
                {"error": "Validation error", "message": "The provided data is invalid"}
            ),
            400,
        )

    @app.errorhandler(NotUniqueError)
    def handle_not_unique_error(error):
        """Handle MongoEngine not unique errors."""
        logger.warning(f"Duplicate data error: {error}")
        return (
            jsonify(
                {
                    "error": "Duplicate data",
                    "message": "The provided data already exists",
                }
            ),
            409,
        )

    @app.errorhandler(DoesNotExist)
    def handle_does_not_exist_error(error):
        """Handle MongoEngine does not exist errors."""
        return (
            jsonify(
                {
                    "error": "Not found",
                    "message": "The requested resource was not found",
                }
            ),
            404,
        )

    # Schema validation errors
    @app.errorhandler(MarshmallowValidationError)
    def handle_marshmallow_validation_error(error):
        """Handle Marshmallow validation errors."""
        # Log full error details for debugging
        logger.error(f"Schema validation error: {error.messages}")
        
        # In production, hide internal validation details
        if app.config.get('DEBUG', False):
            response_data = {
                "error": "Validation error",
                "message": "The provided data is invalid",
                "details": error.messages,
            }
        else:
            response_data = {
                "error": "Validation error",
                "message": "Invalid input provided",
            }
        
        return jsonify(response_data), 400


def safe_error_response(message: str = "Operation failed", status_code: int = 400):
    """
    Generate a safe error response without exposing internal details.

    Args:
        message: Safe error message for the user
        status_code: HTTP status code

    Returns:
        Flask JSON response
    """
    return jsonify({"error": message}), status_code


def handle_database_error(operation: str = "database operation"):
    """
    Decorator to handle database errors safely.

    Args:
        operation: Description of the operation for logging
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except ValidationError as e:
                logger.warning(f"Database validation error in {operation}: {e}")
                return safe_error_response("Invalid data provided", 400)
            except NotUniqueError as e:
                logger.warning(f"Duplicate data error in {operation}: {e}")
                return safe_error_response("Data already exists", 409)
            except DoesNotExist as e:
                logger.info(f"Resource not found in {operation}: {e}")
                return safe_error_response("Resource not found", 404)
            except Exception as e:
                logger.error(f"Unexpected error in {operation}: {e}", exc_info=True)
                return safe_error_response("Internal server error", 500)

        return decorated_function

    return decorator


def log_security_event(
    event_type: str, details: str, user_id: str = None, severity: str = "warning"
):
    """
    Log security-related events for monitoring.

    Args:
        event_type: Type of security event
        details: Event details
        user_id: User ID if available
        severity: Log severity level
    """
    message = f"SECURITY EVENT [{event_type}]: {details}"
    if user_id:
        message += f" | User: {user_id}"
    
    # Safely get remote address
    if has_request_context():
        try:
            remote_addr = request.remote_addr or "unknown"
        except Exception:
            remote_addr = "unknown"
    else:
        remote_addr = "unknown"
    
    message += f" | IP: {remote_addr}"

    if severity == "error":
        logger.error(message)
    elif severity == "warning":
        logger.warning(message)
    else:
        logger.info(message)
