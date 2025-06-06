import pytest
from app import create_app
from mongoengine import connect, disconnect
import config


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Setup test database connection once for the entire test session"""
    # Disconnect any existing connections
    disconnect()

    # Connect to test database with proper UUID representation
    connect(
        host=config.TestConfig.MONGO_URI, uuidRepresentation="standard", alias="default"
    )

    yield

    # Clean up after all tests
    disconnect()


@pytest.fixture
def app():
    """Create Flask app for testing"""
    # Since we already have a DB connection from setup_test_db,
    # we need to create the app without calling create_app which would
    # try to connect again
    from flask import Flask
    from flask_cors import CORS
    from flask_jwt_extended import JWTManager
    from routes.auth import auth_bp
    from routes.recipes import recipes_bp
    from routes.ingredients import ingredients_bp
    from routes.brew_sessions import brew_sessions_bp

    app = Flask(__name__)
    app.config.from_object(config.TestConfig)

    # Initialize extensions (but don't connect to MongoDB again)
    JWTManager(app)
    CORS(app)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(recipes_bp, url_prefix="/api/recipes")
    app.register_blueprint(ingredients_bp, url_prefix="/api/ingredients")
    app.register_blueprint(brew_sessions_bp, url_prefix="/api/brew-sessions")

    with app.app_context():
        yield app


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db():
    """Clean the test database before each test"""
    from models.mongo_models import User, Recipe, Ingredient, BrewSession

    # Clean up all collections before each test
    try:
        User.drop_collection()
    except:
        pass

    try:
        Recipe.drop_collection()
    except:
        pass

    try:
        Ingredient.drop_collection()
    except:
        pass

    try:
        BrewSession.drop_collection()
    except:
        pass

    yield

    # Clean up after each test (optional, since we clean before each test)
    # This ensures no test data persists
