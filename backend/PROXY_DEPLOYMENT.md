# Proxy and Reverse Proxy Deployment Guide

## Overview

BrewTracker's backend **must** be deployed with proper proxy configuration when running behind load balancers, reverse proxies, or CDNs. Incorrect proxy configuration can lead to security vulnerabilities, including IP spoofing and logging incorrect client IPs.

## Security Requirements

### IP Address Handling

**CRITICAL**: The application trusts `request.remote_addr` for client IP addresses. When deployed behind a proxy:

1. **Firewall Configuration Required**: The application server MUST only accept connections from trusted proxy IPs
2. **ProxyFix Middleware Required**: Werkzeug's ProxyFix middleware MUST be configured with the correct number of trusted proxies
3. **X-Forwarded-For Validation**: The middleware validates and normalizes forwarded headers

### Threat Model

**Without proper proxy configuration**, an attacker can:
- Spoof their IP address by sending malicious `X-Forwarded-For` headers
- Bypass rate limiting and IP-based security controls
- Evade security monitoring and audit logs
- Impersonate other users for IP-based authorization

## Deployment Configurations

### Configuration 1: Direct Deployment (No Proxy)

**Environment**: Development, simple production deployments

```bash
# .env
TRUSTED_PROXY_COUNT=0  # Default - no proxies
```

**Infrastructure**:
```
Internet → Flask App (Port 5000)
```

**Firewall**: Allow direct connections from all clients

**IP Detection**: Uses `request.remote_addr` (direct connection IP)

---

### Configuration 2: Single Reverse Proxy

**Environment**: nginx, Apache, or single load balancer

```bash
# .env
TRUSTED_PROXY_COUNT=1
ENABLE_PROXY_FIX=true
```

**Infrastructure**:
```
Internet → nginx/Apache/ALB (10.0.1.5) → Flask App (127.0.0.1:5000)
```

**Firewall Rules** (REQUIRED):
```bash
# Only allow connections from the trusted proxy
iptables -A INPUT -p tcp --dport 5000 -s 10.0.1.5 -j ACCEPT
iptables -A INPUT -p tcp --dport 5000 -j DROP

# Or with ufw
ufw allow from 10.0.1.5 to any port 5000
ufw deny 5000
```

**nginx Configuration Example**:
```nginx
server {
    listen 80;
    server_name brewtracker.example.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**IP Detection Flow**:
```
Client (203.0.113.42) → Proxy adds X-Forwarded-For: 203.0.113.42
→ ProxyFix trusts 1 proxy → request.remote_addr = 203.0.113.42
```

---

### Configuration 3: CDN + Load Balancer

**Environment**: Cloudflare/CloudFront + AWS ALB, multiple proxy layers

```bash
# .env
TRUSTED_PROXY_COUNT=2  # CDN + ALB
ENABLE_PROXY_FIX=true
```

**Infrastructure**:
```
Internet → Cloudflare (CDN) → AWS ALB (10.0.1.5) → Flask App (10.0.2.10:5000)
```

**Firewall Rules** (REQUIRED):
```bash
# Only allow connections from ALB
iptables -A INPUT -p tcp --dport 5000 -s 10.0.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 5000 -j DROP
```

**IP Detection Flow**:
```
Client (203.0.113.42)
→ CDN adds: X-Forwarded-For: 203.0.113.42
→ ALB adds: X-Forwarded-For: 203.0.113.42, <cdn-ip>
→ ProxyFix trusts 2 proxies → request.remote_addr = 203.0.113.42
```

**Cloudflare Specific**:
```bash
# Optional: Use Cloudflare's CF-Connecting-IP header
# Add to nginx config:
# proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
```

---

### Configuration 4: Multiple Load Balancers

**Environment**: Complex production with multiple proxy tiers

```bash
# .env
TRUSTED_PROXY_COUNT=3  # Internet LB + Internal LB + App Proxy
ENABLE_PROXY_FIX=true
```

**Infrastructure**:
```
Internet → Public LB (1.2.3.4) → Private LB (10.0.1.5) → App Proxy (10.0.2.10) → Flask (10.0.3.20:5000)
```

**Firewall Rules** (REQUIRED):
```bash
# Only allow from app proxy subnet
iptables -A INPUT -p tcp --dport 5000 -s 10.0.2.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 5000 -j DROP
```

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_PROXY_FIX` | No | `false` | Enable ProxyFix middleware (set to `true` when behind proxies) |
| `TRUSTED_PROXY_COUNT` | No | `0` | Number of trusted proxies in the chain |
| `TRUSTED_PROXY_HOST_COUNT` | No | `0` | Number of trusted proxies for Host header (usually same as TRUSTED_PROXY_COUNT) |
| `TRUSTED_PROXY_PROTO_COUNT` | No | `0` | Number of trusted proxies for X-Forwarded-Proto (usually same as TRUSTED_PROXY_COUNT) |

### ProxyFix Parameters

The middleware is configured with:
```python
ProxyFix(
    app,
    x_for=TRUSTED_PROXY_COUNT,        # X-Forwarded-For validation
    x_host=TRUSTED_PROXY_HOST_COUNT,  # X-Forwarded-Host validation
    x_proto=TRUSTED_PROXY_PROTO_COUNT # X-Forwarded-Proto validation
)
```

## Validation and Testing

### 1. Verify Proxy Configuration

```bash
# Check environment variables
echo $TRUSTED_PROXY_COUNT
echo $ENABLE_PROXY_FIX

# Verify in application logs
grep "ProxyFix middleware enabled" logs/app.log
```

### 2. Test IP Detection

```bash
# Send test request with forged X-Forwarded-For
curl -H "X-Forwarded-For: 1.2.3.4" https://your-app.com/api/health

# Check logs to verify IP is NOT spoofed
grep "Request from IP" logs/security.log
```

### 3. Expected Behavior

**Without ProxyFix (TRUSTED_PROXY_COUNT=0)**:
- Direct connection: `request.remote_addr` = actual client IP ✅
- Behind proxy: `request.remote_addr` = proxy IP (incorrect) ❌

**With ProxyFix (TRUSTED_PROXY_COUNT=1)**:
- Behind 1 proxy + firewall: `request.remote_addr` = actual client IP ✅
- Malicious X-Forwarded-For without proxy: Blocked by firewall ✅

## Security Checklist

Before deploying to production:

- [ ] **Identify proxy count**: How many proxies/load balancers are in the path?
- [ ] **Set TRUSTED_PROXY_COUNT**: Match the exact number of trusted proxies
- [ ] **Enable ProxyFix**: Set `ENABLE_PROXY_FIX=true`
- [ ] **Configure firewall**: Block direct connections to Flask app
- [ ] **Whitelist proxy IPs**: Only allow connections from trusted proxy IPs
- [ ] **Test IP spoofing**: Verify malicious X-Forwarded-For headers are rejected
- [ ] **Review logs**: Confirm correct client IPs in security logs
- [ ] **Test rate limiting**: Verify rate limits apply per client IP, not proxy IP
- [ ] **Document architecture**: Update this file with your specific proxy configuration

## Common Mistakes

### ❌ Mistake 1: Trusting X-Forwarded-For without ProxyFix
```python
# INSECURE - Can be spoofed!
client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0]
```

### ✅ Correct: Use request.remote_addr with ProxyFix
```python
# SECURE - ProxyFix normalizes remote_addr
client_ip = request.remote_addr
```

---

### ❌ Mistake 2: Enabling ProxyFix without firewall rules
```bash
# Flask app accessible from internet
ENABLE_PROXY_FIX=true  # Attacker can spoof IPs!
```

### ✅ Correct: ProxyFix + Firewall + Correct count
```bash
ENABLE_PROXY_FIX=true
TRUSTED_PROXY_COUNT=1
# Plus: Firewall rules blocking direct connections
```

---

### ❌ Mistake 3: Wrong proxy count
```bash
# 2 proxies in chain (CDN + LB), but configured for 1
TRUSTED_PROXY_COUNT=1  # Will get CDN IP, not client IP
```

### ✅ Correct: Match actual infrastructure
```bash
# CDN + LB = 2 proxies
TRUSTED_PROXY_COUNT=2
```

## GDPR and Privacy Compliance

### Data Processing

Client IP addresses are processed for:
1. **Security monitoring**: Rate limiting, brute force detection, audit logs
2. **Failed login tracking**: Associated with device tokens for security monitoring
3. **Audit trails**: Logged in security logs for compliance and investigation

### Legal Basis

IP address processing is justified under:
- **Legitimate Interest** (GDPR Art. 6(1)(f)): Security and fraud prevention
- **Legal Obligation** (GDPR Art. 6(1)(c)): Security logging for compliance

### Data Retention

- **Security logs**: Retained for 90 days (configurable)
- **Failed login attempts**: In-memory only, cleared after rate limit window (30 minutes)
- **Audit logs**: Retained for 1 year (configurable for compliance)

### User Rights

Users can request:
- **Access**: View logs containing their IP address
- **Erasure**: Deletion of IP-based logs (subject to legal retention requirements)

### Privacy Policy

Ensure your privacy policy documents:
- Collection of IP addresses for security purposes
- Retention periods for security logs
- Legal basis for processing (legitimate interest)
- User rights under GDPR (access, erasure, portability)

**Privacy Policy Location**: `[SPECIFY YOUR PRIVACY POLICY URL]`
**Data Protection Contact**: `[SPECIFY DPO/PRIVACY CONTACT]`

## Monitoring

### Key Metrics to Monitor

```python
# IP distribution (detect proxy misconfigurations)
SELECT ip_address, COUNT(*) FROM security_logs
WHERE timestamp > NOW() - INTERVAL 1 HOUR
GROUP BY ip_address
ORDER BY COUNT(*) DESC;

# If you see proxy IPs instead of client IPs, TRUSTED_PROXY_COUNT is wrong
```

### Alerts to Configure

1. **Single IP with high request volume**: May indicate proxy misconfiguration
2. **Localhost IPs in production logs**: Definitely a misconfiguration
3. **Private IP ranges (10.x, 192.168.x)**: Proxy count is incorrect

## Troubleshooting

### Problem: Logs show proxy IP instead of client IP

**Diagnosis**:
```bash
# Check if ProxyFix is enabled
grep "ProxyFix" logs/app.log

# Check current configuration
echo $TRUSTED_PROXY_COUNT
```

**Solution**:
1. Verify proxy count in your infrastructure
2. Set `TRUSTED_PROXY_COUNT` to match
3. Enable ProxyFix: `ENABLE_PROXY_FIX=true`
4. Restart application

---

### Problem: Rate limiting blocks all users

**Diagnosis**: All requests appear from same IP (proxy IP)

**Solution**: Same as above - configure ProxyFix correctly

---

### Problem: Security logs show spoofed IPs

**Diagnosis**: Firewall not restricting direct connections

**Solution**:
1. Verify firewall rules are active
2. Only allow connections from trusted proxy IPs
3. Test by sending direct connection (should be blocked)

## References

- [Werkzeug ProxyFix Documentation](https://werkzeug.palletsprojects.com/en/latest/middleware/proxy_fix/)
- [OWASP: IP Address Spoofing](https://owasp.org/www-community/attacks/IP_Address_Spoofing)
- [GDPR Article 6: Lawfulness of Processing](https://gdpr-info.eu/art-6-gdpr/)
- [Flask Deployment Options](https://flask.palletsprojects.com/en/latest/deploying/)

## Support

For questions or issues with proxy configuration:
1. Review this document thoroughly
2. Check `SECURITY_CONFIG.md` for additional security settings
3. Verify firewall configuration with your infrastructure team
4. Test with the validation steps above
