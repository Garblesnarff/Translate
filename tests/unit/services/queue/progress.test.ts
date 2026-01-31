/**
 * Tests for Progress Tracking
 * Task 3.2.2.1: Write tests for progress tracking
 *
 * Following TDD methodology - tests written FIRST
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressTracker } from '../../../../server/services/queue/ProgressTracker';
import type { DatabaseService } from '../../../../server/core/database';

describe('ProgressTracker', () => {
  let progressTracker: ProgressTracker;
  let mockDb: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({ query: vi.fn().mockResolvedValue([]) });
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      dialect: 'sqlite',
    } as any;

    progressTracker = new ProgressTracker(mockDb);
  });

  describe('Progress Tracking', () => {
    it('should track progress from 0 to 100%', async () => {
      const jobId = 'test-job-123';
      const totalChunks = 10;

      await progressTracker.initialize(jobId, totalChunks);

      // Check initial progress
      let progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(0);
      expect(progress.chunksCompleted).toBe(0);
      expect(progress.chunksTotal).toBe(10);

      // Update progress
      await progressTracker.updateProgress(jobId, 5);
      progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(50);
      expect(progress.chunksCompleted).toBe(5);

      // Complete all chunks
      await progressTracker.updateProgress(jobId, 10);
      progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(100);
      expect(progress.chunksCompleted).toBe(10);
    });

    it('should calculate progress percentage correctly', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 8);

      await progressTracker.updateProgress(jobId, 2);
      let progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(25);

      await progressTracker.updateProgress(jobId, 4);
      progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(50);

      await progressTracker.updateProgress(jobId, 6);
      progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(75);
    });

    it('should handle single chunk progress', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 1);

      let progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(0);

      await progressTracker.updateProgress(jobId, 1);
      progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(100);
    });
  });

  describe('Estimated Time Remaining', () => {
    it('should estimate remaining time based on average chunk time', async () => {
      const jobId = 'test-job-123';
      const totalChunks = 10;

      await progressTracker.initialize(jobId, totalChunks);

      // Simulate processing 2 chunks over 2 seconds
      await new Promise(resolve => setTimeout(resolve, 1000));
      await progressTracker.updateProgress(jobId, 2);

      await new Promise(resolve => setTimeout(resolve, 1000));
      await progressTracker.updateProgress(jobId, 4);

      const progress = await progressTracker.getProgress(jobId);

      // Should estimate ~3 seconds remaining for 6 remaining chunks
      // (avg 0.5s per chunk * 6 chunks = 3s)
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
      expect(progress.estimatedTimeRemaining).toBeLessThan(10000); // Less than 10s
    });

    it('should return 0 estimated time when all chunks complete', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 5);

      await progressTracker.updateProgress(jobId, 5);

      const progress = await progressTracker.getProgress(jobId);
      expect(progress.estimatedTimeRemaining).toBe(0);
    });

    it('should return null estimated time before first chunk completes', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      const progress = await progressTracker.getProgress(jobId);
      expect(progress.estimatedTimeRemaining).toBeNull();
    });

    it('should update estimated time as more chunks complete', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      // Complete first chunk
      await new Promise(resolve => setTimeout(resolve, 100));
      await progressTracker.updateProgress(jobId, 1);
      let progress = await progressTracker.getProgress(jobId);
      const firstEstimate = progress.estimatedTimeRemaining;

      // Complete more chunks
      await new Promise(resolve => setTimeout(resolve, 100));
      await progressTracker.updateProgress(jobId, 5);
      progress = await progressTracker.getProgress(jobId);
      const secondEstimate = progress.estimatedTimeRemaining;

      // Second estimate should be more accurate and lower
      expect(secondEstimate).not.toBeNull();
      expect(secondEstimate).toBeLessThan(firstEstimate!);
    });
  });

  describe('Throughput Calculation', () => {
    it('should calculate throughput in chunks per minute', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      // Simulate processing 3 chunks in ~1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 500));
      await progressTracker.updateProgress(jobId, 1);

      await new Promise(resolve => setTimeout(resolve, 500));
      await progressTracker.updateProgress(jobId, 2);

      await new Promise(resolve => setTimeout(resolve, 500));
      await progressTracker.updateProgress(jobId, 3);

      const progress = await progressTracker.getProgress(jobId);

      // ~3 chunks in 1.5s = ~2 chunks/s = ~120 chunks/min
      expect(progress.throughput).toBeGreaterThan(0);
      expect(progress.throughput).toBeLessThan(200); // Reasonable upper bound
    });

    it('should return 0 throughput before first chunk completes', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      const progress = await progressTracker.getProgress(jobId);
      expect(progress.throughput).toBe(0);
    });

    it('should update throughput as processing continues', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      await new Promise(resolve => setTimeout(resolve, 200));
      await progressTracker.updateProgress(jobId, 1);
      let progress = await progressTracker.getProgress(jobId);
      const initialThroughput = progress.throughput;

      await new Promise(resolve => setTimeout(resolve, 200));
      await progressTracker.updateProgress(jobId, 3);
      progress = await progressTracker.getProgress(jobId);
      const updatedThroughput = progress.throughput;

      expect(updatedThroughput).toBeGreaterThan(0);
      // Throughput should be calculated based on total elapsed time
      expect(typeof updatedThroughput).toBe('number');
    });
  });

  describe('Progress Update During Translation', () => {
    it('should update progress during multi-chunk translation', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 5);

      // Simulate incremental progress
      for (let i = 1; i <= 5; i++) {
        await progressTracker.updateProgress(jobId, i);
        const progress = await progressTracker.getProgress(jobId);
        expect(progress.chunksCompleted).toBe(i);
        expect(progress.progress).toBe((i / 5) * 100);
      }
    });

    it('should persist progress updates to database', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 5);

      await progressTracker.updateProgress(jobId, 3);

      // Should have updated database
      const updateCalls = (mockDb.query as any).mock.calls.filter(
        (call: any[]) => call[0].includes('UPDATE jobs')
      );

      expect(updateCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Job Tracking', () => {
    it('should track progress for multiple jobs independently', async () => {
      const job1 = 'job-1';
      const job2 = 'job-2';

      await progressTracker.initialize(job1, 10);
      await progressTracker.initialize(job2, 5);

      await progressTracker.updateProgress(job1, 3);
      await progressTracker.updateProgress(job2, 2);

      const progress1 = await progressTracker.getProgress(job1);
      const progress2 = await progressTracker.getProgress(job2);

      expect(progress1.progress).toBe(30);
      expect(progress2.progress).toBe(40);
      expect(progress1.chunksTotal).toBe(10);
      expect(progress2.chunksTotal).toBe(5);
    });
  });

  describe('Progress Validation', () => {
    it('should throw error when updating non-existent job', async () => {
      await expect(
        progressTracker.updateProgress('non-existent-job', 5)
      ).rejects.toThrow();
    });

    it('should throw error when getting progress of non-existent job', async () => {
      await expect(
        progressTracker.getProgress('non-existent-job')
      ).rejects.toThrow();
    });

    it('should not allow progress beyond total chunks', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 5);

      await progressTracker.updateProgress(jobId, 10); // More than total

      const progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(100); // Capped at 100%
    });

    it('should handle rapid progress updates', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      // Rapid updates
      await Promise.all([
        progressTracker.updateProgress(jobId, 1),
        progressTracker.updateProgress(jobId, 2),
        progressTracker.updateProgress(jobId, 3),
      ]);

      const progress = await progressTracker.getProgress(jobId);
      expect(progress.chunksCompleted).toBe(3);
    });
  });

  describe('Progress Reset', () => {
    it('should reset progress when job is retried', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 10);

      await progressTracker.updateProgress(jobId, 5);
      let progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(50);

      // Reset for retry
      await progressTracker.reset(jobId);
      progress = await progressTracker.getProgress(jobId);
      expect(progress.progress).toBe(0);
      expect(progress.chunksCompleted).toBe(0);
    });
  });

  describe('Progress Cleanup', () => {
    it('should clean up completed job progress data', async () => {
      const jobId = 'test-job-123';
      await progressTracker.initialize(jobId, 5);

      await progressTracker.updateProgress(jobId, 5);

      // Clean up
      await progressTracker.cleanup(jobId);

      // Should throw error when trying to get progress after cleanup
      await expect(
        progressTracker.getProgress(jobId)
      ).rejects.toThrow();
    });
  });
});
