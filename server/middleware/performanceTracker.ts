/**
 * Performance Tracking Middleware
 * Task 2.2.1.3: Implement performance tracking middleware
 *
 * Express middleware that tracks:
 * - Request duration
 * - Response status
 * - Request method and path
 */

import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../services/monitoring/MonitoringService';

/**
 * Create performance tracking middleware
 */
export function createPerformanceTracker(monitoring: MonitoringService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const status = res.statusCode;
      const method = req.method;
      const path = req.route?.path || req.path;

      // Record metrics
      monitoring.record('api.request.duration', duration, {
        method,
        path,
        status: String(status),
      });

      monitoring.record('api.request.count', 1, {
        method,
        path,
        status: String(status),
      });

      // Track success/failure
      const success = status >= 200 && status < 400;
      monitoring.record('api.request.success', success ? 1 : 0, {
        method,
        path,
      });
    });

    next();
  };
}

/**
 * Create error tracking middleware
 */
export function createErrorTracker(monitoring: MonitoringService) {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // Record error
    monitoring.record('error.count', 1, {
      type: err.name || 'UnknownError',
      path: req.path,
      method: req.method,
    });

    // Pass error to next handler
    next(err);
  };
}
