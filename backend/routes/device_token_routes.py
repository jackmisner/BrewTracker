"""
Device Token Routes for Biometric Authentication

These endpoints enable secure biometric login without storing passwords on devices.
Uses long-lived refresh tokens tied to specific devices.

Security & Privacy:
- Client IP addresses are processed for security monitoring and rate limiting
- IP logging complies with GDPR legitimate interest (Art. 6(1)(f)) for fraud prevention
- See PROXY_DEPLOYMENT.md for proxy configuration and SECURITY_CONFIG.md for retention policies
- Privacy policy: [SPECIFY YOUR PRIVACY POLICY URL]
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from models.mongo_models import DeviceToken, FailedLoginAttempt, User

logger = logging.getLogger(__name__)
device_token_bp = Blueprint("device_token", __name__)


@device_token_bp.route("/device-token", methods=["POST"])
@jwt_required()
def create_device_token():
    """
    Create a device token for biometric authentication.

    This endpoint generates a long-lived refresh token tied to a specific device,
    enabling biometric login without storing passwords on the device.

    Request body:
        {
            "device_id": "unique-device-identifier",
            "device_name": "Pixel 6" (optional),
            "platform": "android|web|ios"
        }

    Security:
    - Requires valid JWT access token (user must be logged in)
    - Generates cryptographically secure random token (512 bits)
    - Stores only SHA-256 hash of token in database
    - Token expires after 90 days by default
    - Can be revoked server-side at any time

    Returns:
        200: Device token created successfully
        400: Invalid request
        401: Unauthorized
        404: User not found
    """
    try:
        user_id = get_jwt_identity()
        user = User.objects(id=user_id).first()

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        device_id = data.get("device_id")
        device_name = data.get("device_name")
        platform = data.get("platform", "unknown")

        if not device_id:
            return jsonify({"error": "device_id is required"}), 400

        # Generate cryptographically secure random token (64 bytes = 512 bits)
        raw_token = secrets.token_urlsafe(64)

        # Create expiration date (90 days from now)
        expires_at = datetime.now(UTC) + timedelta(days=90)

        # Revoke any existing tokens for this device
        # (user can only have one active token per device)
        DeviceToken.revoke_device(user.id, device_id)

        # Create new device token
        device_token = DeviceToken(
            user=user,
            device_id=device_id,
            device_name=device_name,
            platform=platform,
            token_hash=DeviceToken.hash_token(raw_token),
            expires_at=expires_at,
        )
        device_token.save()

        return (
            jsonify(
                {
                    "device_token": raw_token,  # Transmitted once over TLS
                    "expires_at": expires_at.isoformat(),
                    "device_id": device_id,
                    "message": "Device token created successfully",
                }
            ),
            200,
        )

    except Exception as e:
        logger.exception("Error creating device token")
        return jsonify({"error": "Failed to create device token"}), 500


@device_token_bp.route("/biometric-login", methods=["POST"])
def biometric_login():
    """
    Authenticate using device token (biometric login).

    This endpoint exchanges a valid device token for a fresh access token,
    enabling biometric authentication without password transmission.

    Request body:
        {
            "device_token": "..."  # The raw token from /device-token
        }

    Security:
    - Rate limited to 10 attempts per minute per IP to prevent brute force
    - Validates device token against stored hash
    - Checks token expiration and revocation status
    - Logs failed attempts with IP address for security monitoring
    - Updates last_used timestamp for audit trail
    - Issues short-lived access token (1 day)

    IP Address Handling:
    - Uses request.remote_addr (normalized by ProxyFix when behind trusted proxies)
    - ProxyFix must be configured in app.py with TRUSTED_PROXY_COUNT
    - See PROXY_DEPLOYMENT.md for deployment configuration
    - CRITICAL: Firewall must restrict direct connections when using ProxyFix

    Privacy & GDPR:
    - IP addresses logged for security (legitimate interest under GDPR Art. 6(1)(f))
    - Retention: In-memory rate limiting (30min), security logs (90 days)
    - See SECURITY_CONFIG.md for data retention policies

    Returns:
        200: Login successful
        401: Invalid, expired, or revoked token
        404: Token not found or user inactive
        429: Too many requests (rate limit exceeded)
    """
    # Get client IP address
    # SECURITY: Uses request.remote_addr which is normalized by ProxyFix middleware
    # when ENABLE_PROXY_FIX=true and TRUSTED_PROXY_COUNT is configured.
    # DO NOT read X-Forwarded-For directly - it can be spoofed without ProxyFix validation.
    # See PROXY_DEPLOYMENT.md for proper proxy configuration.
    client_ip = request.remote_addr or "unknown"

    user_agent = request.headers.get("User-Agent", "Unknown")

    try:
        data = request.get_json()
        raw_token = data.get("device_token")

        if not raw_token:
            return jsonify({"error": "device_token is required"}), 400

        # Find device token by hash (constant-time comparison)
        device_token = DeviceToken.find_by_token(raw_token)

        if not device_token:
            # Log failed attempt
            FailedLoginAttempt.log_failed_attempt(
                ip_address=client_ip,
                device_id=data.get("device_id"),
                user_agent=user_agent,
                reason="invalid_token",
            )
            logger.warning(
                "Failed biometric login attempt from IP %s: invalid token", client_ip
            )
            return jsonify({"error": "Invalid device token"}), 401

        # Validate token (check expiration and revocation)
        if not device_token.is_valid():
            # Determine specific failure reason
            reason = "revoked_token" if device_token.revoked else "expired_token"
            FailedLoginAttempt.log_failed_attempt(
                ip_address=client_ip,
                device_id=device_token.device_id,
                user_agent=user_agent,
                reason=reason,
            )
            logger.warning(
                "Failed biometric login attempt from IP %s: %s (device: %s)",
                client_ip,
                reason,
                device_token.device_id,
            )
            return jsonify({"error": "Device token expired or revoked"}), 401

        # Get user
        user = device_token.user

        if not user or not user.is_active:
            FailedLoginAttempt.log_failed_attempt(
                ip_address=client_ip,
                device_id=device_token.device_id,
                user_agent=user_agent,
                reason="inactive_user",
            )
            logger.warning(
                "Failed biometric login attempt from IP %s: inactive user (device: %s)",
                client_ip,
                device_token.device_id,
            )
            return jsonify({"error": "User not found or inactive"}), 404

        # Success! Update token last_used timestamp
        device_token.update_last_used()

        # Update user last_login
        user.last_login = datetime.now(UTC)
        user.save()

        # Create fresh access token (1 day expiration)
        expires = timedelta(days=1)
        access_token = create_access_token(identity=str(user.id), expires_delta=expires)

        logger.info(
            "Successful biometric login for user %s from IP %s (device: %s)",
            user.username,
            client_ip,
            device_token.device_id,
        )

        return (
            jsonify(
                {
                    "access_token": access_token,
                    "user": user.to_dict(),
                    "message": "Login successful",
                }
            ),
            200,
        )

    except Exception as e:
        logger.exception("Error during biometric login from IP %s", client_ip)
        # Don't log failed attempt for system errors (only for auth failures)
        return jsonify({"error": "Biometric login failed"}), 500


@device_token_bp.route("/device-tokens", methods=["GET"])
@jwt_required()
def list_device_tokens():
    """
    List all device tokens for the authenticated user.

    Security:
    - Requires valid JWT access token
    - Returns only user's own device tokens
    - Excludes revoked tokens by default

    Query parameters:
        include_revoked: "true" to include revoked tokens

    Returns:
        200: List of device tokens
    """
    try:
        user_id = get_jwt_identity()
        include_revoked = request.args.get("include_revoked", "false").lower() == "true"

        # Build query
        query = {"user": user_id}
        if not include_revoked:
            query["revoked"] = False

        tokens = DeviceToken.objects(**query).order_by("-created_at")

        return jsonify({"tokens": [token.to_dict() for token in tokens]}), 200

    except Exception as e:
        logger.exception("Error listing device tokens")
        return jsonify({"error": "Failed to list device tokens"}), 500


@device_token_bp.route("/device-tokens/<device_id>", methods=["DELETE"])
@jwt_required()
def revoke_device_token(device_id):
    """
    Revoke all tokens for a specific device.

    Security:
    - Requires valid JWT access token
    - User can only revoke their own device tokens
    - Immediately invalidates all tokens for the device

    Returns:
        200: Tokens revoked successfully
        404: No tokens found for device
    """
    try:
        user_id = get_jwt_identity()

        # Find tokens for this user and device
        tokens = DeviceToken.objects(user=user_id, device_id=device_id, revoked=False)

        if not tokens:
            return jsonify({"error": "No active tokens found for this device"}), 404

        # Revoke all tokens for this device
        DeviceToken.revoke_device(user_id, device_id)

        return (
            jsonify(
                {"message": f"All tokens for device {device_id} have been revoked"}
            ),
            200,
        )

    except Exception as e:
        logger.exception("Error revoking device token")
        return jsonify({"error": "Failed to revoke device token"}), 500


@device_token_bp.route("/device-tokens/revoke-all", methods=["POST"])
@jwt_required()
def revoke_all_device_tokens():
    """
    Revoke all device tokens for the authenticated user.

    Useful for:
    - Password changes (force re-enrollment on all devices)
    - Security breach response
    - User-initiated "sign out everywhere"

    Security:
    - Requires valid JWT access token
    - Revokes all user's device tokens immediately

    Returns:
        200: All tokens revoked successfully
    """
    try:
        user_id = get_jwt_identity()

        # Revoke all tokens for this user
        DeviceToken.revoke_all_for_user(user_id)

        return (
            jsonify(
                {
                    "message": "All device tokens have been revoked. Please re-enroll biometric authentication on your devices."
                }
            ),
            200,
        )

    except Exception as e:
        logger.exception("Error revoking all device tokens")
        return jsonify({"error": "Failed to revoke device tokens"}), 500
