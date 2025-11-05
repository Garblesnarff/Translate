/**
 * Monitoring API Routes
 *
 * Endpoints for accessing translation metrics, performance stats,
 * quality trends, and system health
 */

import { Router, Request, Response } from 'express';
import { PerformanceMonitor } from '../services/monitoring/PerformanceMonitor';
import { QualityMonitor } from '../services/monitoring/QualityMonitor';
import { ErrorMonitor } from '../services/monitoring/ErrorMonitor';
import { getMetricsCollector } from '../services/monitoring/MetricsCollector';
import { logRequest, LogLevel } from '../middleware/requestLogger';

const router = Router();

// Initialize monitors
const performanceMonitor = new PerformanceMonitor();
const qualityMonitor = new QualityMonitor();
const errorMonitor = new ErrorMonitor();

/**
 * GET /api/monitoring/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      },
      metricsBuffer: getMetricsCollector().getBufferSize()
    };

    res.json(health);
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get current metrics summary
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const summary = getMetricsCollector().calculateSummary();
    res.json(summary);
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get metrics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/performance
 * Get performance statistics
 * Query params: startDate, endDate (ISO strings)
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 24 hours
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const report = await performanceMonitor.generatePerformanceReport(start, end);
    const alerts = await performanceMonitor.checkPerformanceAlerts(start, end);

    res.json({
      report,
      alerts,
      hasAlerts: alerts.length > 0
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get performance metrics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/performance/current
 * Get current performance snapshot (last hour)
 */
router.get('/performance/current', async (req: Request, res: Response) => {
  try {
    const report = await performanceMonitor.getCurrentPerformance();
    res.json(report);
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get current performance', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/quality
 * Get quality statistics
 * Query params: startDate, endDate (ISO strings)
 */
router.get('/quality', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, documentId } = req.query;

    // If documentId provided, get document-specific metrics
    if (documentId) {
      const report = await qualityMonitor.getDocumentQualityMetrics(documentId as string);
      return res.json(report);
    }

    // Default to last 24 hours
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const report = await qualityMonitor.generateQualityReport(start, end);
    const alerts = await qualityMonitor.checkQualityAlerts(start, end);

    res.json({
      report,
      alerts,
      hasAlerts: alerts.length > 0
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get quality metrics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/quality/compare
 * Compare quality between current period and baseline
 * Query params: currentStart, currentEnd, baselineStart, baselineEnd
 */
router.get('/quality/compare', async (req: Request, res: Response) => {
  try {
    const { currentStart, currentEnd, baselineStart, baselineEnd } = req.query;

    if (!currentStart || !currentEnd || !baselineStart || !baselineEnd) {
      return res.status(400).json({
        error: 'Missing required query parameters: currentStart, currentEnd, baselineStart, baselineEnd'
      });
    }

    const currentPeriod = {
      start: new Date(currentStart as string),
      end: new Date(currentEnd as string)
    };

    const baselinePeriod = {
      start: new Date(baselineStart as string),
      end: new Date(baselineEnd as string)
    };

    const alerts = await qualityMonitor.compareToBaseline(currentPeriod, baselinePeriod);
    const currentReport = await qualityMonitor.generateQualityReport(currentPeriod.start, currentPeriod.end);
    const baselineReport = await qualityMonitor.generateQualityReport(baselinePeriod.start, baselinePeriod.end);

    res.json({
      current: currentReport,
      baseline: baselineReport,
      alerts,
      hasAlerts: alerts.length > 0
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to compare quality', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/errors
 * Get error statistics
 * Query params: startDate, endDate (ISO strings)
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, documentId } = req.query;

    // If documentId provided, get document-specific errors
    if (documentId) {
      const summary = await errorMonitor.getDocumentErrors(documentId as string);
      return res.json(summary);
    }

    // Default to last 24 hours
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const summary = await errorMonitor.generateErrorSummary(start, end);
    const alerts = await errorMonitor.checkErrorAlerts(start, end);

    res.json({
      summary,
      alerts,
      hasAlerts: alerts.length > 0
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get error metrics', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/errors/recent
 * Get recent errors
 * Query params: limit (default 10)
 */
router.get('/errors/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const errors = await errorMonitor.getRecentErrors(limit);
    res.json({ errors });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get recent errors', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get all active alerts across all monitors
 * Query params: startDate, endDate (ISO strings)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 24 hours
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const [performanceAlerts, qualityAlerts, errorAlerts] = await Promise.all([
      performanceMonitor.checkPerformanceAlerts(start, end),
      qualityMonitor.checkQualityAlerts(start, end),
      errorMonitor.checkErrorAlerts(start, end)
    ]);

    const allAlerts = [
      ...performanceAlerts.map(a => ({ ...a, category: 'performance' })),
      ...qualityAlerts.map(a => ({ ...a, category: 'quality' })),
      ...errorAlerts.map(a => ({ ...a, category: 'error' }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = allAlerts.filter(a => a.severity === 'warning').length;

    res.json({
      alerts: allAlerts,
      summary: {
        total: allAlerts.length,
        critical: criticalCount,
        warning: warningCount
      }
    });
  } catch (error: any) {
    logRequest(req, LogLevel.ERROR, 'Failed to get alerts', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
