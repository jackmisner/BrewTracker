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

    # Require production environment variables (no fallbacks)
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

    # Production MongoDB settings with enhanced security
    MONGODB_SETTINGS = {
        "host": MONGO_URI,
        "uuidRepresentation": "standard",
        "retryWrites": True,
        "w": "majority",
        "readConcern": {"level": "majority"},
        "ssl": True,  # Enable SSL in production
        "ssl_cert_reqs": "required",
    }

    @staticmethod
    def _validate_secret_strength(secret_value, secret_name):
        """
        Shared helper to validate secret key strength with consistent rules.
        
        Args:
            secret_value: The secret value to validate
            secret_name: Name of the secret (for error messages)
            
        Raises:
            ValueError: If secret is empty, too short, or uses weak defaults
        """
        if not secret_value:
            raise ValueError(f"{secret_name} must be set and non-empty")
            
        # Strip whitespace to prevent bypass of length/weakness checks
        secret_stripped = secret_value.strip()
        
        if len(secret_stripped) < 32:
            raise ValueError(f"{secret_name} must be at least 32 characters")
            
        # Check against known weak values (using stripped and normalized value)
        secret_normalized = secret_stripped.lower()
        weak_exact_values = {
            "default", "password", "secret", "dev", "test", 
            "jwt_dev_secret", "jwt_secret", "dev_secret_key"
        }
        weak_prefix_suffix = {"dev", "test", "default"}
        
        if (secret_normalized in weak_exact_values or 
            any(secret_normalized.startswith(prefix) or secret_normalized.endswith(prefix) 
                for prefix in weak_prefix_suffix)):
            raise ValueError(f"{secret_name} appears to be a known weak default or development/test secret")

    @classmethod
    def validate_required_vars(cls):
        """Validate that all required environment variables are set with strong values"""
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

        # Validate all secret keys using shared helper
        secret_key = os.getenv("SECRET_KEY", "")
        jwt_secret = os.getenv("JWT_SECRET_KEY", "")
        password_reset_secret = os.getenv("PASSWORD_RESET_SECRET", "")
        
        cls._validate_secret_strength(secret_key, "SECRET_KEY")
        cls._validate_secret_strength(jwt_secret, "JWT_SECRET_KEY")
        
        # PASSWORD_RESET_SECRET validation respects existing fallback semantics
        if password_reset_secret:
            cls._validate_secret_strength(password_reset_secret, "PASSWORD_RESET_SECRET")
        elif not jwt_secret:
            raise ValueError("PASSWORD_RESET_SECRET or JWT_SECRET_KEY must be set in production")
        
        # Ensure PASSWORD_RESET_SECRET is different from JWT_SECRET_KEY if both are set
        if (password_reset_secret and jwt_secret and 
            password_reset_secret.strip() == jwt_secret.strip()):
            raise ValueError("PASSWORD_RESET_SECRET must be different from JWT_SECRET_KEY in production")


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
