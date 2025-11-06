# Security Guide - Tibetan Translation Tool

This document describes the security features implemented in Phase 4.1: Security & Authentication.

## Table of Contents

1. [API Key Authentication](#api-key-authentication)
2. [Rate Limiting](#rate-limiting)
3. [Input Sanitization](#input-sanitization)
4. [Audit Logging](#audit-logging)
5. [Secret Management](#secret-management)
6. [Best Practices](#best-practices)

---

## API Key Authentication

All API endpoints require authentication via API keys.

### Creating an API Key

Use the provided script to generate API keys:

```bash
# Basic API key with translate permission
tsx server/scripts/generateApiKey.ts --name "My App" --permissions translate

# API key with multiple permissions
tsx server/scripts/generateApiKey.ts --name "My App" --permissions translate,jobs

# Admin API key (full access)
tsx server/scripts/generateApiKey.ts --name "Admin" --permissions admin

# Custom rate limit
tsx server/scripts/generateApiKey.ts --name "High Volume App" --permissions translate --rate-limit 1000

# Expiring key (90 days)
tsx server/scripts/generateApiKey.ts --name "Temp Key" --permissions translate --expires-in-days 90
```

### Using API Keys

**Method 1: Authorization Header (Recommended)**

```bash
curl -H "Authorization: Bearer tk_your_api_key_here" \
  http://localhost:5439/api/translate
```

**Method 2: Query Parameter (Less Secure)**

```bash
curl "http://localhost:5439/api/translate?api_key=tk_your_api_key_here"
```

**Note:** Query parameter method is less secure as keys may be logged in server logs and browser history.

### Permissions

Available permissions:

- `translate` - Access translation endpoints
- `jobs` - Access batch job endpoints
- `admin` - Full access to all endpoints

API keys can have multiple permissions. Admin permission grants access to everything.

### Key Management

API keys track:
- Request count
- Last used timestamp
- Expiration date
- Revocation status

---

## Rate Limiting

Rate limiting prevents API abuse and ensures fair usage.

### Rate Limit Tiers

| Tier | Limit | Use Case |
|------|-------|----------|
| Standard | 100 req/hour | Default for all API keys |
| Strict | 20 req/hour | Expensive operations (batch jobs) |
| Permissive | 500 req/hour | Public endpoints |
| Burst | 10 req/minute | Short-term spike protection |

### Rate Limit Headers

Response includes rate limit information:

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1635724800
```

### Rate Limit Exceeded Response

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per hour.",
  "retryAfter": "3600"
}
```

### Custom Rate Limits

API keys can have custom rate limits. Contact admin to increase limits.

### Admin Bypass

API keys with `admin` permission bypass rate limiting.

---

## Input Sanitization

All user inputs are automatically sanitized to prevent security vulnerabilities.

### Protections

1. **XSS Prevention** - HTML tags removed/escaped
2. **SQL Injection** - Suspicious patterns detected and logged
3. **Path Traversal** - Directory traversal patterns blocked
4. **Command Injection** - Shell metacharacters filtered
5. **Size Limits** - Request body limited to 1MB by default

### File Upload Validation

File uploads are strictly validated:

- **Allowed Types:** PDF only
- **Max Size:** 50MB
- **MIME Type Check:** Verified server-side
- **Extension Check:** Must be `.pdf`

### Suspicious Input Detection

The system monitors for suspicious patterns and logs them for review:

- SQL keywords (`SELECT`, `DROP`, `UNION`, etc.)
- XSS patterns (`<script>`, `javascript:`, etc.)
- Path traversal (`../`, `..\\`)
- Command injection (`;`, `|`, `` ` ``, etc.)

Suspicious inputs are logged but not automatically rejected (to avoid false positives).

---

## Audit Logging

All security-relevant events are logged to the database and console.

### Logged Events

- ✅ Authentication success/failure
- 🔑 API key creation/deletion/revocation
- 🚫 Rate limit violations
- ⚠️ Input validation failures
- 🛡️ Permission denied events
- 👤 Admin actions
- 🚨 Security incidents

### Event Types

```typescript
enum AuditEventType {
  AUTH_SUCCESS = "auth_success",
  AUTH_FAILURE = "auth_failure",
  AUTH_MISSING = "auth_missing",
  AUTH_INVALID = "auth_invalid",
  AUTH_EXPIRED = "auth_expired",
  API_KEY_CREATED = "api_key_created",
  API_KEY_DELETED = "api_key_deleted",
  API_KEY_REVOKED = "api_key_revoked",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  INPUT_VALIDATION_FAILED = "input_validation_failed",
  SUSPICIOUS_INPUT = "suspicious_input",
  PERMISSION_DENIED = "permission_denied",
  SECURITY_INCIDENT = "security_incident",
}
```

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  event_type TEXT NOT NULL,
  user_id TEXT,
  api_key_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  resource TEXT,
  action TEXT,
  success INTEGER NOT NULL,
  details TEXT
);
```

### Security Alerts

Critical events trigger console alerts:

```
🚨 [SECURITY ALERT] {
  eventType: 'suspicious_input',
  timestamp: '2025-11-06T12:00:00Z',
  ip: '192.168.1.100',
  resource: '/api/translate',
  details: { pattern: 'SQL injection attempt' }
}
```

In production, these should be forwarded to:
- Email notifications
- Slack webhooks
- PagerDuty
- Security monitoring (Datadog, Sentry)

---

## Secret Management

Secrets are managed via environment variables.

### Required Secrets

```bash
# Gemini API keys (dual setup for odd/even pages)
GEMINI_API_KEY_ODD=your_key_here
GEMINI_API_KEY_EVEN=your_key_here

# Session secret (min 32 characters)
SESSION_SECRET=your_random_secret_here

# API key encryption key (min 32 characters)
API_KEY_ENCRYPTION_KEY=your_random_key_here
```

### Optional Secrets

```bash
# Database (PostgreSQL for production)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis (for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Additional AI providers
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

### Generate Secure Secrets

```bash
# Generate random secret (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Secret Validation

Secrets are validated on startup. Missing or invalid secrets will prevent the server from starting:

```
[secrets] Configuration validation failed:
  - SESSION_SECRET: Required
  - API_KEY_ENCRYPTION_KEY: String must contain at least 32 character(s)
```

### Secret Masking

Secrets are masked in logs:

```
[secrets] Configuration loaded:
  GEMINI_API_KEY_ODD: AIza...tEas
  SESSION_SECRET: 7685...05aa
```

---

## Best Practices

### For API Consumers

1. **Store keys securely** - Use environment variables, never commit to git
2. **Rotate keys regularly** - Generate new keys every 90 days
3. **Use Authorization header** - Avoid query parameters
4. **Monitor rate limits** - Check `RateLimit-*` headers
5. **Handle errors gracefully** - Implement exponential backoff for 429 errors

### For Administrators

1. **Review audit logs** - Check for suspicious activity daily
2. **Set up alerts** - Configure notifications for security events
3. **Limit permissions** - Grant minimum required permissions
4. **Revoke unused keys** - Clean up old/unused API keys
5. **Monitor rate limits** - Adjust limits based on usage patterns

### For Developers

1. **Never log secrets** - Use masking functions
2. **Validate all inputs** - Use sanitization middleware
3. **Follow least privilege** - Request minimum permissions
4. **Use prepared statements** - Prevent SQL injection
5. **Keep dependencies updated** - Run `npm audit` regularly

---

## Security Checklist

- [ ] Environment variables configured
- [ ] API keys generated and stored securely
- [ ] Rate limiting tested
- [ ] Input sanitization verified
- [ ] Audit logs reviewed
- [ ] Security alerts configured
- [ ] HTTPS enabled (production)
- [ ] Database backups configured
- [ ] Redis configured (if using multiple instances)
- [ ] Security monitoring integrated

---

## Reporting Security Issues

If you discover a security vulnerability, please email security@example.com.

**Do not** open a public GitHub issue for security vulnerabilities.

---

## Compliance

This implementation follows:

- OWASP Top 10 security guidelines
- NIST Cybersecurity Framework
- ISO 27001 best practices

---

## Future Enhancements

Planned security improvements:

1. **OAuth 2.0 Support** - Third-party authentication
2. **2FA for Admin Keys** - Multi-factor authentication
3. **IP Whitelisting** - Restrict access by IP
4. **Webhook Signatures** - Verify webhook authenticity
5. **Automatic Key Rotation** - Scheduled key rotation
6. **Security Headers** - CSP, HSTS, X-Frame-Options
7. **DDoS Protection** - Cloudflare integration
8. **Encryption at Rest** - Database encryption

---

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
