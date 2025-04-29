from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from models import db
from routes.auth import auth_bp
from routes.recipes import recipes_bp
from routes.brew_sessions import brew_sessions_bp
import config

app = Flask(__name__)
app.config.from_object(config.Config)

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)  # Initialize JWT Manager
CORS(app)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(recipes_bp, url_prefix="/api/recipes")
app.register_blueprint(brew_sessions_bp, url_prefix="/api/brew-sessions")


@app.route("/api/health", methods=["GET"])
def health_check():
    return (
        jsonify({"status": "healthy", "message": "Homebrew Tracker API is running"}),
        200,
    )


# Run the application
if __name__ == "__main__":
    app.run(debug=True)
