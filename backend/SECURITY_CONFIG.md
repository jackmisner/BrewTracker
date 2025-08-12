# Security Monitor Configuration Guide

The BrewTracker SecurityMonitor now supports configurable thresholds and IP allowlisting for more flexible security management.

## Configuration Options

### Environment Variables

```bash
# Rate limiting thresholds (more lenient defaults than before)
SECURITY_FAILED_LOGIN_THRESHOLD=10           # Failed login attempts before blocking (default: 10)
SECURITY_FAILED_LOGIN_WINDOW=1800           # Time window in seconds (default: 1800 = 30 minutes)
SECURITY_SUSPICIOUS_REQUEST_THRESHOLD=25    # Suspicious requests before blocking (default: 25)
SECURITY_SUSPICIOUS_REQUEST_WINDOW=600      # Time window in seconds (default: 600 = 10 minutes)

# IP allowlist for bypassing security checks
SECURITY_IP_ALLOWLIST="127.0.0.1,192.168.1.10,10.0.0.5"
```

### Flask App Configuration

```python
# In your Flask app config
app.config.update({
    'SECURITY_FAILED_LOGIN_THRESHOLD': 15,
    'SECURITY_FAILED_LOGIN_WINDOW': 2700,  # 45 minutes
    'SECURITY_SUSPICIOUS_REQUEST_THRESHOLD': 40,
    'SECURITY_SUSPICIOUS_REQUEST_WINDOW': 900,  # 15 minutes
    'SECURITY_IP_ALLOWLIST': ['192.168.1.20', '10.0.0.10']  # List format
})
```

## Features

### 1. Configurable Thresholds
- **More Lenient Defaults**: Increased from aggressive 5 attempts/15min to 10 attempts/30min for logins
- **Environment Override**: Set via environment variables for production
- **Runtime Configuration**: Override via Flask app config for testing
- **Graceful Fallback**: Invalid values fall back to safe defaults with logging

### 2. IP Allowlist/Bypass
- **Automatic Localhost**: Always includes `127.0.0.1`, `::1`, `localhost` for health checks
- **Custom IPs**: Add trusted IPs via environment variable or app config
- **Format Flexibility**: Supports comma-separated strings or Python lists
- **Performance Cache**: Allowlist cached for 5 minutes to avoid repeated parsing
- **Early Bypass**: Allowlisted IPs skip all security checks entirely

### 3. Enhanced IP Detection
- **X-Forwarded-For**: Handles reverse proxy and CDN scenarios
- **X-Real-IP**: Alternative forwarded header support
- **First IP Priority**: Takes original client IP from forwarded chain
- **Graceful Fallback**: Defaults to localhost if no IP available

### 4. Comprehensive Logging
- **Bypass Logging**: Logs when requests bypass security checks
- **Configuration Warnings**: Warns about invalid configuration values
- **Security Events**: Enhanced logging with extracted client IPs

## Usage Examples

### Development Environment
```bash
# .env file for local development
SECURITY_FAILED_LOGIN_THRESHOLD=20        # Be more lenient during development
SECURITY_IP_ALLOWLIST="127.0.0.1,::1"    # Allow localhost only
```

### Production Environment
```bash
# Production environment variables
SECURITY_FAILED_LOGIN_THRESHOLD=5         # Stricter in production
SECURITY_FAILED_LOGIN_WINDOW=900         # 15 minutes
SECURITY_IP_ALLOWLIST="10.0.1.5,10.0.1.6"  # Load balancer IPs
```

### Load Balancer/CDN Setup
```bash
# When behind load balancers that forward headers
SECURITY_IP_ALLOWLIST="10.0.0.1,10.0.0.2"  # Internal load balancer IPs
```

### Testing Configuration
```python
# Test configuration
app.config.update({
    'SECURITY_FAILED_LOGIN_THRESHOLD': 3,     # Quickly trigger for tests
    'SECURITY_FAILED_LOGIN_WINDOW': 60,       # 1 minute window
    'SECURITY_IP_ALLOWLIST': ['127.0.0.1', '192.168.1.100']
})
```

## Integration with Existing Security

The configurable SecurityMonitor integrates seamlessly with existing security components:

- **Rate Limiting**: Uses configurable thresholds for `flask-limiter` integration
- **Input Validation**: Allowlisted IPs still benefit from input sanitization
- **Error Handling**: Maintains security-conscious error responses
- **Audit Logging**: All security events logged with proper IP attribution

## Migration Notes

### Breaking Changes
- **More Lenient Defaults**: Existing installations will become less strict by default
- **New Dependencies**: No additional dependencies required
- **Configuration Format**: Fully backward compatible

### Recommended Migration
1. **Review Current Usage**: Check if default thresholds meet your security requirements
2. **Set Production Values**: Configure stricter thresholds for production if needed
3. **Add Load Balancer IPs**: Allowlist any trusted infrastructure IPs
4. **Monitor Logs**: Watch for bypass events and configuration warnings

## Security Considerations

### Allowlist Security
- **Trusted Networks Only**: Only allowlist truly trusted IPs/networks
- **Regular Review**: Periodically review allowlisted IPs
- **Internal Only**: Don't allowlist public/external IPs unless necessary
- **Logging Monitoring**: Monitor bypass logs for unexpected activity

### Threshold Tuning
- **Start Conservative**: Begin with stricter thresholds and relax if needed
- **Monitor False Positives**: Watch for legitimate users being blocked
- **Environment Specific**: Use different thresholds for dev/staging/prod
- **Business Requirements**: Balance security with user experience

## Testing the Configuration

```python
# Test that your configuration works
def test_security_config():
    from utils.security_monitor import SecurityMonitor
    
    # Verify thresholds
    assert SecurityMonitor.get_failed_login_threshold() == expected_value
    
    # Test allowlist
    assert SecurityMonitor.is_ip_allowlisted('127.0.0.1') is True
    assert SecurityMonitor.is_ip_allowlisted('203.0.113.1') is False
```