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

    def test_verify_email_token_invalid(self):
        """Test invalid token verification"""
        with patch("services.email_service.User.objects") as mock_objects:
            mock_objects.return_value.first.return_value = None

            result = EmailService.verify_email_token("invalid_token")

            self.assertFalse(result["success"])
            self.assertEqual(result["error"], "Invalid verification token")

    def test_verify_email_token_expired(self):
        """Test expired token verification"""
        test_token = "expired_token_123"
        mock_user = MagicMock()
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


if __name__ == "__main__":
    unittest.main()
