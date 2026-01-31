# Security Middleware Usage Guide

This guide shows how to use the Phase 4.1 security middleware in your routes.

## Quick Start

```typescript
import { authenticate, requirePermission } from './middleware/auth';
import { standardRateLimiter, strictRateLimiter } from './middleware/rateLimit';
import { sanitizeRequest } from './middleware/sanitize';

// Apply to all /api routes
app.use('/api', authenticate());
app.use('/api', standardRateLimiter);
app.use('/api', sanitizeRequest());
```

## Middleware Overview

| Middleware | Purpose | Usage |
|------------|---------|-------|
| `authenticate()` | API key authentication | Required for protected routes |
| `standardRateLimiter` | 100 req/hour limit | Default rate limiting |
| `sanitizeRequest()` | Input sanitization | Sanitize body, query, files |

## Example Routes

### Basic Protected Route

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/rateLimit';
import { sanitizeRequest } from '../middleware/sanitize';

const router = Router();

// Single translation endpoint
router.post('/translate',
  authenticate(), // Require API key
  standardRateLimiter, // 100 req/hour
  sanitizeRequest(), // Sanitize inputs
  async (req, res) => {
    // req.apiKey is now available
    // req.body is sanitized
    // Rate limited to 100 req/hour
    const { text } = req.body;
    // ... translation logic
  }
);
```

### Permission-Based Route

```typescript
import { authenticate, requirePermission } from '../middleware/auth';

// Admin-only endpoint
router.post('/admin/settings',
  authenticate({ permissions: ['admin'] }),
  async (req, res) => {
    // Only accessible with admin permission
  }
);

// Or use requirePermission middleware
router.post('/batch/translate',
  authenticate(),
  requirePermission('jobs'), // Requires 'jobs' permission
  async (req, res) => {
    // ...
  }
);
```

### Optional Authentication

```typescript
import { optionalAuth } from '../middleware/auth';

// Public endpoint with optional authentication
router.get('/status',
  optionalAuth, // Authentication optional
  async (req, res) => {
    if (req.apiKey) {
      // Authenticated user - show detailed status
    } else {
      // Anonymous user - show basic status
    }
  }
);
```

### Rate Limiting Variants

```typescript
import {
  standardRateLimiter,
  strictRateLimiter,
  permissiveRateLimiter,
  burstRateLimiter,
  createRateLimiter,
} from '../middleware/rateLimit';

// Standard: 100 req/hour
router.post('/translate', standardRateLimiter, handler);

// Strict: 20 req/hour (expensive operations)
router.post('/batch/translate', strictRateLimiter, handler);

// Permissive: 500 req/hour (public endpoints)
router.get('/public/status', permissiveRateLimiter, handler);

// Burst: 10 req/minute
router.post('/quick-action', burstRateLimiter, handler);

// Custom: 50 req/10min
router.post('/custom',
  createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 50,
    message: 'Custom rate limit exceeded',
  }),
  handler
);
```

### Input Sanitization Options

```typescript
import { sanitizeBody, sanitizeQuery, validateFileUpload, sanitizeRequest } from '../middleware/sanitize';

// Sanitize body only
router.post('/translate',
  sanitizeBody({ allowHtml: false }),
  handler
);

// Sanitize query parameters
router.get('/search',
  sanitizeQuery(),
  handler
);

// Validate file uploads
router.post('/upload',
  validateFileUpload(),
  handler
);

// All sanitization (recommended)
router.post('/submit',
  sanitizeRequest({
    allowHtml: false,
    maxBodySize: 1024 * 1024, // 1MB
    maxStringLength: 1024 * 1024,
    checkSuspiciousPatterns: true,
  }),
  handler
);
```

## Complete Example

```typescript
import express from 'express';
import { authenticate, requireAdmin } from './middleware/auth';
import { standardRateLimiter, strictRateLimiter } from './middleware/rateLimit';
import { sanitizeRequest } from './middleware/sanitize';

const app = express();

// Global middleware (applied to all routes)
app.use(express.json());

// Public routes (no authentication)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Protected API routes
const apiRouter = express.Router();

// Apply security middleware to all /api routes
apiRouter.use(authenticate());
apiRouter.use(standardRateLimiter);
apiRouter.use(sanitizeRequest());

// Translation routes
apiRouter.post('/translate', async (req, res) => {
  // Authenticated, rate limited, sanitized
  const { text } = req.body;
  // ... translation logic
});

apiRouter.post('/batch/translate',
  requirePermission('jobs'),
  strictRateLimiter, // Override with stricter limit
  async (req, res) => {
    // Requires 'jobs' permission + strict rate limit
  }
);

// Admin routes
apiRouter.post('/admin/api-keys',
  requireAdmin, // Requires admin permission
  async (req, res) => {
    // Create API key
  }
);

// Mount API router
app.use('/api', apiRouter);

// Start server
app.listen(5439, () => {
  console.log('Server running on port 5439');
});
```

## Accessing Request Context

After authentication, the request object contains:

```typescript
req.apiKey      // Full API key object from database
req.apiKeyId    // API key ID (UUID)
req.userId      // User ID (if associated with API key)
req.permissions // Array of permissions ['translate', 'jobs']
```

Example:

```typescript
router.post('/translate', authenticate(), async (req, res) => {
  console.log('API Key:', req.apiKey.name);
  console.log('Permissions:', req.permissions);
  console.log('User ID:', req.userId);

  if (req.permissions.includes('admin')) {
    // Admin user - no rate limits
  }
});
```

## Error Handling

All middleware returns standard error responses:

### 401 Unauthorized (Missing/Invalid API Key)

```json
{
  "error": "Unauthorized",
  "message": "API key required. Provide via Authorization header or ?api_key= parameter."
}
```

### 403 Forbidden (Insufficient Permissions)

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions. Required: admin"
}
```

### 429 Too Many Requests (Rate Limit Exceeded)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per hour.",
  "retryAfter": "3600"
}
```

### 413 Payload Too Large (Input Size Limit)

```json
{
  "error": "Payload Too Large",
  "message": "Request body exceeds maximum size of 1048576 bytes."
}
```

### 400 Bad Request (Invalid Input)

```json
{
  "error": "Bad Request",
  "message": "Invalid request body."
}
```

## Testing

### Test Authentication

```bash
# Valid API key
curl -H "Authorization: Bearer tk_your_key_here" \
  http://localhost:5439/api/translate

# Invalid API key
curl -H "Authorization: Bearer invalid_key" \
  http://localhost:5439/api/translate
# Returns: 401 Unauthorized

# Missing API key
curl http://localhost:5439/api/translate
# Returns: 401 Unauthorized
```

### Test Rate Limiting

```bash
# Send 101 requests to exceed limit
for i in {1..101}; do
  curl -H "Authorization: Bearer tk_your_key_here" \
    http://localhost:5439/api/translate
done
# Last request returns: 429 Too Many Requests
```

### Test Input Sanitization

```bash
# XSS attempt (will be sanitized)
curl -H "Authorization: Bearer tk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"text":"<script>alert(1)</script>"}' \
  http://localhost:5439/api/translate
# Script tags removed, logged as suspicious

# SQL injection attempt (will be logged)
curl -H "Authorization: Bearer tk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"text":"SELECT * FROM users WHERE 1=1"}' \
  http://localhost:5439/api/translate
# Logged as suspicious input
```

## Best Practices

1. **Always authenticate** - Use `authenticate()` on all API routes
2. **Apply rate limiting** - Prevent abuse with appropriate limits
3. **Sanitize inputs** - Use `sanitizeRequest()` to clean all user input
4. **Use least privilege** - Request minimum required permissions
5. **Monitor audit logs** - Review security events regularly
6. **Handle errors gracefully** - Provide clear error messages
7. **Test security** - Verify authentication, rate limiting, and sanitization

## Migration from Unprotected Routes

Before:
```typescript
app.post('/api/translate', async (req, res) => {
  const { text } = req.body;
  // ... translation logic
});
```

After:
```typescript
app.post('/api/translate',
  authenticate(),
  standardRateLimiter,
  sanitizeRequest(),
  async (req, res) => {
    const { text } = req.body; // Now sanitized
    // req.apiKey available
    // Rate limited
    // ... translation logic
  }
);
```

## Production Deployment

For production with multiple server instances:

1. **Use Redis for rate limiting**
2. **Configure proper CORS**
3. **Enable HTTPS**
4. **Set up monitoring**
5. **Configure audit log alerts**

See `SECURITY.md` for full production deployment guide.
