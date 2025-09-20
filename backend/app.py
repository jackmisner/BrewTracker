import logging
import os
from pathlib import Path

from flask import Flask, abort, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from mongoengine import connect, disconnect
from mongoengine.connection import ConnectionFailure, get_connection

import config
from models.mongo_models import BeerStyleGuide, Ingredient, User
from routes.ai_routes import ai_bp
from routes.attenuation_analytics import attenuation_analytics_bp
from routes.auth import auth_bp
from routes.beer_styles import beer_styles_bp
from routes.beerxml import beerxml_bp
from routes.brew_sessions import brew_sessions_bp
from routes.ingredients import ingredients_bp
from routes.recipes import recipes_bp
from routes.user_settings import user_settings_bp
from utils.error_handlers import setup_error_handlers
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
        print("MongoDB connection already exists, using existing connection")
    except ConnectionFailure:
        # No connection exists, create new one
        print("Creating new MongoDB connection")
        connect(host=app.config["MONGO_URI"], **app.config["MONGO_OPTIONS"])

    # Initialize other extensions
    JWTManager(app)

    # Configure CORS based on environment
    flask_env = os.getenv("FLASK_ENV", "development")
    print(f"FLASK_ENV detected: {flask_env}")
    if flask_env == "production":
        # Production CORS - restrict to your frontend domain
        allowed_origins = [
            os.getenv(
                "FRONTEND_URL",
                "https://brewtracker-wheat.vercel.app",
            ),
            "https://*.vercel.app",  # Allow Vercel preview deployments
            # Android app origins
            "capacitor://localhost",  # Capacitor apps
            "ionic://localhost",  # Ionic apps
            "http://localhost",  # React Native/Expo local development
            "https://localhost",  # HTTPS local development
            "file://",  # File protocol for mobile apps
            "about:blank",  # Initial app load state
        ]
    else:
        # Development CORS
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "http://localhost:8081",
            "http://127.0.0.1:8081",
            "http://192.168.0.10:8081",
            # Mobile development origins
            "capacitor://localhost",
            "ionic://localhost",
            "http://localhost",
            "https://localhost",
            "file://",
            "about:blank",
            # Flexible IP ranges for mobile development
            "http://192.168.*:8081",
            "http://10.*:8081",
        ]

    CORS(
        app,
        origins=allowed_origins,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=True,
    )
    print(f"CORS enabled for origins: {allowed_origins}")
    print(f"Backend deployment trigger test - {flask_env} mode")

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
        except Exception as e:
            app.logger.exception("Security check failed in before_request handler")
            abort(500)

    # Register blueprints
    app.register_blueprint(ai_bp, url_prefix="/api/ai")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(recipes_bp, url_prefix="/api/recipes")
    app.register_blueprint(ingredients_bp, url_prefix="/api/ingredients")
    app.register_blueprint(brew_sessions_bp, url_prefix="/api/brew-sessions")
    app.register_blueprint(user_settings_bp, url_prefix="/api/user")
    app.register_blueprint(beerxml_bp, url_prefix="/api/beerxml")
    app.register_blueprint(beer_styles_bp, url_prefix="/api/beer-styles")
    app.register_blueprint(
        attenuation_analytics_bp, url_prefix="/api/attenuation-analytics"
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
                print(
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
            else:
                print(
                    "Ingredients already exist in the database. Skipping ingredient seed operation."
                )

            # Seed beer styles
            if BeerStyleGuide.objects.count() == 0:
                print(
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
            else:
                print(
                    "Beer styles already exist in the database. Skipping beer style seed operation."
                )

            # Seed system users
            if User.objects(email__endswith="@brewtracker.system").count() == 0:
                print(
                    "No system users found in database. Running system users seed operation..."
                )
                from seeds.seed_system_users import seed_system_users

                json_file_path = Path(__file__).parent / "data" / "system_users.json"
                mongo_uri = os.environ.get(
                    "MONGO_URI", "mongodb://localhost:27017/brewtracker"
                )
                seed_system_users(mongo_uri, json_file_path)
            else:
                print(
                    "System users already exist in the database. Skipping system users seed operation."
                )

        except Exception as e:
            print(f"Warning: Could not check/seed data: {e}")

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
