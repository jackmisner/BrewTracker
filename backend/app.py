from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from mongoengine import connect
import os
from pathlib import Path
import config
from routes.auth import auth_bp
from routes.recipes import recipes_bp
from routes.ingredients import ingredients_bp
from routes.brew_sessions import brew_sessions_bp
from models.mongo_models import Ingredient


def create_app(config_class=None):
    app = Flask(__name__)

    if config_class:
        app.config.from_object(config_class)
    else:
        app.config.from_object(config.Config)

    # Initialize extensions
    connect(host=app.config["MONGO_URI"])
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

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return (
            jsonify(
                {"status": "healthy", "message": "Homebrew Tracker API is running"}
            ),
            200,
        )

    if Ingredient.objects.count() == 0:
        print("No ingredients found in database. Running seed operation...")
        from seed_ingredients import seed_ingredients

        json_file_path = Path(__file__).parent / "data" / "brewtracker.ingredients.json"
        mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/brewtracker")
        seed_ingredients(mongo_uri, json_file_path)
    else:
        print("Ingredients already exist in the database. Skipping seed operation.")
    return app


# Run the application
if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="localhost", port=5000)
