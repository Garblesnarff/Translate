import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Enhanced middleware for structured logging with correlation IDs
 * Features:
 * - JSON structured logging
 * - Correlation IDs for request tracing
 * - Performance timing
 * - Request/response metadata
 */

// Extend Express Request type to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  correlationId: string;
  method?: string;
  path?: string;
  status?: number;
  duration?: number;
  userAgent?: string;
  contentLength?: string | number;
  error?: any;
  message?: string;
  [key: string]: any;
}

/**
 * Create a structured log entry
 */
export function createLog(
  level: LogLevel,
  correlationId: string,
  message?: string,
  metadata?: Record<string, any>
): StructuredLog {
  return {
    timestamp: new Date().toISOString(),
    level,
    correlationId,
    message,
    ...metadata
  };
}

/**
 * Log a structured message
 */
export function log(log: StructuredLog): void {
  const logString = JSON.stringify(log);

  switch (log.level) {
    case LogLevel.ERROR:
      console.error(logString);
      break;
    case LogLevel.WARN:
      console.warn(logString);
      break;
    case LogLevel.DEBUG:
      console.debug(logString);
      break;
    default:
      console.log(logString);
  }
}

/**
 * Enhanced request logger middleware with correlation IDs
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate or use existing correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Log request start
  log(createLog(
    LogLevel.INFO,
    correlationId,
    'Request started',
    {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
      ip: req.ip
    }
  ));

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    const level = res.statusCode >= 500 ? LogLevel.ERROR
      : res.statusCode >= 400 ? LogLevel.WARN
      : LogLevel.INFO;

    log(createLog(
      level,
      correlationId,
      'Request completed',
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content-length']
      }
    ));
  });

  // Log errors
  res.on('error', (error) => {
    log(createLog(
      LogLevel.ERROR,
      correlationId,
      'Request error',
      {
        method: req.method,
        path: req.path,
        error: error.message,
        stack: error.stack
      }
    ));
  });

  next();
};

/**
 * Helper to log within request handlers
 */
export function logRequest(
  req: Request,
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>
): void {
  const correlationId = req.correlationId || 'unknown';
  log(createLog(level, correlationId, message, metadata));
}
