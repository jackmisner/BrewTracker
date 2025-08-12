"""
Security monitoring and alerting system for BrewTracker.

Provides logging, metrics, and alerting for security events.
"""

import logging
import os
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from functools import wraps
from typing import Any, Dict, List

from flask import abort, current_app, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

# Thread-safe storage for security metrics
_security_metrics = defaultdict(lambda: defaultdict(int))
_failed_attempts = defaultdict(lambda: deque(maxlen=100))
_lock = threading.Lock()

# Configure security logger
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.INFO)

# Create security log handler
security_handler = logging.FileHandler("security.log")
security_handler.setLevel(logging.INFO)

# Create formatter
security_formatter = logging.Formatter(
    "%(asctime)s - SECURITY - %(levelname)s - %(message)s"
)
security_handler.setFormatter(security_formatter)
security_logger.addHandler(security_handler)


class SecurityMonitor:
    """Security monitoring and alerting system."""

    # Default thresholds (more lenient than before)
    DEFAULT_FAILED_LOGIN_THRESHOLD = 10  # per 30 minutes (increased from 5/15min)
    DEFAULT_FAILED_LOGIN_WINDOW = 1800  # 30 minutes in seconds (increased from 15min)

    DEFAULT_SUSPICIOUS_REQUEST_THRESHOLD = 25  # per 10 minutes (increased from 10/5min)
    DEFAULT_SUSPICIOUS_REQUEST_WINDOW = (
        600  # 10 minutes in seconds (increased from 5min)
    )

    _allowlist_cache = None
    _allowlist_cache_time = 0
    _cache_ttl = 300  # Cache allowlist for 5 minutes

    @classmethod
    def _get_config_value(cls, key: str, default: Any, value_type: type = int) -> Any:
        """Get configuration value from Flask app config or environment variables."""
        try:
            # Try Flask app config first (allows runtime configuration)
            if (
                current_app
                and hasattr(current_app, "config")
                and key in current_app.config
            ):
                return value_type(current_app.config[key])
        except RuntimeError:
            # Outside application context
            pass

        # Fall back to environment variables
        env_value = os.getenv(key)
        if env_value is not None:
            try:
                return value_type(env_value)
            except (ValueError, TypeError):
                security_logger.warning(
                    f"Invalid {key} environment variable: {env_value}, using default: {default}"
                )

        return default

    @classmethod
    def get_failed_login_threshold(cls) -> int:
        """Get configurable failed login threshold."""
        return cls._get_config_value(
            "SECURITY_FAILED_LOGIN_THRESHOLD", cls.DEFAULT_FAILED_LOGIN_THRESHOLD
        )

    @classmethod
    def get_failed_login_window(cls) -> int:
        """Get configurable failed login window in seconds."""
        return cls._get_config_value(
            "SECURITY_FAILED_LOGIN_WINDOW", cls.DEFAULT_FAILED_LOGIN_WINDOW
        )

    @classmethod
    def get_suspicious_request_threshold(cls) -> int:
        """Get configurable suspicious request threshold."""
        return cls._get_config_value(
            "SECURITY_SUSPICIOUS_REQUEST_THRESHOLD",
            cls.DEFAULT_SUSPICIOUS_REQUEST_THRESHOLD,
        )

    @classmethod
    def get_suspicious_request_window(cls) -> int:
        """Get configurable suspicious request window in seconds."""
        return cls._get_config_value(
            "SECURITY_SUSPICIOUS_REQUEST_WINDOW", cls.DEFAULT_SUSPICIOUS_REQUEST_WINDOW
        )

    @classmethod
    def _get_allowlist_ips(cls) -> List[str]:
        """Get list of allowlisted IP addresses from configuration."""
        current_time = time.time()

        # Use cached allowlist if still valid
        if (
            cls._allowlist_cache is not None
            and current_time - cls._allowlist_cache_time < cls._cache_ttl
        ):
            return cls._allowlist_cache

        allowlist = []

        try:
            # Try Flask app config first
            if current_app and hasattr(current_app, "config"):
                config_allowlist = current_app.config.get("SECURITY_IP_ALLOWLIST")
                if config_allowlist:
                    if isinstance(config_allowlist, list):
                        allowlist.extend(config_allowlist)
                    elif isinstance(config_allowlist, str):
                        # Support comma-separated string
                        allowlist.extend(
                            [
                                ip.strip()
                                for ip in config_allowlist.split(",")
                                if ip.strip()
                            ]
                        )
        except RuntimeError:
            # Outside application context
            pass

        # Check environment variable
        env_allowlist = os.getenv("SECURITY_IP_ALLOWLIST")
        if env_allowlist:
            # Support comma-separated string in env var
            env_ips = [ip.strip() for ip in env_allowlist.split(",") if ip.strip()]
            allowlist.extend(env_ips)

        # Always include localhost variants for health checks
        default_allowlist = ["127.0.0.1", "::1", "localhost"]
        for ip in default_allowlist:
            if ip not in allowlist:
                allowlist.append(ip)

        # Cache the result
        cls._allowlist_cache = allowlist
        cls._allowlist_cache_time = current_time

        return allowlist

    @classmethod
    def _extract_client_ip(cls) -> str:
        """Extract client IP address handling X-Forwarded-For headers."""
        # Check X-Forwarded-For header (reverse proxy/CDN scenarios)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain (original client)
            return forwarded_for.split(",")[0].strip()

        # Check X-Real-IP header (alternative forwarded header)
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()

        # Fall back to direct connection IP
        return request.remote_addr or "127.0.0.1"

    @classmethod
    def is_ip_allowlisted(cls, ip_address: str = None) -> bool:
        """Check if IP address is in the allowlist."""
        if ip_address is None:
            ip_address = cls._extract_client_ip()

        allowlist = cls._get_allowlist_ips()
        is_allowed = ip_address in allowlist

        if is_allowed:
            security_logger.info(
                f"Request from allowlisted IP bypassed security checks: {ip_address}"
            )

        return is_allowed

    @classmethod
    def log_authentication_attempt(
        cls, username: str, success: bool, ip_address: str, user_agent: str = None
    ):
        """
        Log authentication attempts for monitoring.

        Args:
            username: Username attempted
            success: Whether authentication succeeded
            ip_address: Client IP address
            user_agent: Client user agent
        """
        event_type = "AUTH_SUCCESS" if success else "AUTH_FAILURE"

        # Log the event
        log_data = {
            "event": event_type,
            "username": username,
            "ip": ip_address,
            "user_agent": user_agent or "unknown",
            "timestamp": datetime.now(UTC).isoformat(),
        }

        security_logger.info(f"{event_type}: {log_data}")

        # Track failed attempts
        if not success:
            cls._track_failed_attempt(ip_address, "login")

            # Check for brute force
            if cls._is_brute_force_attack(ip_address, "login"):
                cls.log_security_alert(
                    "BRUTE_FORCE_LOGIN",
                    f"Multiple failed login attempts from {ip_address}",
                    ip_address=ip_address,
                    severity="high",
                )

    @classmethod
    def log_suspicious_request(
        cls, request_type: str, details: str, ip_address: str, user_id: str = None
    ):
        """
        Log suspicious requests for analysis.

        Args:
            request_type: Type of suspicious request
            details: Details about the request
            ip_address: Client IP address
            user_id: User ID if authenticated
        """
        log_data = {
            "event": "SUSPICIOUS_REQUEST",
            "type": request_type,
            "details": details,
            "ip": ip_address,
            "user_id": user_id,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        security_logger.warning(f"SUSPICIOUS_REQUEST: {log_data}")

        # Track suspicious requests
        cls._track_failed_attempt(ip_address, "suspicious")

        if cls._is_brute_force_attack(ip_address, "suspicious"):
            cls.log_security_alert(
                "SUSPICIOUS_ACTIVITY",
                f"Multiple suspicious requests from {ip_address}",
                ip_address=ip_address,
                severity="medium",
            )

    @classmethod
    def log_security_alert(
        cls,
        alert_type: str,
        message: str,
        ip_address: str = None,
        user_id: str = None,
        severity: str = "medium",
    ):
        """
        Log high-priority security alerts.

        Args:
            alert_type: Type of security alert
            message: Alert message
            ip_address: Associated IP address
            user_id: Associated user ID
            severity: Alert severity (low, medium, high, critical)
        """
        alert_data = {
            "event": "SECURITY_ALERT",
            "type": alert_type,
            "message": message,
            "severity": severity,
            "ip": ip_address,
            "user_id": user_id,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        if severity in ["high", "critical"]:
            security_logger.error(f"SECURITY_ALERT: {alert_data}")
        else:
            security_logger.warning(f"SECURITY_ALERT: {alert_data}")

        # In production, this could trigger external alerting systems
        # (e.g., send to Slack, email, monitoring dashboard)

    @classmethod
    def log_data_access(
        cls,
        resource_type: str,
        resource_id: str,
        action: str,
        user_id: str,
        ip_address: str,
    ):
        """
        Log data access for audit trails.

        Args:
            resource_type: Type of resource (recipe, user, etc.)
            resource_id: ID of the resource
            action: Action performed (read, create, update, delete)
            user_id: User performing the action
            ip_address: Client IP address
        """
        log_data = {
            "event": "DATA_ACCESS",
            "resource_type": resource_type,
            "resource_id": resource_id,
            "action": action,
            "user_id": user_id,
            "ip": ip_address,
            "timestamp": datetime.now(UTC).isoformat(),
        }

        security_logger.info(f"DATA_ACCESS: {log_data}")

    @classmethod
    def _track_failed_attempt(cls, ip_address: str, attempt_type: str):
        """Track failed attempts for rate limiting."""
        with _lock:
            now = time.time()
            _failed_attempts[f"{ip_address}_{attempt_type}"].append(now)

    @classmethod
    def _is_brute_force_attack(cls, ip_address: str, attempt_type: str) -> bool:
        """Check if IP is performing brute force attack."""
        with _lock:
            key = f"{ip_address}_{attempt_type}"
            attempts = _failed_attempts[key]

            if not attempts:
                return False

            # Determine thresholds based on attempt type
            if attempt_type == "login":
                threshold = cls.get_failed_login_threshold()
                window = cls.get_failed_login_window()
            else:
                threshold = cls.get_suspicious_request_threshold()
                window = cls.get_suspicious_request_window()

            # Count recent attempts
            cutoff_time = time.time() - window
            recent_attempts = [t for t in attempts if t > cutoff_time]

            return len(recent_attempts) >= threshold

    @classmethod
    def is_ip_blocked(cls, ip_address: str) -> bool:
        """Check if IP should be blocked due to suspicious activity."""
        return cls._is_brute_force_attack(
            ip_address, "login"
        ) or cls._is_brute_force_attack(ip_address, "suspicious")

    @classmethod
    def get_security_metrics(cls) -> Dict[str, Any]:
        """Get current security metrics for monitoring dashboard."""
        with _lock:
            now = time.time()
            metrics = {
                "active_blocks": 0,
                "recent_alerts": 0,
                "failed_logins_1h": 0,
                "suspicious_requests_1h": 0,
            }

            # Count recent events
            one_hour_ago = now - 3600

            for key, attempts in _failed_attempts.items():
                if "_login" in key:
                    recent_login_attempts = [t for t in attempts if t > one_hour_ago]
                    metrics["failed_logins_1h"] += len(recent_login_attempts)
                elif "_suspicious" in key:
                    recent_suspicious = [t for t in attempts if t > one_hour_ago]
                    metrics["suspicious_requests_1h"] += len(recent_suspicious)

            return metrics


def monitor_endpoint(resource_type: str = None, action: str = None):
    """
    Decorator to monitor endpoint access.

    Args:
        resource_type: Type of resource being accessed
        action: Action being performed
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            start_time = time.time()
            # Extract client IP once and reuse throughout the function
            client_ip = SecurityMonitor._extract_client_ip()

            try:
                # Get user info
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()

                # Execute the endpoint
                result = f(*args, **kwargs)

                # Log successful access
                if resource_type and action and user_id:
                    resource_id = (
                        kwargs.get("recipe_id") or kwargs.get("session_id") or "unknown"
                    )
                    SecurityMonitor.log_data_access(
                        resource_type=resource_type,
                        resource_id=str(resource_id),
                        action=action,
                        user_id=user_id,
                        ip_address=client_ip,
                    )

                return result

            except Exception as e:
                # Log failed access attempts
                SecurityMonitor.log_suspicious_request(
                    request_type="ENDPOINT_ERROR",
                    details=f"Error in {f.__name__}: {str(e)[:100]}",
                    ip_address=client_ip,
                    user_id=get_jwt_identity(),
                )
                raise

            finally:
                # Track response time for anomaly detection
                response_time = time.time() - start_time
                if response_time > 10:  # Very slow responses might indicate issues
                    SecurityMonitor.log_suspicious_request(
                        request_type="SLOW_RESPONSE",
                        details=f"Slow response from {f.__name__}: {response_time:.2f}s",
                        ip_address=client_ip,
                    )

        return decorated_function

    return decorator


def check_request_security():
    """Middleware to check request security before processing."""
    # Skip security checks for health endpoints
    if request.path in ["/api/health", "/health"]:
        return

    # Check if IP is allowlisted (bypass all security checks)
    if SecurityMonitor.is_ip_allowlisted():
        return

    # Extract client IP for security checks
    client_ip = SecurityMonitor._extract_client_ip()

    # Check if IP is blocked
    if SecurityMonitor.is_ip_blocked(client_ip):
        SecurityMonitor.log_security_alert(
            "BLOCKED_IP_ACCESS",
            f"Blocked IP {client_ip} attempted access",
            ip_address=client_ip,
            severity="high",
        )
        # Block the request immediately
        abort(403)

    # Check for suspicious patterns in request
    if request.is_json:
        # Check total payload size first (before JSON parsing)
        if (
            request.content_length and request.content_length > 10 * 1024 * 1024
        ):  # 10MB limit
            SecurityMonitor.log_suspicious_request(
                "OVERSIZED_PAYLOAD",
                f"Payload size {request.content_length} bytes exceeds limit",
                ip_address=client_ip,
            )
            abort(413)  # Payload Too Large

        try:
            data = request.get_json(silent=True)
            if data and isinstance(data, dict):
                # Check for large field values
                for key, value in data.items():
                    if isinstance(value, str) and len(value) > 1000:
                        SecurityMonitor.log_suspicious_request(
                            "LARGE_PAYLOAD",
                            f"Large payload in field {key}",
                            ip_address=client_ip,
                        )
                        abort(413)  # Payload Too Large
        except Exception as e:
            # Only log JSON parsing errors, not abort exceptions
            if not hasattr(e, "code") or e.code != 413:
                SecurityMonitor.log_suspicious_request(
                    "JSON_PARSE_ERROR",
                    f"Failed to parse JSON payload: {type(e).__name__}",
                    ip_address=client_ip,
                )
