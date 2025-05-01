import pytest
from flask import Flask
from datetime import datetime
from models import db
from models.user import User
from routes.auth import auth_bp


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = "test-secret-key"
    app.register_blueprint(auth_bp)

    with app.app_context():
        db.init_app(app)
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def test_register_success(client):
    response = client.post(
        "/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 201
    assert "User registered successfully" in response.json["message"]


def test_register_duplicate_username(client):
    # First registration
    client.post(
        "/register",
        json={
            "username": "testuser",
            "email": "test1@example.com",
            "password": "password123",
        },
    )

    # Duplicate username attempt
    response = client.post(
        "/register",
        json={
            "username": "testuser",
            "email": "test2@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 409
    assert "Username already exists" in response.json["error"]


def test_login_success(client):
    # Register user first
    client.post(
        "/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "password123",
        },
    )

    # Try logging in
    response = client.post(
        "/login", json={"username": "testuser", "password": "password123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json
    assert "Login successful" in response.json["message"]


def test_login_invalid_credentials(client):
    response = client.post(
        "/login", json={"username": "nonexistent", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Invalid username or password" in response.json["error"]


def test_get_profile_unauthorized(client):
    response = client.get("/profile")
    assert response.status_code == 401
