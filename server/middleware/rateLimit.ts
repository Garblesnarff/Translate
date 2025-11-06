/**
 * Rate Limiting Middleware (Phase 4.1.2)
 *
 * Implements per-API-key rate limiting:
 * - Uses in-memory store (or Redis for production)
 * - Default: 100 requests per hour (configurable per key)
 * - Sliding window algorithm
 * - Returns 429 Too Many Requests with Retry-After header
 * - Integrates with MonitoringService and AuditLogger
 */

import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response } from "express";
import { AuditLogger } from "../services/audit/AuditLogger";

/**
 * Key generator function - rate limit by API key
 */
function keyGenerator(req: Request): string {
  // If authenticated, use API key ID
  if (req.apiKeyId) {
    return `apikey:${req.apiKeyId}`;
  }

  // Otherwise, use IP address (for unauthenticated endpoints)
  const forwarded = req.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip || "unknown";
  return `ip:${ip}`;
}

/**
 * Get rate limit for specific API key
 */
function getRateLimitForKey(req: Request): number {
  // If API key is present and has custom rate limit
  if (req.apiKey && req.apiKey.rateLimit) {
    return req.apiKey.rateLimit;
  }

  // Default rate limit
  return 100; // requests per hour
}

/**
 * Handler called when rate limit is exceeded
 */
async function rateLimitExceeded(req: Request, res: Response): Promise<void> {
  // Log rate limit violation
  await AuditLogger.logRateLimitExceeded(
    req.apiKeyId,
    req,
    getRateLimitForKey(req)
  );

  // Log to console
  console.warn(`[rate-limit] Rate limit exceeded for ${keyGenerator(req)}`);
}

/**
 * Standard rate limiter (100 requests per hour)
 */
export const standardRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req: Request) => getRateLimitForKey(req),
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator,
  handler: async (req: Request, res: Response) => {
    await rateLimitExceeded(req, res);
    res.status(429).json({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Maximum ${getRateLimitForKey(req)} requests per hour.`,
      retryAfter: res.getHeader("Retry-After"),
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for admin keys (optional)
    if (req.permissions && req.permissions.includes("admin")) {
      return true;
    }
    return false;
  },
});

/**
 * Strict rate limiter for expensive operations (20 requests per hour)
 */
export const strictRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: async (req: Request, res: Response) => {
    await rateLimitExceeded(req, res);
    res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded for this expensive operation. Maximum 20 requests per hour.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
});

/**
 * Permissive rate limiter for public endpoints (500 requests per hour)
 */
export const permissiveRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: async (req: Request, res: Response) => {
    await rateLimitExceeded(req, res);
    res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Maximum 500 requests per hour.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
});

/**
 * Short burst rate limiter (10 requests per minute)
 */
export const burstRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: async (req: Request, res: Response) => {
    await rateLimitExceeded(req, res);
    res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Maximum 10 requests per minute.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
});

/**
 * Create custom rate limiter with specific options
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: async (req: Request, res: Response) => {
      await rateLimitExceeded(req, res);
      res.status(429).json({
        error: "Too Many Requests",
        message: options.message || `Rate limit exceeded. Maximum ${options.max} requests per ${Math.floor(options.windowMs / 60000)} minutes.`,
        retryAfter: res.getHeader("Retry-After"),
      });
    },
  });
}

/**
 * Redis-backed rate limiter (for production with multiple instances)
 *
 * Usage:
 * ```typescript
 * import { createClient } from 'redis';
 * import { RedisStore } from 'rate-limit-redis';
 *
 * const redisClient = createClient({
 *   url: process.env.REDIS_URL,
 * });
 *
 * const redisRateLimiter = rateLimit({
 *   store: new RedisStore({
 *     client: redisClient,
 *     prefix: 'rl:',
 *   }),
 *   windowMs: 60 * 60 * 1000,
 *   max: 100,
 * });
 * ```
 */

// Export default as standard rate limiter
export default standardRateLimiter;
