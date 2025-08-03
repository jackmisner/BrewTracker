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
            return {"success": False, "error": "Invalid verification token"}

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
    def send_password_reset_email(user, reset_token):
        """Send password reset email (for future implementation)"""
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"

        subject = "Reset your BrewTracker password"
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #dc2626; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 30px 20px; background: #f9fafb; }}
                .button {{ 
                    display: inline-block; 
                    background: #dc2626; 
                    color: white; 
                    padding: 12px 24px; 
                    text-decoration: none; 
                    border-radius: 6px; 
                    margin: 20px 0;
                }}
                .footer {{ padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🍺 BrewTracker</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hi {user.username},</p>
                    <p>You requested to reset your BrewTracker password. Click the button below to set a new password:</p>
                    
                    <a href="{reset_url}" class="button">Reset Password</a>
                    
                    <p>If you didn't request this password reset, you can safely ignore this email.</p>
                    <p>This link will expire in 1 hour for security.</p>
                </div>
                <div class="footer">
                    <p>© 2025 BrewTracker. Happy brewing! 🍻</p>
                </div>
            </div>
        </body>
        </html>
        """

        return EmailService._send_email(user.email, subject, html_body)
