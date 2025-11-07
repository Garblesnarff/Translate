/**
 * Knowledge Graph Controller
 *
 * Handles HTTP requests for entity extraction and knowledge graph queries.
 *
 * Phase 0.3.3 of Knowledge Graph implementation
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { entityExtractor } from '../services/knowledgeGraph';
import { batchExtractor } from '../services/extraction/BatchExtractor';
import type { ExtractionContext } from '../prompts/entityExtraction';

/**
 * Request validation schemas
 */
const ExtractionRequestSchema = z.object({
  translationId: z.number().int().positive(),
  context: z.object({
    previousEntities: z.array(z.string()).optional(),
    focusAreas: z.array(z.enum([
      'people',
      'places',
      'texts',
      'events',
      'lineages',
      'concepts',
      'institutions',
      'deities'
    ])).optional(),
  }).optional(),
});

const JobIdParamSchema = z.object({
  jobId: z.string().uuid(),
});

const TranslationIdParamSchema = z.object({
  translationId: z.string().regex(/^\d+$/).transform(Number),
});

const BatchExtractionRequestSchema = z.object({
  translationIds: z.array(z.number().int().positive()).optional(),
  collectionId: z.string().optional(),
  options: z.object({
    parallel: z.number().int().positive().optional(),
  }).optional(),
}).refine(
  (data) => data.translationIds || data.collectionId,
  { message: 'Either translationIds or collectionId must be provided' }
);

const BatchJobIdParamSchema = z.object({
  batchJobId: z.string().uuid(),
});

/**
 * POST /api/kg/extract/:translationId
 *
 * Trigger entity extraction for a translation
 */
export async function extractEntities(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate translation ID from params
    const { translationId } = TranslationIdParamSchema.parse(req.params);

    // Validate optional context from body
    const context = req.body?.context as ExtractionContext | undefined;

    console.log(`[KG Controller] Starting extraction for translation ${translationId}`);

    // Trigger extraction
    const result = await entityExtractor.extractFromTranslation(translationId, context);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
        jobId: result.jobId,
      });
      return;
    }

    // Return extraction result
    res.status(200).json({
      success: true,
      jobId: result.jobId,
      statistics: result.statistics,
      entities: result.entities,
      relationships: result.relationships,
      ambiguities: result.ambiguities,
    });
  } catch (error) {
    console.error('[KG Controller] Extraction failed:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors,
      });
      return;
    }

    next(error);
  }
}

/**
 * GET /api/kg/extract/status/:jobId
 *
 * Get extraction job status and statistics
 */
export async function getExtractionStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate job ID
    const { jobId } = JobIdParamSchema.parse(req.params);

    console.log(`[KG Controller] Getting status for job ${jobId}`);

    // Get job status
    const job = await entityExtractor.getExtractionJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        error: `Extraction job ${jobId} not found`,
      });
      return;
    }

    // Return job status
    res.status(200).json({
      success: true,
      job: {
        id: job.id,
        translationId: job.translationId,
        status: job.status,
        entityCount: job.entityCount,
        relationshipCount: job.relationshipCount,
        averageConfidence: job.averageConfidence ? parseFloat(job.averageConfidence) : null,
        processingTime: job.processingTime,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        ambiguities: job.ambiguities ? JSON.parse(job.ambiguities) : [],
      },
    });
  } catch (error) {
    console.error('[KG Controller] Failed to get extraction status:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid job ID format',
        details: error.errors,
      });
      return;
    }

    next(error);
  }
}

/**
 * GET /api/kg/entities/:translationId
 *
 * Get all entities extracted from a translation
 */
export async function getEntitiesForTranslation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate translation ID
    const { translationId } = TranslationIdParamSchema.parse(req.params);

    console.log(`[KG Controller] Getting entities for translation ${translationId}`);

    // Get entities
    const entities = await entityExtractor.getEntitiesForTranslation(translationId);

    // Return entities
    res.status(200).json({
      success: true,
      translationId,
      entityCount: entities.length,
      entities,
    });
  } catch (error) {
    console.error('[KG Controller] Failed to get entities:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid translation ID format',
        details: error.errors,
      });
      return;
    }

    next(error);
  }
}

/**
 * GET /api/kg/relationships/:translationId
 *
 * Get all relationships extracted from a translation (future endpoint)
 */
export async function getRelationshipsForTranslation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: Implement in future phase
  res.status(501).json({
    success: false,
    error: 'Not yet implemented',
  });
}

/**
 * GET /api/kg/stats
 *
 * Get overall knowledge graph statistics
 */
export async function getKnowledgeGraphStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: Implement in future phase
  res.status(501).json({
    success: false,
    error: 'Not yet implemented',
  });
}

/**
 * POST /api/extract/batch
 *
 * Start batch entity extraction from multiple translations
 */
export async function handleBatchExtraction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate request body
    const { translationIds, collectionId, options } = BatchExtractionRequestSchema.parse(req.body);

    console.log('[KG Controller] Starting batch extraction:', {
      translationIds: translationIds?.length || 0,
      collectionId,
      options,
    });

    // Start batch extraction asynchronously
    // The BatchExtractor creates the job record and returns the jobId
    const extractionPromise = collectionId
      ? batchExtractor.extractFromEntireCollection(collectionId)
      : batchExtractor.extractFromMultipleDocuments(translationIds!, {
          parallel: options?.parallel,
          persistToDb: true,
        });

    // Start processing in background (don't block the response)
    extractionPromise
      .then((result) => {
        console.log(`[KG Controller] Batch extraction completed: ${result.jobId}`, {
          status: result.status,
          processed: result.statistics.documentsProcessed,
          failed: result.statistics.documentsFailed,
          entities: result.statistics.totalEntities,
        });
      })
      .catch((error) => {
        console.error('[KG Controller] Batch extraction failed:', error);
      });

    // Wait briefly to ensure the job record is created in the database
    // The BatchExtractor creates the job record immediately before processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the most recent batch job (this is a temporary workaround)
    // In production, you'd want to modify BatchExtractor to return jobId synchronously
    const recentJobs = await batchExtractor.getAllBatchJobs();
    const jobId = recentJobs.length > 0 ? recentJobs[0].id : 'unknown';

    // Return immediate response with job tracking info
    res.status(202).json({
      success: true,
      message: 'Batch extraction started',
      batchJobId: jobId,
      status: 'processing',
      totalDocuments: translationIds?.length || 0,
      hint: 'Use GET /api/extract/batch/:batchJobId to check progress',
    });

  } catch (error) {
    console.error('[KG Controller] Batch extraction request failed:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors,
      });
      return;
    }

    next(error);
  }
}

/**
 * GET /api/extract/batch/:batchJobId
 *
 * Get batch extraction job status and statistics
 */
export async function getBatchExtractionStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate batch job ID
    const { batchJobId } = BatchJobIdParamSchema.parse(req.params);

    console.log(`[KG Controller] Getting batch extraction status for job ${batchJobId}`);

    // Get batch job status
    const job = await batchExtractor.getBatchJob(batchJobId);

    if (!job) {
      res.status(404).json({
        success: false,
        error: `Batch extraction job ${batchJobId} not found`,
      });
      return;
    }

    // Calculate progress percentage
    const progress = job.totalDocuments > 0
      ? Math.round(((job.documentsProcessed + job.documentsFailed) / job.totalDocuments) * 100)
      : 0;

    // Return batch job status with detailed information
    res.status(200).json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress,
        totalDocuments: job.totalDocuments,
        documentsProcessed: job.documentsProcessed,
        documentsFailed: job.documentsFailed,
        statistics: {
          totalEntities: job.totalEntities,
          totalRelationships: job.totalRelationships,
          averageConfidence: job.avgConfidence ? parseFloat(job.avgConfidence) : null,
        },
        error: job.errorMessage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    console.error('[KG Controller] Failed to get batch extraction status:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid batch job ID format',
        details: error.errors,
      });
      return;
    }

    next(error);
  }
}
