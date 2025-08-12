import os
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from models.mongo_models import User, UserSettings
from services.email_service import EmailService


class TestEmailService(unittest.TestCase):
    def setUp(self):
        """Set up test environment"""
        # Mock user for testing
        self.test_user = User(
            username="testuser", email="test@example.com", settings=UserSettings()
        )
        self.test_user.save = MagicMock()

    def test_generate_verification_token(self):
        """Test token generation"""
        token = EmailService.generate_verification_token()
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 20)  # Should be reasonably long

    @patch("services.email_service.smtplib.SMTP")
    @patch.dict(os.environ, {"SMTP_PASSWORD": "test_password"})
    def test_send_verification_email_success(self, mock_smtp):
        """Test successful email sending"""
        # Mock SMTP
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server

        # Test sending
        result = EmailService.send_verification_email(self.test_user)

        # Verify
        self.assertTrue(result)
        self.test_user.save.assert_called()
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once()
        mock_server.send_message.assert_called_once()

    def test_send_verification_email_already_verified(self):
        """Test sending to already verified user"""
        self.test_user.email_verified = True

        result = EmailService.send_verification_email(self.test_user)

        self.assertFalse(result)
        self.test_user.save.assert_not_called()

    @patch("services.email_service.smtplib.SMTP")
    @patch.dict(os.environ, {"SMTP_PASSWORD": "test_password"})
    def test_send_verification_email_failure(self, mock_smtp):
        """Test email sending failure"""
        # Mock SMTP to raise exception
        mock_smtp.side_effect = Exception("SMTP Error")

        result = EmailService.send_verification_email(self.test_user)

        self.assertFalse(result)

    def test_verify_email_token_success(self):
        """Test successful token verification"""
        # Create mock user with valid token
        test_token = "valid_token_123"
        mock_user = MagicMock()
        mock_user.email_verification_expires = datetime.now(UTC) + timedelta(hours=1)
        mock_user.email_verified = False
        mock_user.save = MagicMock()

        with patch("services.email_service.User.objects") as mock_objects:
            mock_objects.return_value.first.return_value = mock_user

            result = EmailService.verify_email_token(test_token)

            self.assertTrue(result["success"])
            self.assertEqual(result["message"], "Email verified successfully")
            self.assertTrue(mock_user.email_verified)
            mock_user.save.assert_called_once()

    def test_verify_email_token_already_verified(self):
        """Test verification of already verified user"""
        test_token = "valid_token_123"
        mock_user = MagicMock()
        mock_user.email_verified = True  # Already verified

        with patch("services.email_service.User.objects") as mock_objects:
            mock_objects.return_value.first.return_value = mock_user

            result = EmailService.verify_email_token(test_token)

            self.assertTrue(result["success"])
            self.assertEqual(result["message"], "Email already verified")
            # Should not call save since user is already verified
            mock_user.save.assert_not_called()

    def test_verify_email_token_invalid(self):
        """Test invalid token verification"""
        with patch("services.email_service.User.objects") as mock_objects:
            mock_objects.return_value.first.return_value = None

            result = EmailService.verify_email_token("invalid_token")

            self.assertFalse(result["success"])
            self.assertEqual(result["error"], "Invalid or expired verification token")

    def test_verify_email_token_expired(self):
        """Test expired token verification"""
        test_token = "expired_token_123"
        mock_user = MagicMock()
        mock_user.email_verified = False
        mock_user.email_verification_expires = datetime.now(UTC) - timedelta(hours=1)

        with patch("services.email_service.User.objects") as mock_objects:
            mock_objects.return_value.first.return_value = mock_user

            result = EmailService.verify_email_token(test_token)

            self.assertFalse(result["success"])
            self.assertEqual(result["error"], "Verification token has expired")

    def test_can_resend_verification_already_verified(self):
        """Test resend check for verified user"""
        self.test_user.email_verified = True

        can_send, error = EmailService.can_resend_verification(self.test_user)

        self.assertFalse(can_send)
        self.assertEqual(error, "Email is already verified")

    def test_can_resend_verification_rate_limit(self):
        """Test resend rate limiting"""
        self.test_user.email_verified = False
        self.test_user.email_verification_sent_at = datetime.now(UTC) - timedelta(
            minutes=2
        )

        can_send, error = EmailService.can_resend_verification(self.test_user)

        self.assertFalse(can_send)
        self.assertIn("Please wait", error)

    def test_can_resend_verification_allowed(self):
        """Test resend when allowed"""
        self.test_user.email_verified = False
        self.test_user.email_verification_sent_at = datetime.now(UTC) - timedelta(
            minutes=10
        )

        can_send, error = EmailService.can_resend_verification(self.test_user)

        self.assertTrue(can_send)
        self.assertIsNone(error)

    @patch.dict(
        os.environ,
        {
            "PASSWORD_RESET_SECRET": "dedicated_password_reset_secret",
            "JWT_SECRET_KEY": "jwt_secret",
        },
    )
    def test_get_secret_key_with_password_reset_secret(self):
        """Test that EmailService uses PASSWORD_RESET_SECRET when available"""
        secret_key = EmailService._get_secret_key()

        # Should use PASSWORD_RESET_SECRET
        self.assertEqual(secret_key, b"dedicated_password_reset_secret")

    @patch.dict(os.environ, {"JWT_SECRET_KEY": "jwt_secret"}, clear=True)
    def test_get_secret_key_fallback_to_jwt(self):
        """Test EmailService fallback to JWT_SECRET_KEY when PASSWORD_RESET_SECRET is not available"""
        secret_key = EmailService._get_secret_key()

        # Should fallback to JWT_SECRET_KEY
        self.assertEqual(secret_key, b"jwt_secret")

    @patch.dict(os.environ, {}, clear=True)
    def test_get_secret_key_raises_error_when_no_secrets(self):
        """Test that EmailService raises ValueError when neither secret is available"""
        with self.assertRaises(ValueError) as context:
            EmailService._get_secret_key()

        self.assertIn(
            "Either PASSWORD_RESET_SECRET or JWT_SECRET_KEY", str(context.exception)
        )

    @patch.dict(
        os.environ, {"PASSWORD_RESET_SECRET": "", "JWT_SECRET_KEY": "jwt_secret"}
    )
    def test_get_secret_key_empty_password_reset_secret_falls_back(self):
        """Test that empty PASSWORD_RESET_SECRET falls back to JWT_SECRET_KEY"""
        secret_key = EmailService._get_secret_key()

        # Should fallback to JWT_SECRET_KEY when PASSWORD_RESET_SECRET is empty
        self.assertEqual(secret_key, b"jwt_secret")

    @patch.dict(
        os.environ,
        {"PASSWORD_RESET_SECRET": "password_secret", "JWT_SECRET_KEY": "jwt_secret"},
    )
    def test_compute_token_hash_uses_correct_secret(self):
        """Test that EmailService token hash operations use the correct secret"""
        token = "test_token_12345"

        # Compute token hash
        token_hash = EmailService._compute_token_hash(token)

        # Should be a hex string (from HMAC SHA256)
        self.assertIsInstance(token_hash, str)
        self.assertEqual(len(token_hash), 64)  # SHA256 hex = 64 characters

        # Same token should produce same hash
        self.assertEqual(token_hash, EmailService._compute_token_hash(token))

        # Different token should produce different hash
        self.assertNotEqual(
            token_hash, EmailService._compute_token_hash("different_token")
        )


if __name__ == "__main__":
    unittest.main()
