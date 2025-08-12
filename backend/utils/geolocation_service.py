"""
Secure geolocation service for determining user location preferences.

Provides fallback mechanisms and secure HTTPS communication with external services.
"""

import ipaddress
import logging
from typing import Dict, Optional
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)


class GeolocationService:
    """Secure geolocation service with multiple providers and fallbacks."""

    # Primary service (HTTPS)
    PRIMARY_SERVICE = "https://ipapi.co/{ip}/json/"

    # Fallback service (HTTPS)
    FALLBACK_SERVICE = (
        "https://ip-api.com/json/{ip}?fields=status,country,countryCode,timezone"
    )

    # Request timeout in seconds
    REQUEST_TIMEOUT = 5

    # Default response for failures
    DEFAULT_RESPONSE = {"country_code": None, "timezone": "UTC"}

    @classmethod
    def get_geo_info(cls, ip: str) -> Dict[str, Optional[str]]:
        """
        Get geolocation information for an IP address.

        Args:
            ip: IP address to lookup

        Returns:
            Dict containing country_code and timezone
        """
        # Validate IP address format
        if not cls._validate_ip(ip):
            logger.warning(f"Invalid IP address format: {ip}")
            return cls.DEFAULT_RESPONSE

        # Skip private/local IPs
        if cls._is_private_ip(ip):
            logger.info(f"Private IP detected: {ip}, using default location")
            return cls.DEFAULT_RESPONSE

        # Try primary service
        result = cls._try_service(ip, cls.PRIMARY_SERVICE, cls._parse_ipapi_response)
        if result:
            return result

        # Try fallback service
        result = cls._try_service(ip, cls.FALLBACK_SERVICE, cls._parse_ipapi_fallback)
        if result:
            return result

        # All services failed
        logger.error(f"All geolocation services failed for IP: {ip}")
        return cls.DEFAULT_RESPONSE

    @classmethod
    def _validate_ip(cls, ip: str) -> bool:
        """Validate IP address format."""
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    @classmethod
    def _is_private_ip(cls, ip: str) -> bool:
        """Check if IP is private/local."""
        try:
            ip_obj = ipaddress.ip_address(ip)
            return ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local
        except ValueError:
            return True  # Treat invalid IPs as private

    @classmethod
    def _try_service(
        cls, ip: str, service_url: str, parser
    ) -> Optional[Dict[str, Optional[str]]]:
        """Try a specific geolocation service."""
        try:
            # Safely encode IP for URL
            safe_ip = quote(str(ip))
            url = service_url.format(ip=safe_ip)

            # Make secure HTTPS request with timeout
            response = requests.get(
                url,
                timeout=cls.REQUEST_TIMEOUT,
                headers={
                    "User-Agent": "BrewTracker-Backend/1.0",
                    "Accept": "application/json",
                },
            )

            if response.status_code == 200:
                data = response.json()
                return parser(data)
            else:
                logger.warning(
                    f"Geolocation service returned {response.status_code} for {url}"
                )

        except requests.RequestException as e:
            logger.warning(f"Request failed for {service_url}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error with {service_url}: {e}")

        return None

    @classmethod
    def _parse_ipapi_response(cls, data: dict) -> Optional[Dict[str, Optional[str]]]:
        """Parse response from ipapi.co service."""
        if data.get("error"):
            logger.warning(
                f"ipapi.co returned error: {data.get('reason', 'Unknown error')}"
            )
            return None

        return {
            "country_code": data.get("country_code"),
            "timezone": data.get("timezone", "UTC"),
        }

    @classmethod
    def _parse_ipapi_fallback(cls, data: dict) -> Optional[Dict[str, Optional[str]]]:
        """Parse response from ip-api.com fallback service."""
        if data.get("status") != "success":
            logger.warning(f"ip-api.com returned status: {data.get('status')}")
            return None

        return {
            "country_code": data.get("countryCode"),
            "timezone": data.get("timezone", "UTC"),
        }
