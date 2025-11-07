/**
 * Batch Entity Extraction Service
 *
 * Processes multiple translations in parallel to extract entities and relationships
 * with progress tracking, error handling, and statistics aggregation.
 *
 * Phase 1.2.1 of Knowledge Graph implementation
 */

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@db/index';
import { getTables } from '@db/config';
import type { ExtractionResult } from '../knowledgeGraph/EntityExtractor';
import { EntityExtractor } from '../knowledgeGraph/EntityExtractor';

/**
 * Batch extraction result containing all extraction results and aggregated statistics
 */
export interface BatchExtractionResult {
  /** Batch job ID */
  jobId: string;

  /** Successful extraction results */
  results: ExtractionResult[];

  /** Errors encountered during extraction */
  errors: Array<{
    translationId: number;
    error: string;
  }>;

  /** Aggregated statistics across all documents */
  statistics: {
    documentsProcessed: number;
    documentsFailed: number;
    totalEntities: number;
    totalRelationships: number;
    averageConfidence: number;
  };

  /** Batch processing status */
  status: 'completed' | 'partial' | 'failed';

  /** Total processing time in milliseconds */
  totalTime: number;
}

/**
 * Options for batch extraction processing
 */
export interface BatchExtractionOptions {
  /** Number of documents to process in parallel (default: 3) */
  parallel?: number;

  /** Progress callback function */
  onProgress?: (completed: number, total: number) => void;

  /** Whether to persist batch job to database (default: true) */
  persistToDb?: boolean;
}

/**
 * Batch Extractor Service
 *
 * Handles batch processing of entity extraction from multiple translations
 * with parallel processing, error handling, and progress tracking.
 */
export class BatchExtractor {
  private entityExtractor: EntityExtractor;

  constructor() {
    this.entityExtractor = new EntityExtractor();
  }

  /**
   * Extract entities and relationships from multiple translations in parallel
   *
   * @param translationIds - Array of translation IDs to process
   * @param options - Batch extraction options
   * @returns Batch extraction result with aggregated statistics
   */
  async extractFromMultipleDocuments(
    translationIds: number[],
    options: BatchExtractionOptions = {}
  ): Promise<BatchExtractionResult> {
    const startTime = Date.now();
    const parallel = options.parallel || 3;
    const persistToDb = options.persistToDb !== false;
    const tables = getTables();

    // Create batch job record
    const jobId = randomUUID();

    if (persistToDb) {
      await db.insert(tables.batchExtractionJobs).values({
        id: jobId,
        status: 'processing',
        totalDocuments: translationIds.length,
        documentsProcessed: 0,
        documentsFailed: 0,
        totalEntities: 0,
        totalRelationships: 0,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }

    const results: ExtractionResult[] = [];
    const errors: Array<{ translationId: number; error: string }> = [];

    try {
      // Process translations in parallel batches
      for (let i = 0; i < translationIds.length; i += parallel) {
        const batch = translationIds.slice(i, i + parallel);

        console.log(`[BatchExtractor] Processing batch ${Math.floor(i / parallel) + 1}, documents ${i + 1}-${Math.min(i + parallel, translationIds.length)} of ${translationIds.length}`);

        // Process batch with Promise.allSettled for error resilience
        const batchResults = await Promise.allSettled(
          batch.map(id => this.entityExtractor.extractFromTranslation(id))
        );

        // Process results and collect errors
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const translationId = batch[index];
            const errorMessage = result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);

            console.error(`[BatchExtractor] Failed to extract from translation ${translationId}:`, errorMessage);

            errors.push({
              translationId,
              error: errorMessage
            });
          }
        });

        // Report progress
        const completed = Math.min(i + parallel, translationIds.length);
        if (options.onProgress) {
          options.onProgress(completed, translationIds.length);
        }

        // Update database with progress
        if (persistToDb) {
          await db
            .update(tables.batchExtractionJobs)
            .set({
              documentsProcessed: results.length,
              documentsFailed: errors.length,
            })
            .where(eq(tables.batchExtractionJobs.id, jobId));
        }
      }

      // Aggregate statistics
      const totalEntities = results.reduce((sum, r) => sum + r.statistics.entityCount, 0);
      const totalRelationships = results.reduce((sum, r) => sum + r.statistics.relationshipCount, 0);
      const avgConfidence = results.length > 0
        ? results.reduce((sum, r) => sum + r.statistics.averageConfidence, 0) / results.length
        : 0;

      const totalTime = Date.now() - startTime;

      // Determine final status
      let status: 'completed' | 'partial' | 'failed';
      if (errors.length === 0) {
        status = 'completed';
      } else if (results.length > 0) {
        status = 'partial';
      } else {
        status = 'failed';
      }

      // Update batch job with final results
      if (persistToDb) {
        await db
          .update(tables.batchExtractionJobs)
          .set({
            status: status === 'failed' ? 'failed' : 'completed',
            documentsProcessed: results.length,
            documentsFailed: errors.length,
            totalEntities,
            totalRelationships,
            avgConfidence: avgConfidence.toString(),
            completedAt: new Date().toISOString(),
            errorMessage: errors.length > 0
              ? `${errors.length} document(s) failed: ${errors.map(e => e.translationId).join(', ')}`
              : null,
          })
          .where(eq(tables.batchExtractionJobs.id, jobId));
      }

      console.log(`[BatchExtractor] Batch extraction completed:`, {
        jobId,
        totalDocuments: translationIds.length,
        successful: results.length,
        failed: errors.length,
        totalEntities,
        totalRelationships,
        avgConfidence: avgConfidence.toFixed(3),
        totalTimeMs: totalTime,
      });

      return {
        jobId,
        results,
        errors,
        statistics: {
          documentsProcessed: results.length,
          documentsFailed: errors.length,
          totalEntities,
          totalRelationships,
          averageConfidence: avgConfidence,
        },
        status,
        totalTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[BatchExtractor] Batch extraction failed:', error);

      // Update job status to failed
      if (persistToDb) {
        await db
          .update(tables.batchExtractionJobs)
          .set({
            status: 'failed',
            errorMessage,
            completedAt: new Date().toISOString(),
          })
          .where(eq(tables.batchExtractionJobs.id, jobId));
      }

      throw error;
    }
  }

  /**
   * Extract entities from all translations in a collection
   *
   * Note: This is a placeholder implementation as the schema doesn't currently
   * have a collection_id field in the translations table. This can be extended
   * when collections are added to the schema.
   *
   * @param collectionId - Collection ID to process
   * @returns Batch extraction result
   */
  async extractFromEntireCollection(collectionId: string): Promise<BatchExtractionResult> {
    const tables = getTables();

    console.log(`[BatchExtractor] Extracting from collection ${collectionId}`);

    // Get all translations in the collection
    // Note: Currently translations don't have a collection_id field
    // This is a placeholder for future implementation
    const translations = await db
      .select()
      .from(tables.translations)
      .limit(100); // Safety limit for now

    if (!translations || translations.length === 0) {
      throw new Error(`No translations found in collection ${collectionId}`);
    }

    const translationIds = translations.map((t: any) => t.id as number);

    console.log(`[BatchExtractor] Found ${translationIds.length} translations in collection`);

    return this.extractFromMultipleDocuments(
      translationIds,
      {
        parallel: 5, // Higher parallelism for collection processing
        onProgress: (completed, total) => {
          console.log(`[BatchExtractor] Collection extraction progress: ${completed}/${total} documents (${Math.round(completed / total * 100)}%)`);
        }
      }
    );
  }

  /**
   * Get batch extraction job status and results
   *
   * @param jobId - Batch job ID
   * @returns Batch job information or null if not found
   */
  async getBatchJob(jobId: string) {
    const tables = getTables();

    const job = await db
      .select()
      .from(tables.batchExtractionJobs)
      .where(eq(tables.batchExtractionJobs.id, jobId))
      .limit(1);

    if (!job || job.length === 0) {
      return null;
    }

    return job[0];
  }

  /**
   * Get all batch extraction jobs with optional status filter
   *
   * @param status - Optional status filter
   * @returns Array of batch jobs
   */
  async getAllBatchJobs(status?: 'pending' | 'processing' | 'completed' | 'failed') {
    const tables = getTables();

    let query = db.select().from(tables.batchExtractionJobs);

    if (status) {
      query = query.where(eq(tables.batchExtractionJobs.status, status)) as any;
    }

    return await query;
  }

  /**
   * Cancel a running batch extraction job
   * Note: This currently only updates the status. True cancellation would require
   * implementing a cancellation token system.
   *
   * @param jobId - Batch job ID to cancel
   */
  async cancelBatchJob(jobId: string): Promise<boolean> {
    const tables = getTables();

    const result = await db
      .update(tables.batchExtractionJobs)
      .set({
        status: 'failed',
        errorMessage: 'Cancelled by user',
        completedAt: new Date().toISOString(),
      })
      .where(eq(tables.batchExtractionJobs.id, jobId));

    return true;
  }
}

// Export singleton instance
export const batchExtractor = new BatchExtractor();
