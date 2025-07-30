"""Google OAuth verification service for BrewTracker"""

from typing import Dict, Optional, Tuple

import requests
from flask import current_app
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleOAuthService:
    """Service for handling Google OAuth authentication"""

    @staticmethod
    def verify_google_token(token: str) -> Optional[Dict]:
        """
        Verify Google ID token and extract user information

        Args:
            token: Google ID token from frontend

        Returns:
            Dict with user info if valid, None if invalid
        """
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, google_requests.Request(), current_app.config["GOOGLE_CLIENT_ID"]
            )

            # Additional validation
            if idinfo["iss"] not in [
                "accounts.google.com",
                "https://accounts.google.com",
            ]:
                raise ValueError("Wrong issuer.")

            # Extract user information
            return {
                "google_id": idinfo["sub"],
                "email": idinfo["email"],
                "name": idinfo.get("name", ""),
                "given_name": idinfo.get("given_name", ""),
                "family_name": idinfo.get("family_name", ""),
                "picture": idinfo.get("picture", ""),
                "email_verified": idinfo.get("email_verified", False),
            }

        except ValueError as e:
            current_app.logger.error(f"Google token verification failed: {e}")
            return None
        except Exception as e:
            current_app.logger.error(
                f"Unexpected error during Google token verification: {e}"
            )
            return None

    @staticmethod
    def generate_username_from_google_info(google_info: Dict) -> str:
        """
        Generate a unique username from Google user information

        Args:
            google_info: Dictionary with Google user data

        Returns:
            Generated username string
        """
        from models.mongo_models import User

        # Try to create username from name components
        base_username = ""

        if google_info.get("given_name"):
            base_username = google_info["given_name"].lower()
        elif google_info.get("name"):
            # Use first part of full name
            base_username = google_info["name"].split()[0].lower()
        else:
            # Fallback to email prefix
            base_username = google_info["email"].split("@")[0].lower()

        # Remove non-alphanumeric characters
        base_username = "".join(c for c in base_username if c.isalnum())

        # Ensure username is not empty
        if not base_username:
            base_username = "user"

        # Check if username exists and add number if needed
        username = base_username
        counter = 1

        while User.objects(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1

        return username

    @staticmethod
    def get_user_location_preferences(google_info: Dict) -> Tuple[str, float]:
        """
        Determine user's location preferences from Google info

        Args:
            google_info: Dictionary with Google user data

        Returns:
            Tuple of (unit_system, default_batch_size)
        """
        # Default to imperial units and 5 gallon batches (US default)
        default_units = "imperial"
        default_batch_size = 5.0

        # In a real implementation, you might use Google's geolocation API
        # or ask the user for their location preferences
        # For now, we'll use the same logic as the IP-based detection

        # You could enhance this by:
        # 1. Using Google's geolocation data if available
        # 2. Looking at the user's locale information
        # 3. Asking the user during the signup flow

        return default_units, default_batch_size
