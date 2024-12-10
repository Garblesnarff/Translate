import { Request, Response, NextFunction } from 'express';

/**
 * Middleware for logging HTTP requests with timing information
 * Captures request details and response time for monitoring
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    });
  });
  
  next();
};
