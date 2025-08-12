import hashlib
import hmac
import logging
import os
import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from models.mongo_models import User

# Configure email-specific logger
email_logger = logging.getLogger("email_service")
email_logger.setLevel(logging.DEBUG)

# Create file handler for email logs
email_handler = logging.FileHandler("email_test.log")
email_handler.setLevel(logging.DEBUG)

# Create formatter
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
email_handler.setFormatter(formatter)

# Add handler to logger (avoid duplicate handlers)
if not email_logger.handlers:
    email_logger.addHandler(email_handler)


class EmailService:
    """Email service for sending verification and notification emails via GoDaddy SMTP"""

    # Microsoft Exchange SMTP configuration (for GoDaddy email hosted on Exchange)
    SMTP_SERVER = "smtp-mail.outlook.com"
    SMTP_PORT = 587
    FROM_EMAIL = "jack@brewtracker.co.uk"

    @staticmethod
    def _get_secret_key():
        """Get secret key for password reset HMAC operations"""
        # Use the same logic as User model for consistency
        from models.mongo_models import User

        dummy_user = User()
        return dummy_user._get_secret_key()

    @staticmethod
    def _compute_token_hash(raw_token):
        """Compute HMAC-SHA256 hash of the raw token"""
        return hmac.new(
            EmailService._get_secret_key(), raw_token.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    @staticmethod
    def _get_smtp_credentials():
        """Get SMTP credentials from environment variables"""
        email = os.getenv("SMTP_EMAIL", EmailService.FROM_EMAIL)
        password = os.getenv("SMTP_PASSWORD")

        email_logger.debug(f"Using email: {email}")
        email_logger.debug(f"Password configured: {'Yes' if password else 'No'}")

        if not password:
            email_logger.error("SMTP_PASSWORD environment variable is required")
            raise ValueError("SMTP_PASSWORD environment variable is required")
        return email, password

    @staticmethod
    def _send_email(to_email, subject, html_body, text_body=None):
        """Send email via GoDaddy SMTP"""
        try:
            email, password = EmailService._get_smtp_credentials()

            email_logger.info(f"Attempting to send email from: {email}")
            email_logger.info(
                f"SMTP Server: {EmailService.SMTP_SERVER}:{EmailService.SMTP_PORT}"
            )
            email_logger.info(f"To: {to_email}")
            email_logger.debug(f"Subject: {subject}")

            # Create message
            msg = MIMEMultipart("alternative")
            msg["From"] = email
            msg["To"] = to_email
            msg["Subject"] = subject

            # Add text version if provided
            if text_body:
                text_part = MIMEText(text_body, "plain")
                msg.attach(text_part)

            # Add HTML version
            html_part = MIMEText(html_body, "html")
            msg.attach(html_part)

            # Connect and send with improved error handling and timeout
            email_logger.debug("Connecting to SMTP server...")
            with smtplib.SMTP(
                EmailService.SMTP_SERVER, EmailService.SMTP_PORT, timeout=60
            ) as server:
                email_logger.debug("Connected. Starting TLS...")
                server.starttls()  # Enable encryption
                email_logger.debug("TLS started. Attempting login...")
                server.login(email, password)
                email_logger.debug("Login successful. Sending message...")

                # Add Message-ID for better deliverability
                if "Message-ID" not in msg:
                    import secrets

                    msg["Message-ID"] = f"<{secrets.token_urlsafe(16)}@brewtracker.app>"

                server.send_message(msg)
                email_logger.info("Message sent successfully!")

            return True

        except Exception as e:
            email_logger.error(f"Failed to send email to {to_email}: {e}")
            email_logger.error(f"Error type: {type(e).__name__}")
            return False

    @staticmethod
    def generate_verification_token():
        """Generate a secure verification token"""
        return secrets.token_urlsafe(32)

    @staticmethod
    def send_verification_email(user):
        """Send email verification email to user"""
        if not user or user.email_verified:
            email_logger.info(
                f"Skipping verification email - user {'not found' if not user else 'already verified'}"
            )
            return False

        email_logger.info(f"Generating verification email for user: {user.username}")

        # Generate new verification token
        token = EmailService.generate_verification_token()
        expires = datetime.now(UTC) + timedelta(hours=24)

        email_logger.debug(f"Generated token: {token[:8]}...")
        email_logger.debug(f"Token expires: {expires}")

        # Update user with verification data
        user.email_verification_token = token
        user.email_verification_expires = expires
        user.email_verification_sent_at = datetime.now(UTC)
        user.save()

        # Get frontend URL from environment
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        verification_url = f"{frontend_url}/verify-email?token={token}"

        email_logger.debug(f"Verification URL: {verification_url}")

        # Email content
        subject = "Verify your BrewTracker account"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">🍺 BrewTracker</h1>
                </div>
                <div style="padding: 30px 20px; background: #f9fafb;">
                    <h2>Welcome to BrewTracker, {user.username}!</h2>
                    <p>Thanks for creating your BrewTracker account. To get started, please verify your email address by clicking the button below:</p>
                    
                    <!-- Email-compatible button using table -->
                    <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                        <tr>
                            <td style="background: #2563eb; border-radius: 6px; text-align: center;">
                                <a href="{verification_url}" style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; font-weight: bold; font-size: 16px;">Verify Email Address</a>
                            </td>
                        </tr>
                    </table>
                    
                    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                    <p><a href="{verification_url}" style="color: #2563eb; word-break: break-all;">{verification_url}</a></p>
                    
                    <div style="color: #dc2626; font-size: 14px; margin-top: 20px;">
                        <strong>Important:</strong> This verification link will expire in 24 hours.
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
                    <p>If you didn't create a BrewTracker account, you can safely ignore this email.</p>
                    <p>© 2025 BrewTracker. Happy brewing! 🍻</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Welcome to BrewTracker, {user.username}!

        Thanks for creating your BrewTracker account. To get started, please verify your email address by visiting:

        {verification_url}

        This verification link will expire in 24 hours.

        If you didn't create a BrewTracker account, you can safely ignore this email.

        Happy brewing!
        The BrewTracker Team
        """

        # Send the email
        email_logger.info(f"Attempting to send verification email to: {user.email}")
        success = EmailService._send_email(user.email, subject, html_body, text_body)

        if not success:
            email_logger.warning(
                f"Failed to send verification email to {user.email}, clearing verification data"
            )
            # Clear verification data if email failed to send
            user.email_verification_token = None
            user.email_verification_expires = None
            user.email_verification_sent_at = None
            user.save()
        else:
            email_logger.info(f"Verification email sent successfully to: {user.email}")

        return success

    @staticmethod
    def verify_email_token(token):
        """Verify an email verification token and mark user as verified"""
        if not token:
            return {"success": False, "error": "Token is required"}

        # Find user with this token
        user = User.objects(email_verification_token=token).first()
        if not user:
            return {"success": False, "error": "Invalid or expired verification token"}

        # Check if user is already verified (handles double-execution gracefully)
        if user.email_verified:
            return {"success": True, "message": "Email already verified", "user": user}

        # Check if token is expired
        if not user.email_verification_expires:
            return {"success": False, "error": "Verification token has expired"}

        current_time = datetime.now(UTC)

        # Ensure both datetimes are timezone-aware for comparison
        # MongoDB stores datetimes as timezone-naive UTC, so we need to make it timezone-aware
        if user.email_verification_expires.tzinfo is None:
            expires_utc = user.email_verification_expires.replace(tzinfo=UTC)
        else:
            expires_utc = user.email_verification_expires

        if expires_utc < current_time:
            return {"success": False, "error": "Verification token has expired"}

        # Mark user as verified
        try:
            user.email_verified = True
            user.email_verification_token = None
            user.email_verification_expires = None
            user.save()
        except Exception as save_error:
            return {"success": False, "error": "Failed to save verification status"}

        return {"success": True, "message": "Email verified successfully", "user": user}

    @staticmethod
    def can_resend_verification(user):
        """Check if user can resend verification email (rate limiting)"""
        if user.email_verified:
            return False, "Email is already verified"

        # Rate limiting: allow resend only after 5 minutes
        if user.email_verification_sent_at:
            # Ensure timezone-aware comparison
            if user.email_verification_sent_at.tzinfo is None:
                sent_at_utc = user.email_verification_sent_at.replace(tzinfo=UTC)
            else:
                sent_at_utc = user.email_verification_sent_at

            time_since_last = datetime.now(UTC) - sent_at_utc
            if time_since_last < timedelta(minutes=5):
                remaining = 5 - int(time_since_last.total_seconds() / 60)
                return (
                    False,
                    f"Please wait {remaining} minutes before requesting another email",
                )

        return True, None

    @staticmethod
    def send_password_reset_email(user):
        """Send password reset email to user"""
        if not user or not user.email_verified:
            email_logger.info(
                f"Skipping password reset email - user {'not found' if not user else 'email not verified'}"
            )
            return False

        email_logger.info(f"Generating password reset email for user: {user.username}")

        # Generate new reset token
        token = EmailService.generate_verification_token()
        expires = datetime.now(UTC) + timedelta(hours=1)  # 1 hour expiry for security

        email_logger.debug(f"Generated reset token: {token[:8]}...")
        email_logger.debug(f"Token expires: {expires}")

        # Update user with reset data using secure hashing
        user.set_password_reset_token(token)
        user.password_reset_expires = expires
        user.password_reset_sent_at = datetime.now(UTC)
        user.save()

        # Get frontend URL from environment
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={token}"

        email_logger.debug(f"Password reset URL: {reset_url}")

        # Email content
        subject = "Reset your BrewTracker password"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">🍺 BrewTracker</h1>
                </div>
                <div style="padding: 30px 20px; background: #f9fafb;">
                    <h2>Password Reset Request</h2>
                    <p>Hi {user.username},</p>
                    <p>You requested to reset your BrewTracker password. Click the button below to set a new password:</p>
                    
                    <!-- Email-compatible button using table -->
                    <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                        <tr>
                            <td style="background: #dc2626; border-radius: 6px; text-align: center;">
                                <a href="{reset_url}" style="display: inline-block; padding: 12px 24px; color: white; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a>
                            </td>
                        </tr>
                    </table>
                    
                    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                    <p><a href="{reset_url}" style="color: #dc2626; word-break: break-all;">{reset_url}</a></p>
                    
                    <div style="color: #dc2626; font-size: 14px; margin-top: 20px;">
                        <strong>Important:</strong> This password reset link will expire in 1 hour for security.
                    </div>
                    
                    <p style="margin-top: 20px; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                </div>
                <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
                    <p>© 2025 BrewTracker. Happy brewing! 🍻</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Password Reset Request

        Hi {user.username},

        You requested to reset your BrewTracker password. Visit the link below to set a new password:

        {reset_url}

        This password reset link will expire in 1 hour for security.

        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

        Happy brewing!
        The BrewTracker Team
        """

        # Send the email
        email_logger.info(f"Attempting to send password reset email to: {user.email}")
        success = EmailService._send_email(user.email, subject, html_body, text_body)

        if not success:
            email_logger.warning(
                f"Failed to send password reset email to {user.email}, clearing reset data"
            )
            # Clear reset data if email failed to send
            user.set_password_reset_token(None)
            user.password_reset_expires = None
            user.password_reset_sent_at = None
            user.save()
        else:
            email_logger.info(
                f"Password reset email sent successfully to: {user.email}"
            )

        return success

    @staticmethod
    def can_resend_password_reset(user):
        """Check if user can resend password reset email (rate limiting)"""
        # Rate limiting: allow password reset only after 10 minutes
        if user.password_reset_sent_at:
            # Ensure timezone-aware comparison
            if user.password_reset_sent_at.tzinfo is None:
                sent_at_utc = user.password_reset_sent_at.replace(tzinfo=UTC)
            else:
                sent_at_utc = user.password_reset_sent_at

            time_since_last = datetime.now(UTC) - sent_at_utc
            if time_since_last < timedelta(minutes=10):
                remaining = 10 - int(time_since_last.total_seconds() / 60)
                return (
                    False,
                    f"Please wait {remaining} minutes before requesting another password reset",
                )

        return True, None

    @staticmethod
    def verify_password_reset_token(token):
        """Verify a password reset token and return user if valid"""
        if not token:
            return {"success": False, "error": "Token is required"}

        try:
            # Compute the HMAC hash of the incoming token
            token_hash = EmailService._compute_token_hash(token)

            # Query directly for user with matching hashed token that hasn't expired
            current_time = datetime.now(UTC)

            user = User.objects(
                password_reset_token=token_hash,
                password_reset_expires__gte=current_time,
            ).first()

            if not user:
                return {"success": False, "error": "Invalid or expired reset token"}

            # Optional defense-in-depth: verify token using constant-time comparison
            if user.verify_password_reset_token(token):
                return {"success": True, "user": user}
            else:
                email_logger.warning(
                    "Token hash matched but verification failed - potential attack attempt"
                )
                return {"success": False, "error": "Invalid or expired reset token"}

        except ValueError as e:
            email_logger.error(f"Token verification failed: {e}")
            return {"success": False, "error": "Token verification error"}

    @staticmethod
    def verify_password_reset_token_with_identifier(token, email=None, username=None):
        """Verify password reset token with optional user identifier for enhanced security and performance"""
        if not token:
            return {"success": False, "error": "Token is required"}

        if not email and not username:
            # Fall back to the standard verification method
            return EmailService.verify_password_reset_token(token)

        try:
            # Compute the HMAC hash of the incoming token
            token_hash = EmailService._compute_token_hash(token)

            # Build query with user identifier for direct lookup
            current_time = datetime.now(UTC)
            query_filters = {
                "password_reset_token": token_hash,
                "password_reset_expires__gte": current_time,
            }

            # Add user identifier to query for more specific lookup
            if email:
                query_filters["email"] = email
            elif username:
                query_filters["username"] = username

            user = User.objects(**query_filters).first()

            if not user:
                # For security, return same error regardless of whether token or identifier is wrong
                return {"success": False, "error": "Invalid or expired reset token"}

            # Defense-in-depth: verify token using constant-time comparison
            if user.verify_password_reset_token(token):
                return {"success": True, "user": user}
            else:
                email_logger.warning(
                    f"Token hash matched but verification failed for user {user.username} - potential attack attempt"
                )
                return {"success": False, "error": "Invalid or expired reset token"}

        except ValueError as e:
            email_logger.error(f"Token verification with identifier failed: {e}")
            return {"success": False, "error": "Token verification error"}
