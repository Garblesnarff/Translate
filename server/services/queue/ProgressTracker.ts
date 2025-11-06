/**
 * ProgressTracker - Tracks progress for long-running translation jobs
 * Task 3.2.2.2: Implement progress tracking
 *
 * Features:
 * - Progress tracking (0-100%)
 * - Estimated time remaining calculation
 * - Throughput tracking (chunks/minute)
 * - In-memory tracking with database persistence
 */

import { DatabaseService } from '../../core/database';

/**
 * Progress information for a job
 */
export interface JobProgress {
  progress: number; // 0-100
  chunksCompleted: number;
  chunksTotal: number;
  estimatedTimeRemaining: number | null; // milliseconds, null if not enough data
  throughput: number; // chunks per minute
}

/**
 * Internal progress tracking data
 */
interface ProgressData {
  jobId: string;
  chunksTotal: number;
  chunksCompleted: number;
  startTime: number; // timestamp
  lastUpdateTime: number; // timestamp
}

/**
 * ProgressTracker - Tracks job progress
 */
export class ProgressTracker {
  private progressMap: Map<string, ProgressData> = new Map();
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Initialize progress tracking for a job
   */
  async initialize(jobId: string, totalChunks: number): Promise<void> {
    const now = Date.now();
    this.progressMap.set(jobId, {
      jobId,
      chunksTotal: totalChunks,
      chunksCompleted: 0,
      startTime: now,
      lastUpdateTime: now,
    });

    console.log(`[ProgressTracker] Initialized tracking for job ${jobId}: ${totalChunks} chunks`);
  }

  /**
   * Update progress for a job
   */
  async updateProgress(jobId: string, chunksCompleted: number): Promise<void> {
    const progressData = this.progressMap.get(jobId);
    if (!progressData) {
      throw new Error(`Progress tracking not initialized for job ${jobId}`);
    }

    // Cap at total chunks
    const cappedCompleted = Math.min(chunksCompleted, progressData.chunksTotal);
    progressData.chunksCompleted = cappedCompleted;
    progressData.lastUpdateTime = Date.now();

    // Calculate progress percentage
    const progress = (cappedCompleted / progressData.chunksTotal) * 100;

    // Update database
    await this.updateProgressInDb(jobId, progress);

    console.log(`[ProgressTracker] Job ${jobId}: ${progress.toFixed(1)}% (${cappedCompleted}/${progressData.chunksTotal} chunks)`);
  }

  /**
   * Get current progress for a job
   */
  async getProgress(jobId: string): Promise<JobProgress> {
    const progressData = this.progressMap.get(jobId);
    if (!progressData) {
      throw new Error(`Progress tracking not initialized for job ${jobId}`);
    }

    const progress = (progressData.chunksCompleted / progressData.chunksTotal) * 100;
    const elapsedTime = Date.now() - progressData.startTime;

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | null = null;
    if (progressData.chunksCompleted > 0) {
      const avgTimePerChunk = elapsedTime / progressData.chunksCompleted;
      const remainingChunks = progressData.chunksTotal - progressData.chunksCompleted;
      estimatedTimeRemaining = Math.round(avgTimePerChunk * remainingChunks);
    }

    // Calculate throughput (chunks per minute)
    let throughput = 0;
    if (progressData.chunksCompleted > 0 && elapsedTime > 0) {
      throughput = (progressData.chunksCompleted / elapsedTime) * 60000; // Convert to per minute
    }

    return {
      progress: Math.round(progress * 100) / 100, // Round to 2 decimals
      chunksCompleted: progressData.chunksCompleted,
      chunksTotal: progressData.chunksTotal,
      estimatedTimeRemaining,
      throughput: Math.round(throughput * 100) / 100, // Round to 2 decimals
    };
  }

  /**
   * Reset progress for a job (used when retrying)
   */
  async reset(jobId: string): Promise<void> {
    const progressData = this.progressMap.get(jobId);
    if (!progressData) {
      throw new Error(`Progress tracking not initialized for job ${jobId}`);
    }

    const now = Date.now();
    progressData.chunksCompleted = 0;
    progressData.startTime = now;
    progressData.lastUpdateTime = now;

    await this.updateProgressInDb(jobId, 0);

    console.log(`[ProgressTracker] Reset progress for job ${jobId}`);
  }

  /**
   * Clean up progress tracking for a job
   */
  async cleanup(jobId: string): Promise<void> {
    this.progressMap.delete(jobId);
    console.log(`[ProgressTracker] Cleaned up tracking for job ${jobId}`);
  }

  /**
   * Update progress in database
   */
  private async updateProgressInDb(jobId: string, progress: number): Promise<void> {
    try {
      if (this.db.dialect === 'postgres') {
        await this.db.query(
          `UPDATE jobs SET progress = $1 WHERE id = $2`,
          [progress, jobId]
        );
      } else {
        // SQLite
        await this.db.query(
          `UPDATE jobs SET progress = ? WHERE id = ?`,
          [progress, jobId]
        );
      }
    } catch (error) {
      console.error(`[ProgressTracker] Failed to update progress in DB for job ${jobId}:`, error);
      // Don't throw - progress tracking failure shouldn't stop job processing
    }
  }
}
