# Security Monitor Configuration Guide

The BrewTracker SecurityMonitor supports configurable thresholds, IP allowlisting, and secure proxy handling for flexible security management.

**Related Documentation:**
- **Proxy & Reverse Proxy Setup**: See `PROXY_DEPLOYMENT.md` for detailed proxy configuration
- **GDPR & Privacy Compliance**: See sections below and your organization's privacy policy

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

# Proxy configuration (CRITICAL - see PROXY_DEPLOYMENT.md for details)
ENABLE_PROXY_FIX=false                      # Enable ProxyFix middleware (only when behind trusted proxy)
TRUSTED_PROXY_COUNT=0                       # Number of trusted proxies (0=direct, 1=single proxy, 2=CDN+LB, etc.)
TRUSTED_PROXY_HOST_COUNT=0                  # Optional: defaults to TRUSTED_PROXY_COUNT
TRUSTED_PROXY_PROTO_COUNT=0                 # Optional: defaults to TRUSTED_PROXY_COUNT
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
- **ProxyFix Middleware**: Securely normalizes X-Forwarded-* headers when behind trusted proxies
- **request.remote_addr**: Always use this (ProxyFix normalizes it automatically)
- **Never Trust Headers Directly**: X-Forwarded-For can be spoofed without ProxyFix validation
- **Firewall Required**: When using ProxyFix, firewall must block direct connections
- **Configuration**: Set ENABLE_PROXY_FIX=true and TRUSTED_PROXY_COUNT (see PROXY_DEPLOYMENT.md)

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

## GDPR and Privacy Compliance

### IP Address Processing

BrewTracker processes client IP addresses for the following security purposes:

1. **Rate Limiting**: Prevent brute force attacks on authentication endpoints (in-memory, 30 min window)
2. **Security Monitoring**: Detect and block suspicious activity patterns
3. **Audit Logging**: Maintain security audit trails for compliance and investigation
4. **Failed Login Tracking**: Track failed authentication attempts per IP address (dual storage: in-memory for rate limiting, database for audit)

### Legal Basis (GDPR Article 6)

IP address processing is justified under:

- **Legitimate Interest** (Art. 6(1)(f)): Security monitoring, fraud prevention, and protection of systems and users
- **Legal Obligation** (Art. 6(1)(c)): Security logging for compliance with data protection regulations

### Data Retention Periods

| Data Type | Storage Location | Retention Period | Justification |
|-----------|-----------------|------------------|---------------|
| Failed Login Attempts (Rate Limiting) | In-memory (Flask-Limiter) | 30 minutes (window based) | Rate limiting only |
| Failed Login Attempts (Audit) | Database (FailedLoginAttempt collection) | 30 days (TTL) | Audit/compliance and security investigation |
| Suspicious Requests | In-memory (Python dict) | 10 minutes (window based) | Rate limiting only |
| Security Logs | `security.log` file | 90 days (default) | Security investigation and compliance |
| Device Tokens | Database (DeviceToken collection) | 90 days (TTL) | Biometric authentication |

**Configuration**:
```bash
# Adjust retention by rotating log files
# Example: Daily rotation with 90-day retention
LOG_ROTATION_DAYS=90
```

### User Rights Under GDPR

Users have the right to:

1. **Access** (Art. 15): Request logs containing their IP address
2. **Rectification** (Art. 16): Correct inaccurate IP data (limited applicability)
3. **Erasure** (Art. 17): Request deletion of IP-based logs (subject to legal retention requirements)
4. **Restriction** (Art. 18): Restrict processing (may not be compatible with security requirements)
5. **Data Portability** (Art. 20): Receive copy of IP-based logs in structured format
6. **Object** (Art. 21): Object to processing (balanced against legitimate interest)

**Important**: Security logs may be exempt from erasure requests under GDPR Art. 17(3)(e) when necessary for compliance with legal obligations or establishment/defense of legal claims.

### Privacy Policy Requirements

Your privacy policy **must** document:

- Collection of IP addresses for security purposes
- Legal basis for processing (legitimate interest)
- Retention periods for different log types
- User rights and how to exercise them
- Contact information for data protection officer (if applicable)

**Privacy Policy Location**: `[SPECIFY YOUR PRIVACY POLICY URL]`
**Data Protection Contact**: `[SPECIFY DPO/PRIVACY CONTACT EMAIL]`

### Implementation Checklist

- [ ] Privacy policy documents IP address collection and processing
- [ ] Legal basis clearly stated (legitimate interest for security)
- [ ] Retention periods configured and documented
- [ ] Log rotation configured to enforce retention limits
- [ ] Procedure for handling user access/erasure requests
- [ ] Data protection impact assessment (DPIA) completed if high-risk processing
- [ ] Records of processing activities (ROPA) maintained

### Cross-Border Data Transfers

If deploying in multiple regions:

- **EU/EEA**: IP processing subject to GDPR
- **UK**: Subject to UK GDPR (similar requirements)
- **California**: May be subject to CCPA/CPRA for California residents
- **Other jurisdictions**: Check local data protection laws

### Logging Best Practices

```python
# Log only what's necessary
security_logger.info(
    f"Failed login from IP {client_ip}"  # ✅ Necessary for security
)

# Avoid logging unnecessary personal data
security_logger.info(
    f"User password: {password}"  # ❌ Never log passwords
)

# Hash or pseudonymize IPs for long-term analytics (optional)
import hashlib
ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:12]
analytics_logger.info(f"Request from IP hash {ip_hash}")
```

## References

- [GDPR Article 6: Lawfulness of Processing](https://gdpr-info.eu/art-6-gdpr/)
- [GDPR Article 17: Right to Erasure](https://gdpr-info.eu/art-17-gdpr/)
- [ICO Guidance: Legitimate Interests](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/legitimate-interests/)
- [EDPB Guidelines on IP Addresses as Personal Data](https://edpb.europa.eu/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- **Proxy Configuration**: See `PROXY_DEPLOYMENT.md` for detailed proxy setup