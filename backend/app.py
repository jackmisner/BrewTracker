from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from mongoengine import connect, disconnect
from mongoengine.connection import get_connection, ConnectionFailure
import os
from pathlib import Path
import config
from routes.auth import auth_bp
from routes.recipes import recipes_bp
from routes.ingredients import ingredients_bp
from routes.brew_sessions import brew_sessions_bp
from routes.user_settings import user_settings_bp
from routes.beerxml import beerxml_bp
from models.mongo_models import Ingredient


def create_app(config_class=None):
    app = Flask(__name__)

    if config_class:
        app.config.from_object(config_class)
    else:
        app.config.from_object(config.Config)

    # Initialize MongoDB connection
    try:
        # Check if connection already exists
        get_connection()
        print("MongoDB connection already exists, using existing connection")
    except ConnectionFailure:
        # No connection exists, create new one
        print("Creating new MongoDB connection")
        connect(host=app.config["MONGO_URI"], uuidRepresentation="standard")

    # Initialize other extensions
    JWTManager(app)
    CORS(
        app,
        origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=True,
    )
    print("CORS enabled for all domains")

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(recipes_bp, url_prefix="/api/recipes")
    app.register_blueprint(ingredients_bp, url_prefix="/api/ingredients")
    app.register_blueprint(brew_sessions_bp, url_prefix="/api/brew-sessions")
    app.register_blueprint(user_settings_bp, url_prefix="/api/user")
    app.register_blueprint(beerxml_bp, url_prefix="/api/beerxml")

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return (
            jsonify(
                {
                    "status": "healthy",
                    "message": "Homebrew Tracker API is running",
                    "features": ["beerxml_import", "beerxml_export"],
                }
            ),
            200,
        )

    # Only seed ingredients if not in testing and if no ingredients exist
    if not app.config.get("TESTING", False):
        try:
            if Ingredient.objects.count() == 0:
                print("No ingredients found in database. Running seed operation...")
                from seed_ingredients import seed_ingredients

                json_file_path = (
                    Path(__file__).parent / "data" / "brewtracker.ingredients.json"
                )
                mongo_uri = os.environ.get(
                    "MONGO_URI", "mongodb://localhost:27017/brewtracker"
                )
                seed_ingredients(mongo_uri, json_file_path)
            else:
                print(
                    "Ingredients already exist in the database. Skipping seed operation."
                )
        except Exception as e:
            print(f"Warning: Could not check/seed ingredients: {e}")

    return app


# Run the application
if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="localhost", port=5000)
