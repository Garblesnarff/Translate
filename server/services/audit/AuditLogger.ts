/**
 * Audit Logger Service (Phase 4.1.4)
 *
 * Logs all security-relevant events:
 * - Authentication attempts (success/failure)
 * - API key creation/deletion/revocation
 * - Rate limit violations
 * - Input validation failures
 * - Permission denied events
 * - Administrative actions
 */

import { db } from "@db/index";
import { getTables } from "@db/config";
import type { InsertAuditLog } from "@db/schema";
import { v4 as uuidv4 } from "uuid";
import type { Request } from "express";

export enum AuditEventType {
  // Authentication events
  AUTH_SUCCESS = "auth_success",
  AUTH_FAILURE = "auth_failure",
  AUTH_MISSING = "auth_missing",
  AUTH_INVALID = "auth_invalid",
  AUTH_EXPIRED = "auth_expired",

  // API key management
  API_KEY_CREATED = "api_key_created",
  API_KEY_DELETED = "api_key_deleted",
  API_KEY_REVOKED = "api_key_revoked",
  API_KEY_ROTATED = "api_key_rotated",

  // Rate limiting
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  RATE_LIMIT_WARNING = "rate_limit_warning",

  // Input validation
  INPUT_VALIDATION_FAILED = "input_validation_failed",
  INPUT_SANITIZATION = "input_sanitization",
  SUSPICIOUS_INPUT = "suspicious_input",

  // Authorization
  PERMISSION_DENIED = "permission_denied",
  UNAUTHORIZED_ACCESS = "unauthorized_access",

  // Administrative actions
  ADMIN_ACTION = "admin_action",
  CONFIG_CHANGED = "config_changed",

  // Security incidents
  SECURITY_INCIDENT = "security_incident",
  POTENTIAL_ATTACK = "potential_attack",
}

export interface AuditLogData {
  eventType: AuditEventType;
  userId?: string;
  apiKeyId?: string;
  resource?: string;
  action?: string;
  success: boolean;
  details?: Record<string, any>;
  req?: Request;
}

export class AuditLogger {
  /**
   * Log a security event
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      // Handle timestamp for both PostgreSQL and SQLite
      const timestamp = process.env.DATABASE_URL?.startsWith("postgresql")
        ? new Date()
        : new Date().toISOString();

      const logEntry: InsertAuditLog = {
        id: uuidv4(),
        timestamp: timestamp as any,
        eventType: data.eventType,
        userId: data.userId,
        apiKeyId: data.apiKeyId,
        ipAddress: data.req ? this.getClientIp(data.req) : undefined,
        userAgent: data.req?.get("user-agent"),
        resource: data.resource,
        action: data.action,
        success: data.success ? 1 : 0,
        details: data.details ? JSON.stringify(data.details) : undefined,
      };

      const { auditLogs } = getTables();
      await db.insert(auditLogs).values(logEntry);

      // Log to console in development
      if (process.env.NODE_ENV === "development") {
        const logLevel = data.success ? "info" : "warn";
        console.log(`[audit:${logLevel}] ${data.eventType}:`, {
          success: data.success,
          userId: data.userId,
          apiKeyId: data.apiKeyId,
          resource: data.resource,
          action: data.action,
          ip: logEntry.ipAddress,
        });
      }

      // Alert on critical security events
      if (this.isCriticalEvent(data.eventType) && !data.success) {
        this.alertSecurityIncident(logEntry);
      }
    } catch (error) {
      // Never fail the request due to audit logging errors
      console.error("[audit] Failed to log audit event:", error);
    }
  }

  /**
   * Log authentication success
   */
  static async logAuthSuccess(
    apiKeyId: string,
    userId: string | undefined,
    req: Request
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.AUTH_SUCCESS,
      apiKeyId,
      userId,
      success: true,
      req,
    });
  }

  /**
   * Log authentication failure
   */
  static async logAuthFailure(
    reason: string,
    req: Request,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.AUTH_FAILURE,
      success: false,
      req,
      details: {
        reason,
        ...details,
      },
    });
  }

  /**
   * Log rate limit violation
   */
  static async logRateLimitExceeded(
    apiKeyId: string | undefined,
    req: Request,
    limit: number
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      apiKeyId,
      success: false,
      req,
      details: {
        limit,
        path: req.path,
      },
    });
  }

  /**
   * Log input validation failure
   */
  static async logInputValidationFailure(
    req: Request,
    field: string,
    reason: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.INPUT_VALIDATION_FAILED,
      apiKeyId: (req as any).apiKeyId,
      success: false,
      req,
      details: {
        field,
        reason,
        path: req.path,
      },
    });
  }

  /**
   * Log suspicious input detected
   */
  static async logSuspiciousInput(
    req: Request,
    field: string,
    pattern: string
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.SUSPICIOUS_INPUT,
      apiKeyId: (req as any).apiKeyId,
      success: false,
      req,
      details: {
        field,
        pattern,
        path: req.path,
      },
    });
  }

  /**
   * Log permission denied
   */
  static async logPermissionDenied(
    apiKeyId: string,
    resource: string,
    action: string,
    req: Request
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.PERMISSION_DENIED,
      apiKeyId,
      resource,
      action,
      success: false,
      req,
    });
  }

  /**
   * Log API key management action
   */
  static async logApiKeyAction(
    eventType: AuditEventType,
    apiKeyId: string,
    userId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      eventType,
      apiKeyId,
      userId,
      success: true,
      details,
    });
  }

  /**
   * Get client IP address from request
   */
  private static getClientIp(req: Request): string {
    const forwarded = req.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  /**
   * Check if event is critical
   */
  private static isCriticalEvent(eventType: AuditEventType): boolean {
    const criticalEvents = [
      AuditEventType.SECURITY_INCIDENT,
      AuditEventType.POTENTIAL_ATTACK,
      AuditEventType.UNAUTHORIZED_ACCESS,
      AuditEventType.SUSPICIOUS_INPUT,
    ];
    return criticalEvents.includes(eventType);
  }

  /**
   * Alert on security incident (can be extended with email/Slack notifications)
   */
  private static alertSecurityIncident(logEntry: InsertAuditLog): void {
    console.error("🚨 [SECURITY ALERT]", {
      eventType: logEntry.eventType,
      timestamp: logEntry.timestamp,
      ip: logEntry.ipAddress,
      resource: logEntry.resource,
      details: logEntry.details,
    });

    // TODO: In production, send alerts via:
    // - Email
    // - Slack webhook
    // - PagerDuty
    // - Security monitoring service (e.g., Datadog, Sentry)
  }

  /**
   * Query audit logs (for admin dashboard)
   */
  static async queryLogs(filters: {
    eventType?: AuditEventType;
    userId?: string;
    apiKeyId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    // This would be implemented based on your query needs
    // For now, returning empty array as placeholder
    return [];
  }
}
