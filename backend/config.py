import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/brewtracker")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_dev_secret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_TOKEN_LOCATION = ["headers"]

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
        required_vars = ["SECRET_KEY", "MONGO_URI", "JWT_SECRET_KEY"]
        missing_vars = [var for var in required_vars if not os.getenv(var)]

        if missing_vars:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing_vars)}"
            )


class TestConfig(Config):
    TESTING = True
    MONGO_URI = os.getenv(
        "TEST_MONGO_URI", "mongodb://localhost:27017/brewtracker_test"
    )
    JWT_SECRET_KEY = "test-jwt-secret-key"

    # Override MongoDB settings for testing
    MONGODB_SETTINGS = {"host": MONGO_URI, "uuidRepresentation": "standard"}
