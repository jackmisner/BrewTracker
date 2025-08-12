"""
Cryptographic utilities for secure token operations.

This module provides centralized cryptographic functions to avoid circular
dependencies between models and services when handling password reset tokens.
"""

import os


def get_password_reset_secret():
    """
    Get secret key for password reset HMAC operations.

    Returns the raw secret key as bytes, prioritizing PASSWORD_RESET_SECRET
    environment variable and falling back to JWT_SECRET_KEY.

    Returns:
        bytes: The secret key encoded as UTF-8 bytes

    Raises:
        ValueError: If neither PASSWORD_RESET_SECRET nor JWT_SECRET_KEY
                   environment variables are available
    """
    # Check for dedicated password reset secret first
    secret_key = os.environ.get("PASSWORD_RESET_SECRET")
    if secret_key:
        return secret_key.encode("utf-8")

    # Fall back to JWT secret key
    secret_key = os.environ.get("JWT_SECRET_KEY")
    if secret_key:
        return secret_key.encode("utf-8")

    # Neither secret is available
    raise ValueError(
        "Either PASSWORD_RESET_SECRET or JWT_SECRET_KEY environment variable "
        "is required for secure password reset token operations"
    )
