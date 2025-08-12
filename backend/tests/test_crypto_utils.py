"""
Tests for the crypto utilities module.
"""

import os
import unittest
from unittest.mock import patch

from utils.crypto import get_password_reset_secret


class TestCryptoUtils(unittest.TestCase):
    """Test cases for cryptographic utility functions."""

    @patch.dict(
        os.environ,
        {
            "PASSWORD_RESET_SECRET": "dedicated_password_reset_secret",
            "JWT_SECRET_KEY": "jwt_secret",
        },
    )
    def test_get_password_reset_secret_with_password_reset_secret(self):
        """Test that get_password_reset_secret uses PASSWORD_RESET_SECRET when available"""
        secret_key = get_password_reset_secret()
        # Should use PASSWORD_RESET_SECRET
        self.assertEqual(secret_key, b"dedicated_password_reset_secret")

    @patch.dict(os.environ, {"JWT_SECRET_KEY": "jwt_secret"}, clear=True)
    def test_get_password_reset_secret_fallback_to_jwt(self):
        """Test get_password_reset_secret fallback to JWT_SECRET_KEY when PASSWORD_RESET_SECRET is not available"""
        secret_key = get_password_reset_secret()
        # Should fallback to JWT_SECRET_KEY
        self.assertEqual(secret_key, b"jwt_secret")

    @patch.dict(os.environ, {}, clear=True)
    def test_get_password_reset_secret_raises_error_when_no_secrets(self):
        """Test that get_password_reset_secret raises ValueError when no secrets are available"""
        with self.assertRaises(ValueError) as context:
            get_password_reset_secret()
        self.assertIn(
            "Either PASSWORD_RESET_SECRET or JWT_SECRET_KEY", str(context.exception)
        )

    @patch.dict(
        os.environ, {"PASSWORD_RESET_SECRET": "", "JWT_SECRET_KEY": "jwt_secret"}
    )
    def test_get_password_reset_secret_empty_password_reset_secret_falls_back(self):
        """Test that empty PASSWORD_RESET_SECRET falls back to JWT_SECRET_KEY"""
        secret_key = get_password_reset_secret()
        # Should fallback to JWT_SECRET_KEY when PASSWORD_RESET_SECRET is empty
        self.assertEqual(secret_key, b"jwt_secret")

    @patch.dict(
        os.environ,
        {"PASSWORD_RESET_SECRET": "password_secret", "JWT_SECRET_KEY": "jwt_secret"},
    )
    def test_get_password_reset_secret_returns_bytes(self):
        """Test that get_password_reset_secret always returns bytes"""
        secret_key = get_password_reset_secret()
        self.assertIsInstance(secret_key, bytes)
        self.assertEqual(secret_key, b"password_secret")


if __name__ == "__main__":
    unittest.main()
