import logging
import os
import re
from pathlib import Path

from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from mongoengine import connect, disconnect
from mongoengine.connection import ConnectionFailure, get_connection
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

import config
from models.mongo_models import BeerStyleGuide, Ingredient, User
from routes.ai_routes import ai_bp
from routes.attenuation_analytics import attenuation_analytics_bp
from routes.auth import auth_bp
from routes.beer_styles import beer_styles_bp
from routes.beerxml import beerxml_bp
from routes.brew_sessions import brew_sessions_bp
from routes.device_token_routes import device_token_bp
from routes.ingredients import ingredients_bp
from routes.recipes import recipes_bp
from routes.user_settings import user_settings_bp
from utils.error_handlers import setup_error_handlers
from utils.rate_limiter import RATE_LIMITS, setup_rate_limiter
from utils.security_headers import add_security_headers
from utils.security_monitor import check_request_security


def create_app(config_class=None):
    app = Flask(__name__)

    # Determine configuration based on environment
    env = os.getenv("FLASK_ENV", "development")
    if config_class:
        app.config.from_object(config_class)
    else:
        if env == "production":
            app.config.from_object(config.ProductionConfig)
            # Validate required environment variables in production
            config.ProductionConfig.validate_required_vars()
        elif env == "testing":
            app.config.from_object(config.TestConfig)
        else:
            app.config.from_object(config.Config)

    # Configure ProxyFix middleware for X-Forwarded-* header handling
    # CRITICAL SECURITY: Only enable when behind trusted proxies with proper firewall rules
    # See PROXY_DEPLOYMENT.md for deployment requirements and security considerations
    if app.config.get("ENABLE_PROXY_FIX", False):
        x_for = app.config.get("TRUSTED_PROXY_COUNT", 0)
        x_host = app.config.get("TRUSTED_PROXY_HOST_COUNT", 0)
        x_proto = app.config.get("TRUSTED_PROXY_PROTO_COUNT", 0)

        if x_for > 0:
            app.wsgi_app = ProxyFix(
                app.wsgi_app, x_for=x_for, x_host=x_host, x_proto=x_proto
            )
            app.logger.info(
                f"ProxyFix middleware enabled: x_for={x_for}, x_host={x_host}, x_proto={x_proto}"
            )
            app.logger.warning(
                "ProxyFix enabled: Ensure firewall restricts connections to trusted proxies only! "
                "See PROXY_DEPLOYMENT.md for security requirements."
            )
        else:
            app.logger.warning(
                "ENABLE_PROXY_FIX=true but TRUSTED_PROXY_COUNT=0. ProxyFix not applied."
            )
    else:
        app.logger.info(
            "ProxyFix disabled (ENABLE_PROXY_FIX=false). Using direct IP detection."
        )

    # Configure logging for development debugging
    if env == "development":
        logging.basicConfig(
            filename="brewtracker.log", encoding="utf-8", level=logging.INFO
        )
        # Set werkzeug logger to WARNING to suppress its INFO logs in brewtracker.log
        logging.getLogger("werkzeug").setLevel(logging.WARNING)
        app.logger.setLevel(logging.ERROR)
        # Enable AI service logging
        ai_logger = logging.getLogger("services.ai_service")
        ai_logger.setLevel(logging.INFO)
        ai_routes_logger = logging.getLogger("routes.ai_routes")
        ai_routes_logger.setLevel(logging.INFO)

    # Initialize MongoDB connection
    try:
        # Check if connection already exists
        get_connection()
        app.logger.debug("MongoDB connection already exists; reusing connection")
    except ConnectionFailure:
        # No connection exists, create new one
        app.logger.debug("Creating new MongoDB connection")
        connect(host=app.config["MONGO_URI"], **app.config["MONGO_OPTIONS"])

    # Initialize other extensions
    JWTManager(app)

    # Initialize rate limiter
    limiter = setup_rate_limiter(app)
    app.logger.info("Rate limiter initialized")

    # Configure CORS based on environment
    flask_env = env
    app.logger.debug("FLASK_ENV detected: %s", env)

    # Configure secure Vercel origin pattern
    vercel_regex_env = os.getenv("VERCEL_ORIGIN_REGEX")
    if vercel_regex_env:
        try:
            vercel_pattern = re.compile(vercel_regex_env)
        except re.error as e:
            raise RuntimeError(f"Invalid VERCEL_ORIGIN_REGEX pattern: {e}") from e
    else:
        # Default to project-scoped pattern
        vercel_pattern = re.compile(r"^https://brewtracker-[A-Za-z0-9-]+\.vercel\.app$")

    if flask_env == "production":
        # Production CORS - tightened security
        allowed_origins = [
            os.getenv(
                "FRONTEND_URL",
                "https://brewtracker-wheat.vercel.app",
            ),
            # Custom domain
            "https://brewtracker.co.uk",
            # Vercel deployments with project-scoped regex pattern
            vercel_pattern,
            # Native app schemes only
            "capacitor://localhost",
            "ionic://localhost",
        ]
        if os.getenv("ALLOW_LOCALHOST_IN_PROD", "false").lower() == "true":
            allowed_origins.extend(["http://localhost", "https://localhost"])
        # Only allow null origins if explicitly enabled
        if os.getenv("ALLOW_NULL_ORIGIN", "false").lower() == "true":
            allowed_origins.extend(
                [
                    "null",  # WebView/file/about:blank resolve to Origin: null (security: only for dev - can come from untrusted contexts)
                ]
            )
    else:
        # Development CORS
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "http://localhost:8081",
            "http://127.0.0.1:8081",
            # Mobile development origins
            "capacitor://localhost",
            "ionic://localhost",
            "http://localhost",
            "https://localhost",
            "null",  # WebView/file/about:blank resolve to Origin: null (security: only for dev - can come from untrusted contexts)
            # Android APK development origins
            "app://localhost",
            "https://anonymous",  # Some Android WebViews use this
            # Flexible IP ranges for mobile development (regex patterns)
            re.compile(
                r"^http://192\.168\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d):8081$"
            ),
            re.compile(
                r"^http://10\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d):8081$"
            ),
        ]

    # Set credentials support based on environment and explicit flag
    supports_credentials = (
        flask_env != "production"
        or os.getenv("ENABLE_CORS_CREDENTIALS", "false").lower() == "true"
    )

    CORS(
        app,
        origins=allowed_origins,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=supports_credentials,
    )
    app.logger.debug(
        "CORS enabled (env=%s, supports_credentials=%s, origins=%d)",
        flask_env,
        supports_credentials,
        len(allowed_origins),
    )

    # Add security components
    add_security_headers(app)
    setup_error_handlers(app)

    # Add security monitoring middleware
    @app.before_request
    def before_request():
        try:
            check_request_security()
        except (SystemExit, KeyboardInterrupt):
            # Re-raise critical exceptions
            raise
        except HTTPException:
            # Preserve intended HTTP error (e.g., 400/401/403)
            raise
        except Exception:
            app.logger.exception("Security check failed in before_request handler")
            abort(500)

    # Register blueprints
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(device_token_bp, url_prefix="/api/auth")  # Biometric auth
    app.register_blueprint(recipes_bp, url_prefix="/api/recipes")
    app.register_blueprint(ingredients_bp, url_prefix="/api/ingredients")
    app.register_blueprint(brew_sessions_bp, url_prefix="/api/brew-sessions")
    app.register_blueprint(user_settings_bp, url_prefix="/api/user")
    app.register_blueprint(beerxml_bp, url_prefix="/api/beerxml")
    app.register_blueprint(beer_styles_bp, url_prefix="/api/beer-styles")
    app.register_blueprint(
        attenuation_analytics_bp, url_prefix="/api/attenuation-analytics"
    )

    # Apply rate limiting to biometric login endpoint
    # Access the view function by the endpoint name (blueprint.function_name)
    biometric_login_view = app.view_functions.get("device_token.biometric_login")
    if biometric_login_view:
        # RATE_LIMITS["biometric_login"] is a list, apply each limit
        for limit in RATE_LIMITS["biometric_login"]:
            limiter.limit(limit)(biometric_login_view)
        app.logger.info("Rate limiting applied to biometric login endpoint")
    else:
        app.logger.warning(
            "Could not apply rate limiting to biometric login endpoint (view not found)"
        )

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return (
            jsonify(
                {
                    "status": "healthy",
                    "message": "Homebrew Tracker API is running",
                    "features": [
                        "beerxml_import",
                        "beerxml_export",
                        "beer_style_guides",
                    ],
                }
            ),
            200,
        )

    # Only seed data if not in testing and if data doesn't exist
    if not app.config.get("TESTING", False):
        try:
            # Seed ingredients
            if Ingredient.objects.count() == 0:
                app.logger.info(
                    "No ingredients found in database. Running ingredient seed operation..."
                )
                from seeds.seed_ingredients import seed_ingredients

                json_file_path = (
                    Path(__file__).parent / "data" / "brewtracker.ingredients.json"
                )
                mongo_uri = os.environ.get(
                    "MONGO_URI", "mongodb://localhost:27017/brewtracker"
                )
                seed_ingredients(mongo_uri, json_file_path)

            # Seed beer styles
            if BeerStyleGuide.objects.count() == 0:
                app.logger.info(
                    "No beer styles found in database. Running beer style seed operation..."
                )
                from seeds.seed_beer_styles import seed_beer_styles

                json_file_path = (
                    Path(__file__).parent / "data" / "beer_style_guides.json"
                )
                mongo_uri = os.environ.get(
                    "MONGO_URI", "mongodb://localhost:27017/brewtracker"
                )
                seed_beer_styles(mongo_uri, json_file_path)

            # Seed system users
            if User.objects(email__endswith="@brewtracker.system").count() == 0:
                app.logger.info(
                    "No system users found in database. Running system users seed operation..."
                )
                from seeds.seed_system_users import seed_system_users

                json_file_path = Path(__file__).parent / "data" / "system_users.json"
                mongo_uri = os.environ.get(
                    "MONGO_URI", "mongodb://localhost:27017/brewtracker"
                )
                seed_system_users(mongo_uri, json_file_path)

        except Exception:
            app.logger.exception("Could not check/seed data:")

    return app


# Create app instance for WSGI servers
app = create_app()

# Run the application
if __name__ == "__main__":
    # Development server
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")
    debug = os.getenv("FLASK_ENV", "development") != "production"

    app.run(debug=debug, host=host, port=port)
