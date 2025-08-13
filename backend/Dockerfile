# Build stage: Install build dependencies and compile Python packages
FROM python:3.13-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-prod.txt .

# Install Python dependencies into a relocatable prefix (will compile native extensions if needed)
RUN python -m pip install --no-cache-dir --prefix=/install -r requirements-prod.txt

# Runtime stage: Create clean, minimal runtime image
FROM python:3.13-slim AS runtime

# Set working directory
WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from build stage
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create non-root system user for security and set up secure permissions
RUN useradd --system --create-home --shell /usr/sbin/nologin app \
    && mkdir -p /app/certs \
    && chown -R app:app /app \
    && chmod 700 /app/certs \
    && find /app -path '/app/certs*' -prune -o -type d -exec chmod 750 {} + \
    && find /app -path '/app/certs*' -prune -o -name '*.sh' -exec chmod 750 {} + \
    && find /app -path '/app/certs*' -prune -o -type f ! -name '*.sh' -exec chmod 640 {} +
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

# Health check using stdlib urllib (no third-party dependencies)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request, urllib.error; urllib.request.urlopen('http://localhost:5000/api/health', timeout=10); exit(0)" || exit 1

# Run the application
CMD ["python", "app.py"]