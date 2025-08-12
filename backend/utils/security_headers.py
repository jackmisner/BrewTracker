"""
Security headers middleware for Flask applications.

Provides security headers to protect against common web vulnerabilities.
"""

import os

from flask import Flask


def add_security_headers(app: Flask):
    """Add security headers to all responses."""

    @app.after_request
    def apply_security_headers(response):
        """Apply security headers to every response."""

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Prevent browsers from caching sensitive pages
        if "Cache-Control" not in response.headers:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        # HSTS in production only
        flask_env = os.getenv("FLASK_ENV", "development")
        if flask_env == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Basic CSP (can be enhanced later)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; style-src 'self' 'unsafe-inline'"
        )

        # Permissions policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )

        return response

    return app
