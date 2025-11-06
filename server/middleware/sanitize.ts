/**
 * Input Sanitization Middleware (Phase 4.1.3)
 *
 * Sanitizes all user inputs:
 * - Remove/escape HTML tags
 * - Validate UTF-8 encoding
 * - Check for SQL injection patterns (defense in depth)
 * - Limit input sizes (default max 1MB)
 * - Validate file uploads (PDF only, max 50MB)
 * - Log suspicious inputs
 */

import type { Request, Response, NextFunction } from "express";
import validator from "validator";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
import { AuditLogger } from "../services/audit/AuditLogger";

// Initialize DOMPurify with jsdom
const window = new JSDOM("").window;
const purify = DOMPurify(window as any);

/**
 * Suspicious patterns that might indicate attacks
 */
const SUSPICIOUS_PATTERNS = [
  // SQL injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
  /(--|;|\/\*|\*\/)/g,

  // XSS patterns
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick, onerror, etc.

  // Path traversal
  /\.\.[\/\\]/g,
  /\.\.\\/g,

  // Command injection
  /[;&|`$()]/g,
];

/**
 * File upload validation rules
 */
const FILE_UPLOAD_RULES = {
  allowedMimeTypes: ["application/pdf"],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: [".pdf"],
};

/**
 * Check if input contains suspicious patterns
 */
function containsSuspiciousPattern(input: string): {
  isSuspicious: boolean;
  pattern?: string;
} {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      return { isSuspicious: true, pattern: pattern.toString() };
    }
  }
  return { isSuspicious: false };
}

/**
 * Sanitize a string value
 */
function sanitizeString(
  value: string,
  options: { allowHtml?: boolean; maxLength?: number } = {}
): string {
  const { allowHtml = false, maxLength = 1024 * 1024 } = options;

  // Truncate if too long
  if (value.length > maxLength) {
    value = value.substring(0, maxLength);
  }

  // Remove HTML if not allowed
  if (!allowHtml) {
    value = purify.sanitize(value, { ALLOWED_TAGS: [] });
  } else {
    // Sanitize HTML (remove dangerous tags/attributes)
    value = purify.sanitize(value);
  }

  // Normalize whitespace
  value = value.trim();

  return value;
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(
  obj: any,
  options: { allowHtml?: boolean; maxLength?: number } = {}
): any {
  if (typeof obj === "string") {
    return sanitizeString(obj, options);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, options));
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, options);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate UTF-8 encoding
 */
function isValidUtf8(str: string): boolean {
  try {
    // Try to encode and decode - will throw on invalid UTF-8
    const encoded = new TextEncoder().encode(str);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
    return decoded === str;
  } catch {
    return false;
  }
}

/**
 * Sanitization middleware options
 */
export interface SanitizeOptions {
  allowHtml?: boolean;
  maxBodySize?: number;
  maxStringLength?: number;
  checkSuspiciousPatterns?: boolean;
}

/**
 * Request body sanitization middleware
 */
export function sanitizeBody(options: SanitizeOptions = {}) {
  const {
    allowHtml = false,
    maxBodySize = 1024 * 1024, // 1MB
    maxStringLength = 1024 * 1024, // 1MB per string
    checkSuspiciousPatterns = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check body size (if available)
      const contentLength = req.get("content-length");
      if (contentLength && parseInt(contentLength) > maxBodySize) {
        return res.status(413).json({
          error: "Payload Too Large",
          message: `Request body exceeds maximum size of ${maxBodySize} bytes.`,
        });
      }

      // Skip if no body
      if (!req.body || Object.keys(req.body).length === 0) {
        return next();
      }

      // Check for suspicious patterns before sanitization
      if (checkSuspiciousPatterns) {
        const bodyString = JSON.stringify(req.body);
        const suspiciousCheck = containsSuspiciousPattern(bodyString);

        if (suspiciousCheck.isSuspicious) {
          await AuditLogger.logSuspiciousInput(
            req,
            "body",
            suspiciousCheck.pattern || "unknown"
          );

          console.warn(
            `[sanitize] Suspicious input detected in request body:`,
            {
              path: req.path,
              pattern: suspiciousCheck.pattern,
              apiKeyId: req.apiKeyId,
            }
          );

          // In strict mode, reject the request
          // For now, just log and continue with sanitization
        }
      }

      // Sanitize request body
      req.body = sanitizeObject(req.body, {
        allowHtml,
        maxLength: maxStringLength,
      });

      next();
    } catch (error) {
      console.error("[sanitize] Error sanitizing request body:", error);
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid request body.",
      });
    }
  };
}

/**
 * Query parameter sanitization middleware
 */
export function sanitizeQuery() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.query || Object.keys(req.query).length === 0) {
        return next();
      }

      // Sanitize query parameters
      req.query = sanitizeObject(req.query, {
        allowHtml: false,
        maxLength: 1024, // Shorter limit for query params
      });

      next();
    } catch (error) {
      console.error("[sanitize] Error sanitizing query parameters:", error);
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid query parameters.",
      });
    }
  };
}

/**
 * File upload validation middleware
 */
export function validateFileUpload() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if files are present
      const files = (req as any).files;
      if (!files || Object.keys(files).length === 0) {
        return next();
      }

      // Validate each uploaded file
      for (const [fieldName, file] of Object.entries(files)) {
        const uploadedFile = file as any;

        // Check file size
        if (uploadedFile.size > FILE_UPLOAD_RULES.maxFileSize) {
          return res.status(413).json({
            error: "File Too Large",
            message: `File '${fieldName}' exceeds maximum size of ${FILE_UPLOAD_RULES.maxFileSize / 1024 / 1024}MB.`,
          });
        }

        // Check MIME type
        if (
          !FILE_UPLOAD_RULES.allowedMimeTypes.includes(uploadedFile.mimetype)
        ) {
          await AuditLogger.logInputValidationFailure(
            req,
            fieldName,
            `Invalid MIME type: ${uploadedFile.mimetype}`
          );

          return res.status(400).json({
            error: "Invalid File Type",
            message: `File '${fieldName}' must be a PDF. Got: ${uploadedFile.mimetype}`,
          });
        }

        // Check file extension
        const fileName = uploadedFile.name.toLowerCase();
        const hasValidExtension = FILE_UPLOAD_RULES.allowedExtensions.some(
          (ext) => fileName.endsWith(ext)
        );

        if (!hasValidExtension) {
          await AuditLogger.logInputValidationFailure(
            req,
            fieldName,
            `Invalid file extension: ${fileName}`
          );

          return res.status(400).json({
            error: "Invalid File Extension",
            message: `File '${fieldName}' must have a .pdf extension.`,
          });
        }
      }

      next();
    } catch (error) {
      console.error("[sanitize] Error validating file upload:", error);
      return res.status(400).json({
        error: "Bad Request",
        message: "File upload validation failed.",
      });
    }
  };
}

/**
 * Comprehensive sanitization middleware (body + query + files)
 */
export function sanitizeRequest(options: SanitizeOptions = {}) {
  return [sanitizeBody(options), sanitizeQuery(), validateFileUpload()];
}

/**
 * Utility: Manually sanitize a value
 */
export function sanitize(
  value: any,
  options: { allowHtml?: boolean; maxLength?: number } = {}
): any {
  if (typeof value === "string") {
    return sanitizeString(value, options);
  }
  return sanitizeObject(value, options);
}

/**
 * Utility: Check if string is safe
 */
export function isSafeInput(input: string): boolean {
  // Check UTF-8 validity
  if (!isValidUtf8(input)) {
    return false;
  }

  // Check for suspicious patterns
  const suspiciousCheck = containsSuspiciousPattern(input);
  if (suspiciousCheck.isSuspicious) {
    return false;
  }

  return true;
}
