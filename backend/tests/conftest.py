from unittest.mock import patch

import pytest
from mongoengine import connect, disconnect

import config
from app import create_app


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Setup test database connection once for the entire test session"""
    import os

    # Disconnect any existing connections
    disconnect()

    # Get worker id for parallel execution (empty string if not parallel)
    worker_id = os.environ.get("PYTEST_XDIST_WORKER", "")

    # Create worker-specific database name
    if worker_id:
        db_name = f"brewtracker_test_{worker_id}"
    else:
        db_name = "brewtracker_test"

    # Construct MongoDB URI with worker-specific database
    base_uri = config.TestConfig.MONGO_URI.rsplit("/", 1)[0]  # Remove existing db name
    test_uri = f"{base_uri}/{db_name}"

    # Connect to worker-specific test database with proper UUID representation
    connect(host=test_uri, uuidRepresentation="standard", alias="default")

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
    from routes.beer_styles import beer_styles_bp
    from routes.beerxml import beerxml_bp
    from routes.brew_sessions import brew_sessions_bp
    from routes.ingredients import ingredients_bp
    from routes.recipes import recipes_bp
    from routes.user_settings import user_settings_bp

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
    app.register_blueprint(user_settings_bp, url_prefix="/api/user")
    app.register_blueprint(beerxml_bp, url_prefix="/api/beerxml")
    app.register_blueprint(beer_styles_bp, url_prefix="/api/beer-styles")

    with app.app_context():
        yield app


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db():
    """Clean the test database before each test"""
    from models.mongo_models import (
        BeerStyleGuide,
        BrewSession,
        Ingredient,
        Recipe,
        User,
    )

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

    try:
        BeerStyleGuide.drop_collection()
    except:
        pass

    yield

    # Clean up after each test (optional, since we clean before each test)
    # This ensures no test data persists


@pytest.fixture(autouse=True)
def mock_geolocation_service():
    """Mock geolocation service to prevent network calls during tests"""
    with patch("utils.geolocation_service.GeolocationService.get_geo_info") as mock_geo:
        # Mock successful geo lookup response for London, UK
        mock_geo.return_value = {"country_code": "GB", "timezone": "Europe/London"}
        yield mock_geo
