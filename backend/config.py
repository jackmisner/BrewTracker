import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/brewtracker")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_dev_secret")

    # Password reset secret with fallback to JWT_SECRET_KEY
    PASSWORD_RESET_SECRET = os.getenv(
        "PASSWORD_RESET_SECRET", os.getenv("JWT_SECRET_KEY", "jwt_dev_secret")
    )

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_TOKEN_LOCATION = ["headers"]

    # Google OAuth configuration
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    # MongoDB connection options
    MONGODB_SETTINGS = {"host": MONGO_URI, "uuidRepresentation": "standard"}


class ProductionConfig(Config):
    # Production-specific settings
    DEBUG = False
    TESTING = False

    # Require production environment variables
    SECRET_KEY = os.getenv("SECRET_KEY")
    MONGO_URI = os.getenv("MONGO_URI")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    # Password reset secret with fallback to JWT_SECRET_KEY for production
    PASSWORD_RESET_SECRET = os.getenv(
        "PASSWORD_RESET_SECRET", os.getenv("JWT_SECRET_KEY")
    )

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

    # Longer token expiry for production
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # Production MongoDB settings with SSL
    MONGODB_SETTINGS = {
        "host": MONGO_URI,
        "uuidRepresentation": "standard",
        "retryWrites": True,
        "w": "majority",
    }

    @classmethod
    def validate_required_vars(cls):
        """Validate that all required environment variables are set"""
        required_vars = [
            "SECRET_KEY",
            "MONGO_URI",
            "JWT_SECRET_KEY",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
        ]
        missing_vars = [var for var in required_vars if not os.getenv(var)]

        if missing_vars:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing_vars)}"
            )
            
        if not os.getenv("PASSWORD_RESET_SECRET") and not os.getenv("JWT_SECRET_KEY"):
            raise ValueError("PASSWORD_RESET_SECRET or JWT_SECRET_KEY must be set in production")

class TestConfig(Config):
    TESTING = True
    MONGO_URI = os.getenv(
        "TEST_MONGO_URI", "mongodb://localhost:27017/brewtracker_test"
    )
    JWT_SECRET_KEY = "test-jwt-secret-key"

    # Test-specific password reset secret (will fallback to JWT if not set)
    PASSWORD_RESET_SECRET = os.getenv("PASSWORD_RESET_SECRET", "test-jwt-secret-key")

    # Override MongoDB settings for testing
    MONGODB_SETTINGS = {"host": MONGO_URI, "uuidRepresentation": "standard"}
