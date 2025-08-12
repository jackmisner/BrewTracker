"""
Tests for configurable SecurityMonitor thresholds and allowlist functionality.
"""

import os
import time
from unittest.mock import patch

import pytest
from flask import Flask

from utils.security_monitor import SecurityMonitor, check_request_security


class TestSecurityMonitorConfiguration:
    """Test configurable thresholds and allowlist functionality."""

    def setup_method(self):
        """Reset SecurityMonitor state before each test."""
        # Clear any cached allowlist
        SecurityMonitor._allowlist_cache = None
        SecurityMonitor._allowlist_cache_time = 0

        # Clear failed attempts tracking
        from utils.security_monitor import _failed_attempts, _lock

        with _lock:
            _failed_attempts.clear()

    def test_default_thresholds(self):
        """Test that default thresholds are used when no config is provided."""
        assert (
            SecurityMonitor.get_failed_login_threshold()
            == SecurityMonitor.DEFAULT_FAILED_LOGIN_THRESHOLD
        )
        assert (
            SecurityMonitor.get_failed_login_window()
            == SecurityMonitor.DEFAULT_FAILED_LOGIN_WINDOW
        )
        assert (
            SecurityMonitor.get_suspicious_request_threshold()
            == SecurityMonitor.DEFAULT_SUSPICIOUS_REQUEST_THRESHOLD
        )
        assert (
            SecurityMonitor.get_suspicious_request_window()
            == SecurityMonitor.DEFAULT_SUSPICIOUS_REQUEST_WINDOW
        )

    @patch.dict(
        os.environ,
        {
            "SECURITY_FAILED_LOGIN_THRESHOLD": "20",
            "SECURITY_FAILED_LOGIN_WINDOW": "3600",
            "SECURITY_SUSPICIOUS_REQUEST_THRESHOLD": "50",
            "SECURITY_SUSPICIOUS_REQUEST_WINDOW": "1200",
        },
    )
    def test_environment_variable_thresholds(self):
        """Test that environment variables override default thresholds."""
        assert SecurityMonitor.get_failed_login_threshold() == 20
        assert SecurityMonitor.get_failed_login_window() == 3600
        assert SecurityMonitor.get_suspicious_request_threshold() == 50
        assert SecurityMonitor.get_suspicious_request_window() == 1200

    def test_flask_config_thresholds(self):
        """Test that Flask app config overrides environment variables."""
        app = Flask(__name__)
        app.config.update(
            {
                "SECURITY_FAILED_LOGIN_THRESHOLD": 15,
                "SECURITY_FAILED_LOGIN_WINDOW": 2700,
                "SECURITY_SUSPICIOUS_REQUEST_THRESHOLD": 40,
                "SECURITY_SUSPICIOUS_REQUEST_WINDOW": 900,
            }
        )

        with app.app_context():
            with patch.dict(
                os.environ,
                {
                    "SECURITY_FAILED_LOGIN_THRESHOLD": "20",  # Should be overridden by app config
                    "SECURITY_FAILED_LOGIN_WINDOW": "3600",
                },
            ):
                assert (
                    SecurityMonitor.get_failed_login_threshold() == 15
                )  # From app config
                assert (
                    SecurityMonitor.get_failed_login_window() == 2700
                )  # From app config
                assert SecurityMonitor.get_suspicious_request_threshold() == 40
                assert SecurityMonitor.get_suspicious_request_window() == 900

    @patch.dict(os.environ, {"SECURITY_FAILED_LOGIN_THRESHOLD": "invalid"})
    def test_invalid_environment_variable_fallback(self):
        """Test that invalid environment variables fall back to defaults."""
        assert (
            SecurityMonitor.get_failed_login_threshold()
            == SecurityMonitor.DEFAULT_FAILED_LOGIN_THRESHOLD
        )

    def test_default_allowlist_includes_localhost(self):
        """Test that localhost variants are always included in allowlist."""
        allowlist = SecurityMonitor._get_allowlist_ips()

        assert "127.0.0.1" in allowlist
        assert "::1" in allowlist
        assert "localhost" in allowlist

    @patch.dict(os.environ, {"SECURITY_IP_ALLOWLIST": "192.168.1.10,10.0.0.5"})
    def test_environment_allowlist(self):
        """Test loading allowlist from environment variable."""
        allowlist = SecurityMonitor._get_allowlist_ips()

        assert "192.168.1.10" in allowlist
        assert "10.0.0.5" in allowlist
        assert "127.0.0.1" in allowlist  # Default localhost should still be included

    def test_flask_config_allowlist_list(self):
        """Test loading allowlist from Flask app config as list."""
        app = Flask(__name__)
        app.config["SECURITY_IP_ALLOWLIST"] = ["192.168.1.20", "10.0.0.10"]

        with app.app_context():
            allowlist = SecurityMonitor._get_allowlist_ips()

            assert "192.168.1.20" in allowlist
            assert "10.0.0.10" in allowlist
            assert "127.0.0.1" in allowlist

    def test_flask_config_allowlist_string(self):
        """Test loading allowlist from Flask app config as comma-separated string."""
        app = Flask(__name__)
        app.config["SECURITY_IP_ALLOWLIST"] = "192.168.1.30, 10.0.0.15 ,172.16.0.10"

        with app.app_context():
            allowlist = SecurityMonitor._get_allowlist_ips()

            assert "192.168.1.30" in allowlist
            assert "10.0.0.15" in allowlist
            assert "172.16.0.10" in allowlist

    def test_allowlist_caching(self):
        """Test that allowlist is cached for performance."""
        with patch.dict(os.environ, {"SECURITY_IP_ALLOWLIST": "192.168.1.100"}):
            # First call should cache the result
            first_call = SecurityMonitor._get_allowlist_ips()
            assert "192.168.1.100" in first_call

            # Second call should use cached result
            with patch("os.getenv", return_value="should.not.be.used"):
                second_call = SecurityMonitor._get_allowlist_ips()
                assert second_call == first_call
                assert "192.168.1.100" in second_call

    def test_allowlist_cache_expiry(self):
        """Test that allowlist cache expires after TTL."""
        with patch.dict(os.environ, {"SECURITY_IP_ALLOWLIST": "192.168.1.200"}):
            # Set a short cache TTL for testing
            original_ttl = SecurityMonitor._cache_ttl
            SecurityMonitor._cache_ttl = 0.1  # 100ms

            try:
                # First call
                first_call = SecurityMonitor._get_allowlist_ips()
                assert "192.168.1.200" in first_call

                # Wait for cache to expire
                time.sleep(0.2)

                # Change environment and call again - should pick up new value
                with patch.dict(os.environ, {"SECURITY_IP_ALLOWLIST": "192.168.1.201"}):
                    second_call = SecurityMonitor._get_allowlist_ips()
                    assert "192.168.1.201" in second_call
                    assert "192.168.1.200" not in second_call
            finally:
                # Restore original TTL
                SecurityMonitor._cache_ttl = original_ttl

    def test_extract_client_ip_direct(self):
        """Test extracting client IP from direct connection."""
        app = Flask(__name__)

        with app.test_request_context(
            "/", environ_base={"REMOTE_ADDR": "192.168.1.50"}
        ):
            ip = SecurityMonitor._extract_client_ip()
            assert ip == "192.168.1.50"

    def test_extract_client_ip_x_forwarded_for(self):
        """Test extracting client IP from X-Forwarded-For header."""
        app = Flask(__name__)

        with app.test_request_context(
            "/",
            environ_base={"REMOTE_ADDR": "10.0.0.1"},
            headers={"X-Forwarded-For": "203.0.113.1, 198.51.100.1, 10.0.0.1"},
        ):
            ip = SecurityMonitor._extract_client_ip()
            assert ip == "203.0.113.1"  # First IP in the chain

    def test_extract_client_ip_x_real_ip(self):
        """Test extracting client IP from X-Real-IP header."""
        app = Flask(__name__)

        with app.test_request_context(
            "/",
            environ_base={"REMOTE_ADDR": "10.0.0.1"},
            headers={"X-Real-IP": "203.0.113.2"},
        ):
            ip = SecurityMonitor._extract_client_ip()
            assert ip == "203.0.113.2"

    def test_extract_client_ip_fallback(self):
        """Test fallback to localhost when no IP is available."""
        app = Flask(__name__)

        with app.test_request_context("/"):  # No REMOTE_ADDR set
            ip = SecurityMonitor._extract_client_ip()
            assert ip == "127.0.0.1"

    @patch("utils.security_monitor.SecurityMonitor._extract_client_ip")
    def test_is_ip_allowlisted_true(self, mock_extract_ip):
        """Test that allowlisted IPs return True."""
        mock_extract_ip.return_value = (
            "127.0.0.1"  # Localhost should always be allowlisted
        )

        assert SecurityMonitor.is_ip_allowlisted() is True

    @patch("utils.security_monitor.SecurityMonitor._extract_client_ip")
    def test_is_ip_allowlisted_false(self, mock_extract_ip):
        """Test that non-allowlisted IPs return False."""
        mock_extract_ip.return_value = "203.0.113.999"  # Not in allowlist

        assert SecurityMonitor.is_ip_allowlisted() is False

    @patch("utils.security_monitor.SecurityMonitor._extract_client_ip")
    def test_is_ip_allowlisted_explicit_ip(self, mock_extract_ip):
        """Test allowlist check with explicitly provided IP."""
        # Mock should not be called when IP is provided explicitly
        result = SecurityMonitor.is_ip_allowlisted("127.0.0.1")

        assert result is True
        mock_extract_ip.assert_not_called()

    @patch.dict(
        os.environ,
        {"SECURITY_FAILED_LOGIN_THRESHOLD": "3", "SECURITY_FAILED_LOGIN_WINDOW": "60"},
    )
    def test_configurable_brute_force_detection(self):
        """Test that configurable thresholds are used in brute force detection."""
        test_ip = "203.0.113.100"

        # Should not be blocked initially
        assert not SecurityMonitor._is_brute_force_attack(test_ip, "login")

        # Add failed attempts up to threshold - 1
        for _ in range(2):
            SecurityMonitor._track_failed_attempt(test_ip, "login")

        # Should not be blocked yet
        assert not SecurityMonitor._is_brute_force_attack(test_ip, "login")

        # Add one more failed attempt to reach threshold (3)
        SecurityMonitor._track_failed_attempt(test_ip, "login")

        # Now should be blocked
        assert SecurityMonitor._is_brute_force_attack(test_ip, "login")


class TestSecurityMiddlewareIntegration:
    """Test integration of security middleware with new configuration."""

    def setup_method(self):
        """Reset SecurityMonitor state before each test."""
        SecurityMonitor._allowlist_cache = None
        SecurityMonitor._allowlist_cache_time = 0

        from utils.security_monitor import _failed_attempts, _lock

        with _lock:
            _failed_attempts.clear()

    def test_check_request_security_allowlisted_bypass(self):
        """Test that allowlisted IPs bypass all security checks."""
        app = Flask(__name__)

        with app.test_request_context(
            "/api/some-endpoint", environ_base={"REMOTE_ADDR": "127.0.0.1"}
        ):
            with patch(
                "utils.security_monitor.SecurityMonitor.is_ip_allowlisted",
                return_value=True,
            ) as mock_allowlisted:
                # Should return without error (no blocking)
                result = check_request_security()
                assert result is None

                mock_allowlisted.assert_called_once()

    def test_check_request_security_blocked_ip(self):
        """Test that blocked non-allowlisted IPs are rejected."""
        app = Flask(__name__)

        with app.test_request_context(
            "/api/some-endpoint", environ_base={"REMOTE_ADDR": "203.0.113.200"}
        ):
            with patch(
                "utils.security_monitor.SecurityMonitor.is_ip_allowlisted",
                return_value=False,
            ):
                with patch(
                    "utils.security_monitor.SecurityMonitor.is_ip_blocked",
                    return_value=True,
                ):
                    # Expect a 403 Forbidden exception to be raised
                    with pytest.raises(Exception) as exc_info:
                        check_request_security()

                    # Verify it's a 403 Forbidden error
                    assert exc_info.value.code == 403

    def test_check_request_security_health_endpoint_bypass(self):
        """Test that health endpoints bypass security checks."""
        app = Flask(__name__)

        with app.test_request_context("/api/health"):
            # Should return without any checks
            result = check_request_security()
            assert result is None

    def test_check_request_security_json_processing_uses_extracted_ip(self):
        """Test that JSON security processing uses extracted client IP."""
        app = Flask(__name__)

        with app.test_request_context(
            "/api/some-endpoint",
            environ_base={"REMOTE_ADDR": "203.0.113.300"},
            data='{"large_field":"' + "x" * 1001 + '"}',
            content_type="application/json",
        ):
            with patch(
                "utils.security_monitor.SecurityMonitor.is_ip_allowlisted",
                return_value=False,
            ):
                with patch(
                    "utils.security_monitor.SecurityMonitor.is_ip_blocked",
                    return_value=False,
                ):
                    with patch(
                        "utils.security_monitor.SecurityMonitor.log_suspicious_request"
                    ) as mock_log:
                        check_request_security()

                        # Verify that the suspicious request was logged with the extracted IP
                        mock_log.assert_called_once_with(
                            "LARGE_PAYLOAD",
                            "Large payload in field large_field",
                            ip_address="203.0.113.300",
                        )
