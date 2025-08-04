import json
from unittest.mock import MagicMock, patch

import pytest

import config
from app import create_app
from models.mongo_models import Ingredient


class TestAppFactory:
    """Test application factory and configuration"""

    def test_create_app_default_config(self):
        """Test creating app with default configuration"""
        app = create_app()

        assert app is not None
        assert app.config["MONGO_URI"] == config.Config.MONGO_URI
        # JWT_SECRET_KEY can be overridden by environment variable, so check it exists and is not None
        assert app.config["JWT_SECRET_KEY"] is not None
        assert isinstance(app.config["JWT_SECRET_KEY"], str)
        assert len(app.config["JWT_SECRET_KEY"]) > 0

    def test_create_app_test_config(self):
        """Test creating app with test configuration"""
        app = create_app(config.TestConfig)

        assert app is not None
        assert app.config["TESTING"] is True
        assert app.config["MONGO_URI"] == config.TestConfig.MONGO_URI

    def test_create_app_custom_config(self):
        """Test creating app with custom configuration class"""

        class CustomConfig:
            MONGO_URI = "mongodb://custom:27017/custom_db"
            JWT_SECRET_KEY = "custom_secret"
            TESTING = False

        app = create_app(CustomConfig)

        assert app is not None
        assert app.config["MONGO_URI"] == "mongodb://custom:27017/custom_db"
        assert app.config["JWT_SECRET_KEY"] == "custom_secret"


class TestHealthEndpoint:
    """Test health check endpoint"""

    @pytest.fixture
    def test_app(self):
        """Create test app instance"""
        app = create_app(config.TestConfig)
        app.config["TESTING"] = True
        return app

    def test_health_check_endpoint(self, test_app):
        """Test health check endpoint returns correct response"""
        with test_app.test_client() as client:
            response = client.get("/api/health")

            assert response.status_code == 200
            assert response.content_type == "application/json"

            data = response.get_json()
            assert data["status"] == "healthy"
            assert "Homebrew Tracker API is running" in data["message"]

    def test_health_check_endpoint_methods(self, test_app):
        """Test health check endpoint only accepts GET requests"""
        with test_app.test_client() as client:
            # Test GET (should work)
            response = client.get("/api/health")
            assert response.status_code == 200

            # Test POST (should not be allowed)
            response = client.post("/api/health")
            assert response.status_code == 405  # Method Not Allowed

            # Test PUT (should not be allowed)
            response = client.put("/api/health")
            assert response.status_code == 405

            # Test DELETE (should not be allowed)
            response = client.delete("/api/health")
            assert response.status_code == 405


class TestBlueprintRegistration:
    """Test that all blueprints are properly registered"""

    @pytest.fixture
    def test_app(self):
        """Create test app instance"""
        app = create_app(config.TestConfig)
        return app

    def test_auth_blueprint_registered(self, test_app):
        """Test auth blueprint is registered with correct prefix"""
        with test_app.test_client() as client:
            # Test a known auth endpoint
            response = client.post(
                "/api/auth/register",
                json={
                    "username": "test",
                    "email": "test@test.com",
                    "password": "Test123!",
                },
            )
            # Should not be 404 (which would indicate blueprint not registered)
            assert response.status_code != 404

    def test_recipes_blueprint_registered(self, test_app):
        """Test recipes blueprint is registered with correct prefix"""
        with test_app.test_client() as client:
            # Test a known recipes endpoint (without auth, should get 401)
            response = client.get("/api/recipes")
            # Should be 401 (unauthorized) not 404 (not found)
            assert response.status_code == 401

    def test_ingredients_blueprint_registered(self, test_app):
        """Test ingredients blueprint is registered with correct prefix"""
        with test_app.test_client() as client:
            # Test a known ingredients endpoint (without auth, should get 401)
            response = client.get("/api/ingredients")
            # Should be 401 (unauthorized) not 404 (not found)
            assert response.status_code == 401

    def test_brew_sessions_blueprint_registered(self, test_app):
        """Test brew sessions blueprint is registered with correct prefix"""
        with test_app.test_client() as client:
            # Test a known brew sessions endpoint (without auth, should get 401)
            response = client.get("/api/brew-sessions")
            # Should be 401 (unauthorized) not 404 (not found)
            assert response.status_code == 401


class TestCORSConfiguration:
    """Test CORS configuration"""

    @pytest.fixture
    def test_app(self):
        """Create test app instance"""
        app = create_app(config.TestConfig)
        return app

    def test_cors_preflight_request(self, test_app):
        """Test CORS preflight OPTIONS request"""
        with test_app.test_client() as client:
            response = client.options(
                "/api/health",
                headers={
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "Content-Type,Authorization",
                },
            )

            # CORS should allow the request
            assert response.status_code == 200
            assert "Access-Control-Allow-Origin" in response.headers

    def test_cors_actual_request(self, test_app):
        """Test actual CORS request includes proper headers"""
        with test_app.test_client() as client:
            response = client.get(
                "/api/health", headers={"Origin": "http://localhost:3000"}
            )

            assert response.status_code == 200
            # Should include CORS headers
            assert "Access-Control-Allow-Origin" in response.headers

    def test_cors_allowed_methods(self, test_app):
        """Test that CORS allows the expected HTTP methods"""
        with test_app.test_client() as client:
            response = client.options(
                "/api/health",
                headers={
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "POST",
                },
            )

            # Should allow POST method
            assert response.status_code == 200


class TestDatabaseConnection:
    """Test database connection handling"""

    @patch("app.connect")
    @patch("app.get_connection")
    def test_database_connection_new(self, mock_get_connection, mock_connect):
        """Test creating new database connection when none exists"""
        # Simulate no existing connection
        from mongoengine.connection import ConnectionFailure

        mock_get_connection.side_effect = ConnectionFailure("No connection")

        app = create_app(config.TestConfig)

        # Should attempt to create new connection
        mock_connect.assert_called_once()

    @patch("app.get_connection")
    def test_database_connection_existing(self, mock_get_connection):
        """Test using existing database connection"""
        # Simulate existing connection
        mock_connection = MagicMock()
        mock_get_connection.return_value = mock_connection

        with patch("app.connect") as mock_connect:
            app = create_app(config.TestConfig)

            # Should not create new connection
            mock_connect.assert_not_called()


class TestIngredientSeeding:
    """Test ingredient seeding functionality"""

    @pytest.fixture
    def non_testing_config(self):
        """Create a config that allows seeding (TESTING=False)"""

        class NonTestingConfig(config.TestConfig):
            TESTING = False  # Override to False to allow seeding

        return NonTestingConfig

    @patch("seeds.seed_ingredients.seed_ingredients")
    @patch("app.Ingredient")
    def test_ingredient_seeding_when_empty_non_testing(
        self, mock_ingredient, mock_seed_ingredients, non_testing_config
    ):
        """Test that ingredients are seeded when database is empty in non-testing mode"""
        # Setup mock to simulate empty database
        mock_ingredient.objects.count.return_value = 0

        # Create app with non-testing config (should trigger seeding)
        app = create_app(non_testing_config)

        # Verify that seed_ingredients was called
        mock_seed_ingredients.assert_called_once()

        # Verify the arguments passed to seed_ingredients
        args, kwargs = mock_seed_ingredients.call_args
        assert len(args) == 2  # mongo_uri and json_file_path
        assert "mongodb" in args[0]  # mongo_uri should contain 'mongodb'
        assert "brewtracker.ingredients.json" in str(args[1])  # json file path

    # Test using config patching approach
    @patch("seeds.seed_ingredients.seed_ingredients")
    @patch("app.Ingredient")
    def test_ingredient_seeding_with_config_override(
        self, mock_ingredient, mock_seed_ingredients
    ):
        """Test that ingredients are seeded when TESTING is temporarily disabled"""
        # Setup mock to simulate empty database
        mock_ingredient.objects.count.return_value = 0

        # Temporarily override TESTING config to allow seeding
        with patch.object(config.TestConfig, "TESTING", False):
            # Create app (should trigger seeding because TESTING=False)
            app = create_app(config.TestConfig)

            # Verify that seed_ingredients was called
            mock_seed_ingredients.assert_called_once()

            # Verify the arguments passed to seed_ingredients
            args, kwargs = mock_seed_ingredients.call_args
            assert len(args) == 2  # mongo_uri and json_file_path
            assert "mongodb" in args[0]  # mongo_uri should contain 'mongodb'
            assert "brewtracker.ingredients.json" in str(args[1])  # json file path

    @patch("seeds.seed_ingredients.seed_ingredients")
    @patch("app.Ingredient")
    def test_ingredient_seeding_when_exists(
        self, mock_ingredient, mock_seed_ingredients, non_testing_config
    ):
        """Test that ingredients are not seeded when database has data"""
        # Setup mock to simulate database with existing ingredients
        mock_ingredient.objects.count.return_value = 100

        # Create app (should NOT trigger seeding)
        app = create_app(non_testing_config)

        # Verify that seed_ingredients was NOT called
        mock_seed_ingredients.assert_not_called()

    @patch("seeds.seed_ingredients.seed_ingredients")
    @patch("app.Ingredient")
    def test_ingredient_seeding_in_testing_mode(
        self, mock_ingredient, mock_seed_ingredients
    ):
        """Test that ingredients are never seeded in testing mode"""
        # Setup mock to simulate empty database
        mock_ingredient.objects.count.return_value = 0

        # Create app in testing mode (should NOT trigger seeding)
        app = create_app(config.TestConfig)  # TESTING=True

        # Verify that seed_ingredients was NOT called even with empty database
        mock_seed_ingredients.assert_not_called()

    @patch("seeds.seed_ingredients.seed_ingredients")
    @patch("app.Ingredient")
    def test_ingredient_seeding_handles_exceptions(
        self, mock_ingredient, mock_seed_ingredients, non_testing_config
    ):
        """Test that app creation continues even if seeding fails"""
        # Setup mock to simulate empty database
        mock_ingredient.objects.count.return_value = 0

        # Setup seed_ingredients to raise an exception
        mock_seed_ingredients.side_effect = Exception("Seeding failed")

        # Create app (should handle exception gracefully)
        app = create_app(non_testing_config)

        # Verify that seed_ingredients was called but exception was handled
        mock_seed_ingredients.assert_called_once()

        # App should still be created successfully
        assert app is not None

    @patch("seeds.seed_ingredients.seed_ingredients")
    @patch("app.Ingredient")
    def test_ingredient_count_check_fails(
        self, mock_ingredient, mock_seed_ingredients, non_testing_config
    ):
        """Test that app creation continues even if ingredient count check fails"""
        # Setup mock to simulate exception when checking count
        mock_ingredient.objects.count.side_effect = Exception(
            "Database connection failed"
        )

        # Create app (should handle exception gracefully)
        app = create_app(non_testing_config)

        # Verify that seed_ingredients was NOT called due to exception
        mock_seed_ingredients.assert_not_called()

        # App should still be created successfully
        assert app is not None


class TestAppIntegration:
    """Integration tests for the complete app"""

    @pytest.fixture
    def test_app(self):
        """Create test app instance"""
        app = create_app(config.TestConfig)
        app.config["TESTING"] = True
        return app

    def test_app_startup_sequence(self, test_app):
        """Test that app starts up properly with all components"""
        with test_app.test_client() as client:
            # Test health endpoint works
            response = client.get("/api/health")
            assert response.status_code == 200

            # Test that all blueprints are accessible (even if they return auth errors)
            endpoints_to_test = [
                "/api/auth/profile",  # Should return 401
                "/api/recipes",  # Should return 401
                "/api/ingredients",  # Should return 401
                "/api/brew-sessions",  # Should return 401
            ]

            for endpoint in endpoints_to_test:
                response = client.get(endpoint)
                # Should not be 404 (blueprint not found)
                assert response.status_code != 404

    def test_app_configuration_inheritance(self, test_app):
        """Test that app properly inherits from config classes"""
        # Test that JWT is configured
        assert "JWT_SECRET_KEY" in test_app.config
        assert test_app.config["JWT_SECRET_KEY"] is not None

        # Test that MongoDB URI is configured
        assert "MONGO_URI" in test_app.config
        assert test_app.config["MONGO_URI"] is not None

        # Test that testing flag is set
        assert test_app.config["TESTING"] is True

    def test_error_handling(self, test_app):
        """Test that app handles errors gracefully"""
        with test_app.test_client() as client:
            # Test 404 for non-existent endpoint
            response = client.get("/api/nonexistent")
            assert response.status_code == 404

            # Test 405 for wrong method
            response = client.post("/api/health")
            assert response.status_code == 405

    def test_json_handling(self, test_app):
        """Test that app properly handles JSON requests and responses"""
        with test_app.test_client() as client:
            # Test JSON response
            response = client.get("/api/health")
            assert response.is_json
            data = response.get_json()
            assert isinstance(data, dict)

            # Test JSON request (should be handled by blueprints)
            response = client.post(
                "/api/auth/register",
                json={
                    "username": "validuser",
                    "email": "validuser@test.com",
                    "password": "Test123!",
                },
                content_type="application/json",
            )
            # Should not fail due to JSON parsing (though may fail due to validation)
            assert (
                response.status_code != 400
            )  # Bad Request would indicate JSON parsing failed
