/**
 * JobWorker - Processes individual jobs from the queue
 * Task 3.2.1.4: Implement job worker
 *
 * Features:
 * - Processes translation jobs
 * - Updates progress during translation
 * - Handles errors with retry logic
 * - Integrates with TranslationService
 */

import { TranslationService } from '../translationService';
import { ProgressTracker } from './ProgressTracker';
import { DatabaseService } from '../../core/database';
import type { TranslationConfig, TranslationChunk } from '../translation/types';

/**
 * Translation request structure
 */
export interface TranslationRequest {
  sourceText: string;
  config?: Partial<TranslationConfig>;
  chunks?: TranslationChunk[];
}

/**
 * Translation result structure
 */
export interface TranslationResult {
  translation: string;
  confidence: number;
  processingTime: number;
  metadata?: any;
}

/**
 * Job structure
 */
export interface Job {
  id: string;
  type: 'translation';
  status: JobStatus;
  request: TranslationRequest;
  result?: TranslationResult;
  error?: string;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * JobWorker - Processes individual jobs
 */
export class JobWorker {
  private translationService: TranslationService;
  private progressTracker: ProgressTracker;
  private db: DatabaseService;
  private maxRetries: number;

  constructor(
    db: DatabaseService,
    translationService: TranslationService,
    progressTracker: ProgressTracker,
    config?: { maxRetries?: number }
  ) {
    this.db = db;
    this.translationService = translationService;
    this.progressTracker = progressTracker;
    this.maxRetries = config?.maxRetries || 3;
  }

  /**
   * Process a single job
   */
  async processJob(job: Job, abortSignal?: AbortSignal): Promise<void> {
    console.log(`[JobWorker] Starting job ${job.id}`);
    const startTime = Date.now();

    try {
      // Update job status to processing
      await this.updateJobStatus(job.id, 'processing', { startedAt: new Date() });

      // Process the translation request
      const result = await this.executeTranslation(job, abortSignal);

      // Mark job as completed
      const processingTime = Date.now() - startTime;
      await this.updateJobStatus(job.id, 'completed', {
        result,
        completedAt: new Date(),
      });

      console.log(`[JobWorker] Completed job ${job.id} in ${processingTime}ms`);
    } catch (error) {
      console.error(`[JobWorker] Job ${job.id} failed:`, error);

      // Update job status to failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateJobStatus(job.id, 'failed', {
        error: errorMessage,
      });

      throw error;
    } finally {
      // Cleanup progress tracking
      await this.progressTracker.cleanup(job.id);
    }
  }

  /**
   * Execute the translation with progress tracking
   */
  private async executeTranslation(
    job: Job,
    abortSignal?: AbortSignal
  ): Promise<TranslationResult> {
    const { sourceText, config, chunks } = job.request;

    // If chunks are provided, process them individually with progress tracking
    if (chunks && chunks.length > 0) {
      return await this.processChunkedTranslation(job.id, chunks, config, abortSignal);
    }

    // Single text translation
    return await this.processSingleTranslation(sourceText, config, abortSignal);
  }

  /**
   * Process a single text translation
   */
  private async processSingleTranslation(
    sourceText: string,
    config?: Partial<TranslationConfig>,
    abortSignal?: AbortSignal
  ): Promise<TranslationResult> {
    const chunk: TranslationChunk = {
      pageNumber: 1,
      content: sourceText,
    };

    const result = await this.translationService.translateText(chunk, config, abortSignal);

    return {
      translation: result.translation,
      confidence: result.confidence,
      processingTime: result.processingTime || 0,
      metadata: {
        quality: result.quality,
        modelAgreement: result.modelAgreement,
        iterationsUsed: result.iterationsUsed,
        helperModels: result.helperModels,
        validationMetadata: result.validationMetadata,
      },
    };
  }

  /**
   * Process chunked translation with progress tracking
   */
  private async processChunkedTranslation(
    jobId: string,
    chunks: TranslationChunk[],
    config?: Partial<TranslationConfig>,
    abortSignal?: AbortSignal
  ): Promise<TranslationResult> {
    // Initialize progress tracking
    await this.progressTracker.initialize(jobId, chunks.length);

    const translations: string[] = [];
    let totalConfidence = 0;
    let totalProcessingTime = 0;
    const metadata: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      console.log(`[JobWorker] Processing chunk ${i + 1}/${chunks.length} for job ${jobId}`);

      // Translate chunk
      const result = await this.translationService.translateText(chunk, config, abortSignal);

      translations.push(result.translation);
      totalConfidence += result.confidence;
      totalProcessingTime += result.processingTime || 0;
      metadata.push({
        pageNumber: chunk.pageNumber,
        confidence: result.confidence,
        quality: result.quality,
      });

      // Update progress
      await this.progressTracker.updateProgress(jobId, i + 1);
    }

    // Combine translations
    const combinedTranslation = translations.join('\n\n');
    const avgConfidence = totalConfidence / chunks.length;

    return {
      translation: combinedTranslation,
      confidence: avgConfidence,
      processingTime: totalProcessingTime,
      metadata: {
        chunksProcessed: chunks.length,
        perChunkMetadata: metadata,
      },
    };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates: {
      startedAt?: Date;
      completedAt?: Date;
      result?: TranslationResult;
      error?: string;
    } = {}
  ): Promise<void> {
    try {
      if (this.db.dialect === 'postgres') {
        const setClauses: string[] = ['status = $1'];
        const values: any[] = [status];
        let paramIndex = 2;

        if (updates.startedAt) {
          setClauses.push(`started_at = $${paramIndex++}`);
          values.push(updates.startedAt);
        }
        if (updates.completedAt) {
          setClauses.push(`completed_at = $${paramIndex++}`);
          values.push(updates.completedAt);
        }
        if (updates.result) {
          setClauses.push(`result = $${paramIndex++}`);
          values.push(JSON.stringify(updates.result));
        }
        if (updates.error) {
          setClauses.push(`error = $${paramIndex++}`);
          values.push(updates.error);
        }

        values.push(jobId);

        await this.db.query(
          `UPDATE jobs SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values
        );
      } else {
        // SQLite
        const setClauses: string[] = ['status = ?'];
        const values: any[] = [status];

        if (updates.startedAt) {
          setClauses.push('started_at = ?');
          values.push(updates.startedAt.toISOString());
        }
        if (updates.completedAt) {
          setClauses.push('completed_at = ?');
          values.push(updates.completedAt.toISOString());
        }
        if (updates.result) {
          setClauses.push('result = ?');
          values.push(JSON.stringify(updates.result));
        }
        if (updates.error) {
          setClauses.push('error = ?');
          values.push(updates.error);
        }

        values.push(jobId);

        await this.db.query(
          `UPDATE jobs SET ${setClauses.join(', ')} WHERE id = ?`,
          values
        );
      }

      console.log(`[JobWorker] Updated job ${jobId} status to ${status}`);
    } catch (error) {
      console.error(`[JobWorker] Failed to update job ${jobId} status:`, error);
      throw error;
    }
  }

  /**
   * Process job with retry logic
   */
  async processJobWithRetry(job: Job, abortSignal?: AbortSignal): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.processJob(job, abortSignal);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[JobWorker] Job ${job.id} attempt ${attempt}/${this.maxRetries} failed:`, error);

        // If this is not the last attempt, wait before retrying
        if (attempt < this.maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.log(`[JobWorker] Retrying job ${job.id} in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries failed
    throw lastError || new Error('Job failed after all retries');
  }
}
