import pytest
from models.mongo_models import User


class TestAuthenticationEndpoints:
    def test_register_success(self, client):
        """Test successful user registration"""
        response = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 201
        assert "User created successfully" in response.json["message"]

        # Verify user was created in database
        user = User.objects(username="testuser").first()
        assert user is not None
        assert user.email == "test@example.com"

    def test_register_duplicate_username(self, client):
        """Test registration with duplicate username"""
        # First registration
        client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test1@example.com",
                "password": "password123",
            },
        )

        # Duplicate username attempt
        response = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test2@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 400
        assert "Username already exists" in response.json["error"]

    def test_register_duplicate_email(self, client):
        """Test registration with duplicate email"""
        # First registration
        client.post(
            "/api/auth/register",
            json={
                "username": "testuser1",
                "email": "test@example.com",
                "password": "password123",
            },
        )

        # Duplicate email attempt
        response = client.post(
            "/api/auth/register",
            json={
                "username": "testuser2",
                "email": "test@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 400
        assert "Email already exists" in response.json["error"]

    def test_login_success(self, client):
        """Test successful login"""
        # Register user first
        client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )

        # Try logging in
        response = client.post(
            "/api/auth/login", json={"username": "testuser", "password": "password123"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json
        assert "user" in response.json
        assert response.json["user"]["username"] == "testuser"

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials"""
        response = client.post(
            "/api/auth/login",
            json={"username": "nonexistent", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert "Invalid credentials" in response.json["error"]

    def test_get_profile_unauthorized(self, client):
        """Test accessing profile without authentication"""
        response = client.get("/api/auth/profile")
        assert response.status_code == 401

    def test_get_profile_success(self, client):
        """Test accessing profile with valid token"""
        # Register and login user
        client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )

        login_response = client.post(
            "/api/auth/login", json={"username": "testuser", "password": "password123"}
        )
        token = login_response.json["access_token"]

        # Access profile with token
        response = client.get(
            "/api/auth/profile", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json["username"] == "testuser"
        assert response.json["email"] == "test@example.com"
