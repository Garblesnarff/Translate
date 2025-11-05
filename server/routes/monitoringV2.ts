/**
 * Monitoring API Routes V2
 * Task 2.2.1.4 & 2.2.2.3: Create monitoring API endpoints
 *
 * Endpoints:
 * - GET /api/v2/monitoring/health - System health check
 * - GET /api/v2/monitoring/metrics - Get metrics for time range
 * - GET /api/v2/monitoring/quality - Quality trends over time
 * - GET /api/v2/monitoring/performance - Performance statistics
 * - GET /api/v2/monitoring/cache - Cache statistics
 * - GET /api/v2/monitoring/dashboard - Dashboard data
 */

import { Router, Request, Response } from 'express';
import { MonitoringService } from '../services/monitoring/MonitoringService';
import { StatisticsAggregator } from '../services/monitoring/StatisticsAggregator';
import { DatabaseService } from '../core/database';

/**
 * Create monitoring router
 */
export function createMonitoringRouter(
  monitoring: MonitoringService,
  db: DatabaseService
): Router {
  const router = Router();
  const aggregator = new StatisticsAggregator();

  /**
   * GET /api/v2/monitoring/health
   * System health check
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await monitoring.checkHealth();
      const statusCode = health.healthy ? 200 : 503;

      res.status(statusCode).json({
        success: health.healthy,
        data: health,
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check health',
      });
    }
  });

  /**
   * GET /api/v2/monitoring/metrics?start=<timestamp>&end=<timestamp>
   * Get metrics for time range
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing start or end timestamp',
        });
      }

      const timeRange = {
        start: parseInt(start as string, 10),
        end: parseInt(end as string, 10),
      };

      const stats = await monitoring.getStats(timeRange);

      res.json({
        success: true,
        data: stats,
        timeRange,
      });
    } catch (error) {
      console.error('Metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metrics',
      });
    }
  });

  /**
   * GET /api/v2/monitoring/quality?start=<timestamp>&end=<timestamp>
   * Quality trends over time
   */
  router.get('/quality', async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing start or end timestamp',
        });
      }

      const sql = `
        SELECT metric_name, value, timestamp
        FROM metrics
        WHERE metric_name LIKE 'quality.%'
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp
      `;

      const params = db.dialect === 'postgres'
        ? [new Date(parseInt(start as string, 10)), new Date(parseInt(end as string, 10))]
        : [
            new Date(parseInt(start as string, 10)).toISOString(),
            new Date(parseInt(end as string, 10)).toISOString()
          ];

      const rows = await db.query<{
        metric_name: string;
        value: number;
        timestamp: Date | string;
      }>(sql, params);

      // Group by metric name
      const grouped = new Map<string, number[]>();
      rows.forEach(row => {
        if (!grouped.has(row.metric_name)) {
          grouped.set(row.metric_name, []);
        }
        grouped.get(row.metric_name)!.push(row.value);
      });

      // Calculate statistics
      const quality: Record<string, any> = {};
      grouped.forEach((values, metricName) => {
        quality[metricName] = aggregator.calculateStats(values, { higherIsBetter: true });
      });

      res.json({
        success: true,
        data: quality,
      });
    } catch (error) {
      console.error('Quality metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch quality metrics',
      });
    }
  });

  /**
   * GET /api/v2/monitoring/performance?start=<timestamp>&end=<timestamp>
   * Performance statistics
   */
  router.get('/performance', async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing start or end timestamp',
        });
      }

      const sql = `
        SELECT metric_name, value, timestamp
        FROM metrics
        WHERE metric_name IN ('translation.duration', 'api.request.duration', 'translation.success')
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp
      `;

      const params = db.dialect === 'postgres'
        ? [new Date(parseInt(start as string, 10)), new Date(parseInt(end as string, 10))]
        : [
            new Date(parseInt(start as string, 10)).toISOString(),
            new Date(parseInt(end as string, 10)).toISOString()
          ];

      const rows = await db.query<{
        metric_name: string;
        value: number;
        timestamp: Date | string;
      }>(sql, params);

      // Group by metric name
      const grouped = new Map<string, number[]>();
      rows.forEach(row => {
        if (!grouped.has(row.metric_name)) {
          grouped.set(row.metric_name, []);
        }
        grouped.get(row.metric_name)!.push(row.value);
      });

      // Calculate statistics
      const performance: Record<string, any> = {};
      grouped.forEach((values, metricName) => {
        performance[metricName] = aggregator.calculateStats(values);
      });

      res.json({
        success: true,
        data: performance,
      });
    } catch (error) {
      console.error('Performance metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics',
      });
    }
  });

  /**
   * GET /api/v2/monitoring/cache?start=<timestamp>&end=<timestamp>
   * Cache statistics
   */
  router.get('/cache', async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).json({
          success: false,
          error: 'Missing start or end timestamp',
        });
      }

      const sql = `
        SELECT metric_name, value, timestamp, tags
        FROM metrics
        WHERE metric_name = 'cache.hit'
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp
      `;

      const params = db.dialect === 'postgres'
        ? [new Date(parseInt(start as string, 10)), new Date(parseInt(end as string, 10))]
        : [
            new Date(parseInt(start as string, 10)).toISOString(),
            new Date(parseInt(end as string, 10)).toISOString()
          ];

      const rows = await db.query<{
        metric_name: string;
        value: number;
        timestamp: Date | string;
        tags: string | null;
      }>(sql, params);

      // Calculate hit rate
      const hits = rows.filter(row => row.value === 1).length;
      const misses = rows.filter(row => row.value === 0).length;
      const total = hits + misses;
      const hitRate = total > 0 ? hits / total : 0;

      res.json({
        success: true,
        data: {
          hits,
          misses,
          total,
          hitRate,
        },
      });
    } catch (error) {
      console.error('Cache metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cache metrics',
      });
    }
  });

  /**
   * GET /api/v2/monitoring/dashboard?start=<timestamp>&end=<timestamp>
   * Dashboard data - aggregated view of all metrics
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const { start, end } = req.query;

      // Default to last hour if not specified
      const endTime = end ? parseInt(end as string, 10) : Date.now();
      const startTime = start ? parseInt(start as string, 10) : endTime - 3600000;

      const sql = `
        SELECT metric_name, value, timestamp, tags
        FROM metrics
        WHERE timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp
      `;

      const params = db.dialect === 'postgres'
        ? [new Date(startTime), new Date(endTime)]
        : [new Date(startTime).toISOString(), new Date(endTime).toISOString()];

      const rows = await db.query<{
        metric_name: string;
        value: number;
        timestamp: Date | string;
        tags: string | null;
      }>(sql, params);

      // Group by metric name
      const grouped = new Map<string, number[]>();
      rows.forEach(row => {
        if (!grouped.has(row.metric_name)) {
          grouped.set(row.metric_name, []);
        }
        grouped.get(row.metric_name)!.push(row.value);
      });

      // Performance metrics
      const translationDurations = grouped.get('translation.duration') || [];
      const apiDurations = grouped.get('api.request.duration') || [];
      const translationSuccess = grouped.get('translation.success') || [];

      const performance = {
        avgDuration: translationDurations.length > 0
          ? translationDurations.reduce((a, b) => a + b, 0) / translationDurations.length
          : 0,
        p95Duration: translationDurations.length > 0
          ? aggregator.calculateStats(translationDurations).p95
          : 0,
        requestsPerSecond: apiDurations.length / ((endTime - startTime) / 1000),
        errorRate: translationSuccess.length > 0
          ? 1 - (translationSuccess.reduce((a, b) => a + b, 0) / translationSuccess.length)
          : 0,
      };

      // Quality metrics
      const qualityOverall = grouped.get('quality.overall') || [];
      const qualityConfidence = grouped.get('quality.confidence') || [];
      const qualityPreservation = grouped.get('quality.preservation') || [];

      const quality = {
        avgConfidence: qualityConfidence.length > 0
          ? qualityConfidence.reduce((a, b) => a + b, 0) / qualityConfidence.length
          : 0,
        avgPreservation: qualityPreservation.length > 0
          ? qualityPreservation.reduce((a, b) => a + b, 0) / qualityPreservation.length
          : 0,
        passRate: qualityOverall.filter(v => v >= 0.7).length / (qualityOverall.length || 1),
      };

      // Cache metrics
      const cacheHits = grouped.get('cache.hit') || [];
      const hits = cacheHits.filter(v => v === 1).length;
      const total = cacheHits.length;

      const cache = {
        hitRate: total > 0 ? hits / total : 0,
        memoryHits: hits, // Simplified - would need tags to differentiate
        translationMemoryHits: 0, // Simplified
      };

      // Error metrics
      const errorCounts = grouped.get('error.count') || [];
      const errorsByType: Record<string, number> = {};

      // Parse tags for error types (simplified)
      rows
        .filter(row => row.metric_name === 'error.count')
        .forEach(row => {
          if (row.tags) {
            try {
              const tags = JSON.parse(row.tags as string);
              const type = tags.type || 'Unknown';
              errorsByType[type] = (errorsByType[type] || 0) + 1;
            } catch (e) {
              // Ignore parse errors
            }
          }
        });

      const errors = {
        total: errorCounts.reduce((a, b) => a + b, 0),
        byType: errorsByType,
      };

      res.json({
        success: true,
        data: {
          performance,
          quality,
          cache,
          errors,
          timeRange: {
            start: startTime,
            end: endTime,
          },
        },
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data',
      });
    }
  });

  return router;
}
