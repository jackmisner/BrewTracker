"""
Rate limiting configuration for BrewTracker API endpoints.

Provides different rate limits for different types of operations to prevent abuse.
"""

import logging
import os

from flask import Flask
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Conditional import of JWT functionality
try:
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

logger = logging.getLogger(__name__)


def get_user_id():
    """Get user ID from JWT token for authenticated rate limiting."""
    if not JWT_AVAILABLE:
        return get_remote_address()

    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        return user_id if user_id else get_remote_address()
    except Exception:
        return get_remote_address()


def setup_rate_limiter(app: Flask) -> Limiter:
    """Set up rate limiting for the Flask application."""

    # Use Redis for production, memory for development
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        storage_uri = redis_url
    else:
        # Memory storage for development (not suitable for multi-process production)
        storage_uri = "memory://"
        logger.warning(
            "Rate limiter using memory storage (memory://). This is not suitable for "
            "multi-process production deployments as rate limits may be bypassed. "
            "Configure REDIS_URL environment variable for persistent rate limiting."
        )

    limiter = Limiter(
        app=app,
        key_func=get_user_id,  # Rate limit by user ID when possible, IP otherwise
        storage_uri=storage_uri,
        default_limits=["1000 per hour", "100 per minute"],  # Global defaults
        headers_enabled=True,  # Send rate limit headers
    )

    return limiter


# Rate limit configurations for different endpoint types
RATE_LIMITS = {
    # Authentication endpoints (stricter limits)
    "auth_login": ["5 per minute", "20 per hour"],
    "auth_register": ["3 per minute", "10 per hour"],
    "auth_password_reset": ["3 per minute", "10 per hour"],
    "auth_verification": ["5 per minute", "20 per hour"],
    # Biometric authentication (strict brute force protection)
    "biometric_login": ["10 per minute", "30 per hour"],
    # Data creation/modification (moderate limits)
    "create_recipe": ["10 per minute", "100 per hour"],
    "create_brew_session": ["5 per minute", "50 per hour"],
    "file_upload": ["5 per minute", "20 per hour"],
    # Read operations (relaxed limits)
    "read_data": ["100 per minute", "1000 per hour"],
    # AI operations (strict limits due to cost)
    "ai_analysis": ["2 per minute", "20 per hour"],
    # Administrative operations (very strict)
    "admin": ["1 per minute", "10 per hour"],
}
