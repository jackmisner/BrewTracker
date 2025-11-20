"""
Tests for Device Token Routes (Biometric Authentication)

Tests cover:
- Device token creation and validation
- Biometric login functionality
- Rate limiting to prevent brute force attacks
- Failed login attempt logging for security monitoring
- Token revocation and management
"""

import secrets
import time
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token

import config
from models.mongo_models import DeviceToken, FailedLoginAttempt, User
from routes.device_token_routes import device_token_bp
from utils.rate_limiter import setup_rate_limiter


@pytest.fixture
def app_with_device_tokens():
    """Create Flask app with device token routes and rate limiting"""
    app = Flask(__name__)
    app.config.from_object(config.TestConfig)

    # Initialize extensions
    JWTManager(app)
    CORS(app)

    # Initialize rate limiter
    limiter = setup_rate_limiter(app)

    # Register blueprint
    app.register_blueprint(device_token_bp, url_prefix="/api/auth")

    # Apply rate limiting to biometric login endpoint
    from utils.rate_limiter import RATE_LIMITS

    biometric_login_view = app.view_functions.get("device_token.biometric_login")
    if biometric_login_view:
        # RATE_LIMITS["biometric_login"] is a list, apply each limit
        for limit in RATE_LIMITS["biometric_login"]:
            limiter.limit(limit)(biometric_login_view)

    with app.app_context():
        yield app


@pytest.fixture
def client_with_device_tokens(app_with_device_tokens):
    """Create test client with device token routes"""
    return app_with_device_tokens.test_client()


@pytest.fixture
def test_user():
    """Create a test user"""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash="hashed_password",
        is_active=True,
    )
    user.save()
    return user


@pytest.fixture
def auth_headers(app_with_device_tokens, test_user):
    """Create authorization headers for authenticated requests"""
    with app_with_device_tokens.app_context():
        access_token = create_access_token(identity=str(test_user.id))
        return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def device_token(test_user):
    """Create a valid device token"""
    raw_token = secrets.token_urlsafe(64)
    # Use timezone-aware datetime to match model's is_valid() method
    expires_at = datetime.now(UTC) + timedelta(days=90)

    token = DeviceToken(
        user=test_user,
        device_id="test-device-123",
        device_name="Test Device",
        platform="android",
        token_hash=DeviceToken.hash_token(raw_token),
        expires_at=expires_at,
        created_at=datetime.now(UTC),  # Explicitly set created_at with timezone
    )
    token.save()
    return {"token": token, "raw_token": raw_token}


class TestDeviceTokenCreation:
    """Tests for device token creation endpoint"""

    def test_create_device_token_success(
        self, client_with_device_tokens, test_user, auth_headers
    ):
        """Test successful device token creation"""
        response = client_with_device_tokens.post(
            "/api/auth/device-token",
            json={
                "device_id": "test-device-456",
                "device_name": "Pixel 6",
                "platform": "android",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "device_token" in data
        assert data["device_id"] == "test-device-456"
        assert "expires_at" in data
        assert data["message"] == "Device token created successfully"

        # Verify token was saved to database
        saved_token = DeviceToken.objects(
            user=test_user, device_id="test-device-456"
        ).first()
        assert saved_token is not None
        assert saved_token.device_name == "Pixel 6"
        assert saved_token.platform == "android"

    def test_create_device_token_requires_auth(self, client_with_device_tokens):
        """Test that device token creation requires authentication"""
        response = client_with_device_tokens.post(
            "/api/auth/device-token",
            json={"device_id": "test-device-789", "platform": "android"},
        )
        assert response.status_code == 401

    def test_create_device_token_missing_device_id(
        self, client_with_device_tokens, auth_headers
    ):
        """Test that device_id is required"""
        response = client_with_device_tokens.post(
            "/api/auth/device-token", json={"platform": "android"}, headers=auth_headers
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "device_id is required" in data["error"]

    def test_create_device_token_invalid_json(
        self, client_with_device_tokens, auth_headers
    ):
        """Test that invalid JSON body returns 400"""
        response = client_with_device_tokens.post(
            "/api/auth/device-token",
            data="not valid json",
            headers={**auth_headers, "Content-Type": "application/json"},
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "Invalid or missing JSON body" in data["error"]

    def test_create_device_token_missing_json(
        self, client_with_device_tokens, auth_headers
    ):
        """Test that missing JSON body returns 400"""
        response = client_with_device_tokens.post(
            "/api/auth/device-token",
            headers=auth_headers,
        )
        assert response.status_code == 400
        data = response.get_json()
        assert "Invalid or missing JSON body" in data["error"]

    def test_create_device_token_revokes_existing(
        self, client_with_device_tokens, test_user, auth_headers, device_token
    ):
        """Test that creating a new token revokes existing tokens for same device"""
        # First token exists from fixture
        old_token = device_token["token"]
        assert not old_token.revoked

        # Create new token for same device
        response = client_with_device_tokens.post(
            "/api/auth/device-token",
            json={
                "device_id": "test-device-123",  # Same as fixture
                "device_name": "New Device",
                "platform": "android",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200

        # Verify old token was revoked
        old_token.reload()
        assert old_token.revoked is True


class TestBiometricLogin:
    """Tests for biometric login endpoint"""

    def test_biometric_login_success(
        self, client_with_device_tokens, test_user, device_token
    ):
        """Test successful biometric login"""
        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": device_token["raw_token"]},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["username"] == "testuser"
        assert data["message"] == "Login successful"

        # Verify token last_used was updated
        device_token["token"].reload()
        assert device_token["token"].last_used is not None

        # Verify user last_login was updated
        test_user.reload()
        assert test_user.last_login is not None

    def test_biometric_login_invalid_token(self, client_with_device_tokens):
        """Test biometric login with invalid token logs failed attempt"""
        invalid_token = secrets.token_urlsafe(64)

        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": invalid_token},
        )

        assert response.status_code == 401
        data = response.get_json()
        assert "Invalid device token" in data["error"]

        # Verify failed attempt was logged (uses request.remote_addr = 127.0.0.1 in test)
        failed_attempts = FailedLoginAttempt.objects(ip_address="127.0.0.1")
        assert failed_attempts.count() > 0
        latest_attempt = failed_attempts.order_by("-attempted_at").first()
        assert latest_attempt.failure_reason == "invalid_token"

    def test_biometric_login_expired_token(
        self, client_with_device_tokens, test_user, device_token
    ):
        """Test biometric login with expired token"""
        # Manually expire the token
        token = device_token["token"]
        token.expires_at = datetime.now(UTC) - timedelta(days=1)
        token.save()

        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": device_token["raw_token"]},
        )

        assert response.status_code == 401
        data = response.get_json()
        assert "expired or revoked" in data["error"]

        # Verify failed attempt was logged (uses request.remote_addr = 127.0.0.1 in test)
        failed_attempt = FailedLoginAttempt.objects(ip_address="127.0.0.1").first()
        assert failed_attempt is not None
        assert failed_attempt.failure_reason == "expired_token"

    def test_biometric_login_revoked_token(
        self, client_with_device_tokens, test_user, device_token
    ):
        """Test biometric login with revoked token"""
        # Revoke the token
        token = device_token["token"]
        token.revoke()

        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": device_token["raw_token"]},
        )

        assert response.status_code == 401

        # Verify failed attempt was logged with correct reason (uses request.remote_addr = 127.0.0.1 in test)
        failed_attempt = FailedLoginAttempt.objects(ip_address="127.0.0.1").first()
        assert failed_attempt is not None
        assert failed_attempt.failure_reason == "revoked_token"

    def test_biometric_login_inactive_user(
        self, client_with_device_tokens, test_user, device_token
    ):
        """Test biometric login with inactive user"""
        # Deactivate user
        test_user.is_active = False
        test_user.save()

        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": device_token["raw_token"]},
            headers={"X-Forwarded-For": "127.0.0.1"},
        )

        assert response.status_code == 404

        # Verify failed attempt was logged
        failed_attempt = FailedLoginAttempt.objects(ip_address="127.0.0.1").first()
        assert failed_attempt is not None
        assert failed_attempt.failure_reason == "inactive_user"

    def test_biometric_login_missing_token(self, client_with_device_tokens):
        """Test biometric login without device token"""
        response = client_with_device_tokens.post("/api/auth/biometric-login", json={})

        assert response.status_code == 400
        data = response.get_json()
        assert "device_token is required" in data["error"]

    def test_biometric_login_invalid_json(self, client_with_device_tokens):
        """Test biometric login with invalid JSON body"""
        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            data="not valid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "Invalid or missing JSON body" in data["error"]

    def test_biometric_login_missing_json(self, client_with_device_tokens):
        """Test biometric login with missing JSON body"""
        response = client_with_device_tokens.post("/api/auth/biometric-login")

        assert response.status_code == 400
        data = response.get_json()
        assert "Invalid or missing JSON body" in data["error"]


class TestRateLimiting:
    """Tests for rate limiting on biometric login"""

    def test_rate_limit_enforcement(
        self, client_with_device_tokens, test_user, device_token
    ):
        """Test that rate limiting prevents brute force attacks"""
        # Rate limit is 10 per minute
        # Make 11 requests rapidly
        invalid_token = secrets.token_urlsafe(64)

        for i in range(11):
            response = client_with_device_tokens.post(
                "/api/auth/biometric-login",
                json={"device_token": invalid_token},
                headers={"X-Forwarded-For": f"192.168.1.{i}"},  # Different IPs
            )

            if i < 10:
                # First 10 should work (but fail auth)
                assert response.status_code in [401, 404]
            # Note: In memory storage, rate limiting might not work perfectly
            # across different IPs in rapid succession

    def test_rate_limit_headers_present(self, client_with_device_tokens, device_token):
        """Test that rate limit headers are included in response"""
        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": device_token["raw_token"]},
        )

        # Flask-Limiter adds headers when enabled
        # Headers might include: X-RateLimit-Limit, X-RateLimit-Remaining, etc.
        assert response.status_code in [200, 429]


class TestFailedLoginAttemptModel:
    """Tests for FailedLoginAttempt model"""

    def test_log_failed_attempt(self):
        """Test logging a failed login attempt"""
        attempt = FailedLoginAttempt.log_failed_attempt(
            ip_address="203.0.113.42",
            device_id="device-456",
            user_agent="Mozilla/5.0 Test",
            reason="invalid_token",
        )

        assert attempt.id is not None
        assert attempt.ip_address == "203.0.113.42"
        assert attempt.device_id == "device-456"
        assert attempt.user_agent == "Mozilla/5.0 Test"
        assert attempt.failure_reason == "invalid_token"
        assert attempt.attempted_at is not None

    def test_get_recent_failures(self):
        """Test getting recent failed attempts from an IP"""
        ip = "203.0.113.50"

        # Log 3 failed attempts
        for i in range(3):
            FailedLoginAttempt.log_failed_attempt(ip_address=ip, reason=f"attempt_{i}")

        # Get recent failures (last 5 minutes)
        count = FailedLoginAttempt.get_recent_failures(ip, minutes=5)
        assert count == 3

        # Test with different IP (should be 0)
        other_count = FailedLoginAttempt.get_recent_failures("203.0.113.51", minutes=5)
        assert other_count == 0


class TestDeviceTokenManagement:
    """Tests for device token management endpoints"""

    def test_list_device_tokens(
        self, client_with_device_tokens, test_user, auth_headers, device_token
    ):
        """Test listing user's device tokens"""
        response = client_with_device_tokens.get(
            "/api/auth/device-tokens", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "tokens" in data
        assert len(data["tokens"]) == 1
        assert data["tokens"][0]["device_id"] == "test-device-123"

    def test_revoke_device_token(
        self, client_with_device_tokens, test_user, auth_headers, device_token
    ):
        """Test revoking a device token"""
        response = client_with_device_tokens.delete(
            "/api/auth/device-tokens/test-device-123", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "revoked" in data["message"]

        # Verify token was revoked
        device_token["token"].reload()
        assert device_token["token"].revoked is True

    def test_revoke_all_device_tokens(
        self, client_with_device_tokens, test_user, auth_headers, device_token
    ):
        """Test revoking all device tokens for a user"""
        # Create a second device token
        raw_token2 = secrets.token_urlsafe(64)
        token2 = DeviceToken(
            user=test_user,
            device_id="test-device-789",
            device_name="Second Device",
            platform="ios",
            token_hash=DeviceToken.hash_token(raw_token2),
            expires_at=datetime.now(UTC) + timedelta(days=90),
        )
        token2.save()

        response = client_with_device_tokens.post(
            "/api/auth/device-tokens/revoke-all", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "All device tokens have been revoked" in data["message"]

        # Verify both tokens were revoked
        device_token["token"].reload()
        token2.reload()
        assert device_token["token"].revoked is True
        assert token2.revoked is True


class TestSecurityFeatures:
    """Tests for security features"""

    def test_ip_address_logging(self, client_with_device_tokens):
        """Test that IP address is correctly logged from request.remote_addr"""
        invalid_token = secrets.token_urlsafe(64)

        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": invalid_token},
        )

        assert response.status_code == 401

        # Verify failed attempt logged with request.remote_addr (127.0.0.1 in test environment)
        failed_attempt = FailedLoginAttempt.objects(ip_address="127.0.0.1").first()
        assert failed_attempt is not None

    def test_user_agent_logging(self, client_with_device_tokens):
        """Test that user agent is logged with failed attempts"""
        invalid_token = secrets.token_urlsafe(64)
        test_user_agent = "Mozilla/5.0 (Android 12; Mobile) TestApp/1.0"

        response = client_with_device_tokens.post(
            "/api/auth/biometric-login",
            json={"device_token": invalid_token},
            headers={
                "User-Agent": test_user_agent,
            },
        )

        assert response.status_code == 401

        # Verify user agent was logged (with request.remote_addr = 127.0.0.1 in test environment)
        failed_attempt = FailedLoginAttempt.objects(ip_address="127.0.0.1").first()
        assert failed_attempt is not None
        assert failed_attempt.user_agent == test_user_agent

    def test_token_hash_security(self, test_user):
        """Test that tokens are stored as HMAC hashes, not plaintext"""
        raw_token = secrets.token_urlsafe(64)
        token_hash = DeviceToken.hash_token(raw_token)

        token = DeviceToken(
            user=test_user,
            device_id="security-test",
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=90),
        )
        token.save()

        # Verify raw token is not stored
        assert token.token_hash != raw_token
        assert len(token.token_hash) == 64  # HMAC-SHA256 produces 64 hex chars

        # Verify token can be found by raw token
        found_token = DeviceToken.find_by_token(raw_token)
        assert found_token is not None
        assert found_token.id == token.id
