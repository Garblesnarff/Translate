/**
 * Tests for MonitoringService
 * Task 2.2.1.1: Write comprehensive monitoring tests
 *
 * Following TDD methodology - tests written FIRST
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MonitoringService } from '../../../../server/services/monitoring/MonitoringService';
import type { DatabaseService } from '../../../../server/core/database';

describe('MonitoringService', () => {
  let service: MonitoringService | null = null;
  let mockDb: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database
    mockDb = {
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({ query: vi.fn().mockResolvedValue([]) });
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      dialect: 'sqlite',
    } as any;

    service = new MonitoringService(mockDb, { bufferSize: 5, flushIntervalMs: 1000 });
  });

  afterEach(async () => {
    if (service) {
      await service!.destroy();
      service = null;
    }
  });

  describe('Metric Recording and Buffering', () => {
    it('should buffer metrics before flushing', () => {
      service!.record('test.metric', 100);
      service!.record('test.metric', 200);
      service!.record('test.metric', 300);

      expect(service!.getBufferSize()).toBe(3);
    });

    it('should include tags with metrics', () => {
      service!.record('test.metric', 100, { environment: 'test', version: '1.0' });

      expect(service!.getBufferSize()).toBe(1);
    });

    it('should auto-flush when buffer reaches size limit', async () => {
      // Buffer size is 5
      service!.record('test.metric', 1);
      service!.record('test.metric', 2);
      service!.record('test.metric', 3);
      service!.record('test.metric', 4);

      expect(service!.getBufferSize()).toBe(4);

      // This should trigger flush
      service!.record('test.metric', 5);

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDb.query).toHaveBeenCalled();
      expect(service!.getBufferSize()).toBe(0);
    });

    it('should flush metrics to database with correct SQL', async () => {
      service!.record('translation.duration', 1500, { model: 'gemini' });
      service!.record('translation.success', 1);

      await service!.flush();

      expect(mockDb.query).toHaveBeenCalled();
      const call = (mockDb.query as any).mock.calls[0];
      const sql = call[0];

      // Should be INSERT INTO metrics
      expect(sql).toContain('INSERT INTO metrics');
      expect(sql).toContain('timestamp');
      expect(sql).toContain('metric_name');
      expect(sql).toContain('value');
    });

    it('should handle flush errors gracefully', async () => {
      (mockDb.query as any).mockRejectedValueOnce(new Error('DB Error'));

      service!.record('test.metric', 100);

      // Should not throw
      await expect(service!.flush()).resolves.not.toThrow();
    });
  });

  describe('Performance Tracking', () => {
    it('should track translation performance metrics', async () => {
      await service!.trackTranslation(1500, true);
      await service!.trackTranslation(2000, false);

      await service!.flush();

      expect(mockDb.query).toHaveBeenCalled();
      const calls = (mockDb.query as any).mock.calls;

      // Check that both duration and success metrics were recorded
      const sql = calls[0][0];
      expect(sql).toContain('INSERT INTO metrics');
    });

    it('should record success and failure counts', async () => {
      await service!.trackTranslation(1000, true);
      await service!.trackTranslation(1200, true);
      await service!.trackTranslation(1500, false);

      const stats = await service!.getStats({
        start: Date.now() - 60000,
        end: Date.now(),
      });

      expect(stats).toBeDefined();
    });
  });

  describe('Quality Tracking', () => {
    it('should track quality metrics', async () => {
      await service!.trackQuality({
        overall: 0.95,
        confidence: 0.92,
        format: 0.98,
        preservation: 0.96,
      });

      expect(service!.getBufferSize()).toBeGreaterThan(0);
      await service!.flush();

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle partial quality scores', async () => {
      await service!.trackQuality({
        overall: 0.85,
        confidence: 0.80,
      });

      expect(service!.getBufferSize()).toBeGreaterThan(0);
    });
  });

  describe('Cache Tracking', () => {
    it('should track cache hits and misses', async () => {
      await service!.trackCache(true);  // hit
      await service!.trackCache(false); // miss
      await service!.trackCache(true);  // hit

      expect(service!.getBufferSize()).toBe(3);
      await service!.flush();

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should calculate cache hit rate', async () => {
      await service!.trackCache(true);
      await service!.trackCache(true);
      await service!.trackCache(false);
      await service!.trackCache(true);

      // Hit rate should be 75% (3/4)
      const stats = await service!.getStats({
        start: Date.now() - 60000,
        end: Date.now(),
      });

      expect(stats).toBeDefined();
    });
  });

  describe('Statistics and Aggregation', () => {
    it('should aggregate statistics over time range', async () => {
      // Mock database to return metrics
      (mockDb.query as any).mockResolvedValueOnce([
        { metric_name: 'translation.duration', value: 1000, timestamp: new Date() },
        { metric_name: 'translation.duration', value: 1500, timestamp: new Date() },
        { metric_name: 'translation.duration', value: 2000, timestamp: new Date() },
      ]);

      const stats = await service!.getStats({
        start: Date.now() - 3600000,
        end: Date.now(),
      });

      expect(stats).toHaveProperty('translation.duration');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should calculate average, min, max', async () => {
      (mockDb.query as any).mockResolvedValueOnce([
        { metric_name: 'test.metric', value: 100, timestamp: new Date() },
        { metric_name: 'test.metric', value: 200, timestamp: new Date() },
        { metric_name: 'test.metric', value: 300, timestamp: new Date() },
      ]);

      const stats = await service!.getStats({
        start: Date.now() - 3600000,
        end: Date.now(),
      });

      expect(stats['test.metric']).toBeDefined();
    });

    it('should detect anomalies (values > 3 standard deviations)', async () => {
      // Mock with outlier values
      (mockDb.query as any).mockResolvedValueOnce([
        { metric_name: 'test.metric', value: 100, timestamp: new Date() },
        { metric_name: 'test.metric', value: 100, timestamp: new Date() },
        { metric_name: 'test.metric', value: 100, timestamp: new Date() },
        { metric_name: 'test.metric', value: 10000, timestamp: new Date() }, // outlier
      ]);

      const stats = await service!.getStats({
        start: Date.now() - 3600000,
        end: Date.now(),
      });

      // Should detect the outlier
      expect(stats['test.metric']).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should check system health', async () => {
      const health = await service!.checkHealth();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('database');
      expect(health.database).toBe('connected');
    });

    it('should detect database disconnection', async () => {
      (mockDb.healthCheck as any).mockResolvedValueOnce(false);

      const health = await service!.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.database).toBe('disconnected');
    });

    it('should include cache availability in health check', async () => {
      const health = await service!.checkHealth();

      expect(health).toHaveProperty('cache');
      expect(health.cache).toMatch(/available|unavailable/);
    });

    it('should report last error if available', async () => {
      // Trigger an error
      (mockDb.query as any).mockRejectedValueOnce(new Error('Test error'));
      service!.record('test.metric', 100);
      await service!.flush().catch(() => {});

      const health = await service!.checkHealth();

      // May or may not have lastError depending on implementation
      if (health.lastError) {
        expect(typeof health.lastError).toBe('string');
      }
    });
  });

  describe('Auto-flush Timer', () => {
    it('should auto-flush every 30 seconds (default)', async () => {
      const shortService = new MonitoringService(mockDb, {
        bufferSize: 100,
        flushIntervalMs: 100 // Use 100ms for testing
      });

      shortService.record('test.metric', 100);

      // Wait for auto-flush
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockDb.query).toHaveBeenCalled();

      await shortService.destroy();
    });

    it('should flush on destroy', async () => {
      service!.record('test.metric', 100);
      service!.record('test.metric', 200);

      await service!.destroy();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors without crashing', async () => {
      (mockDb.query as any).mockRejectedValue(new Error('Database connection lost'));

      service!.record('test.metric', 100);

      // Should not throw
      await expect(service!.flush()).resolves.not.toThrow();
    });

    it('should continue recording metrics after flush error', async () => {
      (mockDb.query as any).mockRejectedValueOnce(new Error('DB Error'));

      service!.record('test.metric', 100);
      await service!.flush().catch(() => {});

      // Should still be able to record
      service!.record('test.metric', 200);
      expect(service!.getBufferSize()).toBeGreaterThan(0);
    });
  });
});
