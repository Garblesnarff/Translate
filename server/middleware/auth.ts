/**
 * API Key Authentication Middleware (Phase 4.1.1)
 *
 * Supports:
 * - Authorization: Bearer <api-key> header
 * - ?api_key=<key> query parameter (less secure, warn in docs)
 * - Validates API keys against database
 * - Tracks API key usage (requests, last used)
 * - Returns 401 Unauthorized if missing/invalid
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "@db/index";
import { getTables } from "@db/config";
import type { ApiKey } from "@db/schema";
import { eq } from "drizzle-orm";
import { AuditLogger, AuditEventType } from "../services/audit/AuditLogger";

// Extend Express Request type to include authenticated API key
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      apiKeyId?: string;
      userId?: string;
      permissions?: string[];
    }
  }
}

export interface AuthMiddlewareOptions {
  required?: boolean; // If false, authentication is optional
  permissions?: string[]; // Required permissions (e.g., ['translate', 'admin'])
}

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
  // Method 1: Authorization header (preferred)
  const authHeader = req.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }

  // Method 2: Query parameter (less secure, for backwards compatibility)
  const queryKey = req.query.api_key as string;
  if (queryKey) {
    // Log warning about less secure method
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[auth] API key passed in query parameter. Use Authorization header for better security."
      );
    }
    return queryKey;
  }

  return null;
}

/**
 * Validate API key against database
 */
async function validateApiKey(key: string): Promise<ApiKey | null> {
  try {
    const { apiKeys } = getTables();
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1);

    if (!apiKey) {
      return null;
    }

    // Check if revoked
    if (apiKey.revoked) {
      return null;
    }

    // Check if expired
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    return apiKey;
  } catch (error) {
    console.error("[auth] Error validating API key:", error);
    return null;
  }
}

/**
 * Update API key usage tracking
 */
async function trackApiKeyUsage(apiKeyId: string): Promise<void> {
  try {
    const { apiKeys } = getTables();
    // Handle timestamp for both PostgreSQL and SQLite
    const lastUsedAt = process.env.DATABASE_URL?.startsWith("postgresql")
      ? new Date()
      : new Date().toISOString();

    // Note: Incrementing requestsCount would require a raw SQL query or select-then-update
    // For now, we'll just update the lastUsedAt timestamp
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: lastUsedAt as any,
      })
      .where(eq(apiKeys.id, apiKeyId));
  } catch (error) {
    // Don't fail request if tracking fails
    console.error("[auth] Error tracking API key usage:", error);
  }
}

/**
 * Check if API key has required permissions
 */
function hasPermissions(
  apiKey: ApiKey,
  requiredPermissions: string[]
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  const keyPermissions = JSON.parse(apiKey.permissions) as string[];

  // Admin permission grants all access
  if (keyPermissions.includes("admin")) {
    return true;
  }

  // Check if all required permissions are present
  return requiredPermissions.every((perm) => keyPermissions.includes(perm));
}

/**
 * API Key Authentication Middleware
 */
export function authenticate(options: AuthMiddlewareOptions = {}) {
  const { required = true, permissions = [] } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract API key from request
      const apiKeyValue = extractApiKey(req);

      // If no API key provided
      if (!apiKeyValue) {
        if (required) {
          await AuditLogger.log({
            eventType: AuditEventType.AUTH_MISSING,
            success: false,
            req,
            details: { path: req.path },
          });

          return res.status(401).json({
            error: "Unauthorized",
            message: "API key required. Provide via Authorization header or ?api_key= parameter.",
          });
        } else {
          // Optional authentication - continue without key
          return next();
        }
      }

      // Validate API key
      const apiKey = await validateApiKey(apiKeyValue);

      if (!apiKey) {
        await AuditLogger.logAuthFailure("Invalid or expired API key", req, {
          keyPrefix: apiKeyValue.substring(0, 8) + "...",
        });

        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid or expired API key.",
        });
      }

      // Check permissions
      if (!hasPermissions(apiKey, permissions)) {
        await AuditLogger.logPermissionDenied(
          apiKey.id,
          req.path,
          req.method,
          req
        );

        return res.status(403).json({
          error: "Forbidden",
          message: `Insufficient permissions. Required: ${permissions.join(", ")}`,
        });
      }

      // Attach API key info to request
      req.apiKey = apiKey;
      req.apiKeyId = apiKey.id;
      req.userId = apiKey.userId || undefined;
      req.permissions = JSON.parse(apiKey.permissions);

      // Track usage (async, don't wait)
      trackApiKeyUsage(apiKey.id).catch(() => {});

      // Log successful authentication
      await AuditLogger.logAuthSuccess(apiKey.id, apiKey.userId || undefined, req);

      next();
    } catch (error) {
      console.error("[auth] Authentication error:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Authentication failed.",
      });
    }
  };
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required.",
      });
    }

    if (!hasPermissions(req.apiKey, requiredPermissions)) {
      AuditLogger.logPermissionDenied(
        req.apiKey.id,
        req.path,
        req.method,
        req
      );

      return res.status(403).json({
        error: "Forbidden",
        message: `Insufficient permissions. Required: ${requiredPermissions.join(", ")}`,
      });
    }

    next();
  };
}

/**
 * Optional authentication (doesn't fail if no key provided)
 */
export const optionalAuth = authenticate({ required: false });

/**
 * Admin-only authentication
 */
export const requireAdmin = authenticate({ permissions: ["admin"] });
