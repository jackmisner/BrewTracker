# Use Python 3.13 slim image for smaller size
FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies and security updates
RUN apt-get update && apt-get install -y \
    gcc \
    ca-certificates \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-prod.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy application code
COPY . .

# Create directories for TLS certificates (optional)
RUN mkdir -p /app/certs && chmod 755 /app/certs

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app \
    && chmod -R 755 /app
USER app

# Expose port
EXPOSE 5000

# Environment variables that can be configured at runtime:
# Required:
# - SECRET_KEY: Flask application secret (minimum 32 characters)
# - JWT_SECRET_KEY: JWT token signing key (minimum 32 characters)
# - MONGO_URI: MongoDB connection string
# Optional security configuration:
# - SECURITY_FAILED_LOGIN_THRESHOLD: Failed login threshold (default: 10)
# - SECURITY_FAILED_LOGIN_WINDOW: Time window in seconds (default: 1800)
# - SECURITY_SUSPICIOUS_REQUEST_THRESHOLD: Suspicious request threshold (default: 25)
# - SECURITY_SUSPICIOUS_REQUEST_WINDOW: Time window in seconds (default: 600)
# - SECURITY_IP_ALLOWLIST: Comma-separated IPs to bypass security
# MongoDB TLS (mount certificates as volumes):
# - MONGO_TLS_CA_FILE: Path to CA certificate
# - MONGO_TLS_CERT_FILE: Path to client certificate
# - MONGO_TLS_KEY_FILE: Path to private key

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/health')" || exit 1

# Run the application
CMD ["python", "app.py"]