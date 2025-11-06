/**
 * JobQueue - Background job queue for long-running translation tasks
 * Task 3.2.1.2: Implement JobQueue
 *
 * Features:
 * - In-memory queue with database persistence
 * - FIFO processing order
 * - Concurrency limit (default 3)
 * - Job cancellation support
 * - Auto-resume after restart
 * - Progress tracking
 */

import { randomUUID } from 'crypto';
import { DatabaseService } from '../../core/database';
import { TranslationService } from '../translationService';
import { JobWorker, type Job, type JobStatus, type TranslationRequest, type TranslationResult } from './JobWorker';
import { ProgressTracker } from './ProgressTracker';

/**
 * Job status information
 */
export interface JobStatusInfo {
  id: string;
  type: 'translation';
  status: JobStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  result?: TranslationResult;
  error?: string;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxConcurrent?: number;
  maxRetries?: number;
}

/**
 * Queue filter options
 */
export interface QueueFilter {
  status?: JobStatus;
}

/**
 * JobQueue - Manages background job processing
 */
export class JobQueue {
  private db: DatabaseService;
  private translationService: TranslationService;
  private worker: JobWorker;
  private progressTracker: ProgressTracker;
  private maxConcurrent: number;
  private processingJobs: Set<string> = new Set();
  private isShuttingDown = false;
  private processInterval?: NodeJS.Timeout;

  constructor(
    db: DatabaseService,
    translationService: TranslationService,
    config?: QueueConfig
  ) {
    this.db = db;
    this.translationService = translationService;
    this.maxConcurrent = config?.maxConcurrent || 3;

    // Initialize progress tracker and worker
    this.progressTracker = new ProgressTracker(db);
    this.worker = new JobWorker(db, translationService, this.progressTracker, {
      maxRetries: config?.maxRetries || 3,
    });

    // Load pending jobs from database and start processing
    this.initialize();
  }

  /**
   * Initialize queue by loading pending jobs from database
   */
  private async initialize(): Promise<void> {
    try {
      console.log('[JobQueue] Initializing queue...');

      // Load pending and processing jobs from database
      const pendingJobs = await this.loadPendingJobs();
      console.log(`[JobQueue] Loaded ${pendingJobs.length} pending/processing jobs from database`);

      // Start processing loop
      this.startProcessing();
    } catch (error) {
      console.error('[JobQueue] Failed to initialize queue:', error);
    }
  }

  /**
   * Load pending and processing jobs from database
   */
  private async loadPendingJobs(): Promise<Job[]> {
    const sql = this.db.dialect === 'postgres'
      ? `SELECT * FROM jobs WHERE status IN ('pending', 'processing') ORDER BY created_at ASC`
      : `SELECT * FROM jobs WHERE status IN ('pending', 'processing') ORDER BY created_at ASC`;

    const rows = await this.db.query(sql);

    return rows.map((row: any) => this.mapRowToJob(row));
  }

  /**
   * Enqueue a new translation job
   */
  async enqueue(request: TranslationRequest): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Queue is shutting down');
    }

    const jobId = randomUUID();
    const now = new Date();

    console.log(`[JobQueue] Enqueueing job ${jobId}`);

    // Insert job into database
    if (this.db.dialect === 'postgres') {
      await this.db.query(
        `INSERT INTO jobs (id, type, status, request, progress, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [jobId, 'translation', 'pending', JSON.stringify(request), 0, now]
      );
    } else {
      // SQLite
      await this.db.query(
        `INSERT INTO jobs (id, type, status, request, progress, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [jobId, 'translation', 'pending', JSON.stringify(request), 0, now.toISOString()]
      );
    }

    console.log(`[JobQueue] Job ${jobId} enqueued successfully`);

    // Trigger processing (don't await)
    this.processQueue().catch(error => {
      console.error('[JobQueue] Error in processQueue:', error);
    });

    return jobId;
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<JobStatusInfo> {
    const sql = this.db.dialect === 'postgres'
      ? `SELECT * FROM jobs WHERE id = $1`
      : `SELECT * FROM jobs WHERE id = ?`;

    const rows = await this.db.query(sql, [jobId]);

    if (rows.length === 0) {
      throw new Error('Job not found');
    }

    const job = this.mapRowToJob(rows[0]);

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      result: job.result,
      error: job.error,
    };
  }

  /**
   * Cancel a pending job
   */
  async cancel(jobId: string): Promise<void> {
    const status = await this.getStatus(jobId);

    if (status.status === 'completed' || status.status === 'failed') {
      throw new Error(`Cannot cancel job in status: ${status.status}`);
    }

    if (status.status === 'cancelled') {
      return; // Already cancelled
    }

    // If job is processing, we can't cancel it (would need AbortController support)
    if (status.status === 'processing') {
      throw new Error('Cannot cancel job that is currently processing');
    }

    const now = new Date();

    // Update job status to cancelled
    if (this.db.dialect === 'postgres') {
      await this.db.query(
        `UPDATE jobs SET status = $1, cancelled_at = $2 WHERE id = $3`,
        ['cancelled', now, jobId]
      );
    } else {
      await this.db.query(
        `UPDATE jobs SET status = ?, cancelled_at = ? WHERE id = ?`,
        ['cancelled', now.toISOString(), jobId]
      );
    }

    console.log(`[JobQueue] Job ${jobId} cancelled`);
  }

  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<void> {
    const status = await this.getStatus(jobId);

    if (status.status !== 'failed') {
      throw new Error('Can only retry failed jobs');
    }

    // Reset job to pending
    if (this.db.dialect === 'postgres') {
      await this.db.query(
        `UPDATE jobs SET status = $1, error = NULL, progress = 0, started_at = NULL WHERE id = $2`,
        ['pending', jobId]
      );
    } else {
      await this.db.query(
        `UPDATE jobs SET status = ?, error = NULL, progress = 0, started_at = NULL WHERE id = ?`,
        ['pending', jobId]
      );
    }

    console.log(`[JobQueue] Job ${jobId} reset to pending for retry`);

    // Trigger processing
    this.processQueue().catch(error => {
      console.error('[JobQueue] Error in processQueue:', error);
    });
  }

  /**
   * Get all jobs in queue
   */
  async getQueue(filter?: QueueFilter): Promise<Job[]> {
    let sql = 'SELECT * FROM jobs';
    const params: any[] = [];

    if (filter?.status) {
      if (this.db.dialect === 'postgres') {
        sql += ' WHERE status = $1';
        params.push(filter.status);
      } else {
        sql += ' WHERE status = ?';
        params.push(filter.status);
      }
    }

    sql += ' ORDER BY created_at ASC';

    const rows = await this.db.query(sql, params);
    return rows.map((row: any) => this.mapRowToJob(row));
  }

  /**
   * Start automatic queue processing
   */
  private startProcessing(): void {
    if (this.processInterval) {
      return; // Already started
    }

    console.log('[JobQueue] Starting automatic queue processing');

    // Process queue every 1 second
    this.processInterval = setInterval(() => {
      this.processQueue().catch(error => {
        console.error('[JobQueue] Error in processQueue:', error);
      });
    }, 1000);
  }

  /**
   * Process pending jobs in the queue
   */
  async processQueue(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    // Check how many jobs are currently processing
    const processingCount = this.processingJobs.size;

    if (processingCount >= this.maxConcurrent) {
      // At capacity, wait for jobs to complete
      return;
    }

    // Get pending jobs
    const pendingJobs = await this.getQueue({ status: 'pending' });

    if (pendingJobs.length === 0) {
      return; // No pending jobs
    }

    // Process up to maxConcurrent jobs
    const jobsToProcess = pendingJobs.slice(0, this.maxConcurrent - processingCount);

    for (const job of jobsToProcess) {
      // Don't await - process in parallel
      this.processJobAsync(job);
    }
  }

  /**
   * Process a single job asynchronously
   */
  private async processJobAsync(job: Job): Promise<void> {
    if (this.processingJobs.has(job.id)) {
      return; // Already processing
    }

    this.processingJobs.add(job.id);

    try {
      await this.worker.processJobWithRetry(job);
    } catch (error) {
      console.error(`[JobQueue] Job ${job.id} failed after all retries:`, error);
    } finally {
      this.processingJobs.delete(job.id);

      // Trigger next batch of jobs
      this.processQueue().catch(error => {
        console.error('[JobQueue] Error in processQueue:', error);
      });
    }
  }

  /**
   * Gracefully shutdown the queue
   */
  async shutdown(): Promise<void> {
    console.log('[JobQueue] Shutting down...');
    this.isShuttingDown = true;

    // Stop processing new jobs
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = undefined;
    }

    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingJobs.size > 0 && Date.now() - startTime < timeout) {
      console.log(`[JobQueue] Waiting for ${this.processingJobs.size} jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.processingJobs.size > 0) {
      console.warn(`[JobQueue] Shutdown timeout: ${this.processingJobs.size} jobs still processing`);
    } else {
      console.log('[JobQueue] All jobs completed, shutdown complete');
    }
  }

  /**
   * Map database row to Job object
   */
  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      request: typeof row.request === 'string' ? JSON.parse(row.request) : row.request,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : undefined,
      error: row.error || undefined,
      progress: row.progress,
      createdAt: new Date(row.created_at || row.createdAt),
      startedAt: row.started_at || row.startedAt ? new Date(row.started_at || row.startedAt) : undefined,
      completedAt: row.completed_at || row.completedAt ? new Date(row.completed_at || row.completedAt) : undefined,
      cancelledAt: row.cancelled_at || row.cancelledAt ? new Date(row.cancelled_at || row.cancelledAt) : undefined,
    };
  }
}
