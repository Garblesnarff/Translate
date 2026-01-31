/**
 * Metrics Controller
 *
 * Handles HTTP requests for extraction metrics and quality reports.
 *
 * Phase 1.4 of Knowledge Graph implementation
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '@db/index';
import { entities, extractionJobs, relationships } from '@db/schema';
import { sql, desc, count } from 'drizzle-orm';

/**
 * GET /api/metrics/aggregate
 *
 * Get aggregate metrics across all extractions
 */
export async function getAggregateMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log('[Metrics Controller] Fetching aggregate metrics');

    // Get total entities by type
    const entityTypeBreakdown = await db
      .select({
        type: entities.type,
        count: count(),
      })
      .from(entities)
      .groupBy(entities.type);

    // Get confidence distribution
    const confidenceDistribution = await db
      .select({
        confidenceRange: sql<string>`
          CASE
            WHEN CAST(${entities.confidence} AS REAL) < 0.3 THEN '0-30%'
            WHEN CAST(${entities.confidence} AS REAL) < 0.5 THEN '30-50%'
            WHEN CAST(${entities.confidence} AS REAL) < 0.7 THEN '50-70%'
            WHEN CAST(${entities.confidence} AS REAL) < 0.9 THEN '70-90%'
            ELSE '90-100%'
          END
        `,
        count: count(),
      })
      .from(entities)
      .groupBy(sql`
        CASE
          WHEN CAST(${entities.confidence} AS REAL) < 0.3 THEN '0-30%'
          WHEN CAST(${entities.confidence} AS REAL) < 0.5 THEN '30-50%'
          WHEN CAST(${entities.confidence} AS REAL) < 0.7 THEN '50-70%'
          WHEN CAST(${entities.confidence} AS REAL) < 0.9 THEN '70-90%'
          ELSE '90-100%'
        END
      `);

    // Get total counts
    const [totalEntitiesResult] = await db
      .select({
        total: count(),
      })
      .from(entities);

    const [totalRelationshipsResult] = await db
      .select({
        total: count(),
      })
      .from(relationships);

    // Get average confidence
    const [avgConfidenceResult] = await db
      .select({
        avgConfidence: sql<string>`AVG(CAST(${entities.confidence} AS REAL))`,
      })
      .from(entities);

    // Get entities needing review (confidence < 0.5)
    const [needsReviewResult] = await db
      .select({
        count: count(),
      })
      .from(entities)
      .where(sql`CAST(${entities.confidence} AS REAL) < 0.5`);

    // Get verified entities
    const [verifiedEntitiesResult] = await db
      .select({
        count: count(),
      })
      .from(entities)
      .where(sql`${entities.verified} = 1`);

    // Get recent extraction jobs for processing time
    const recentJobs = await db
      .select({
        processingTime: sql<number>`
          CAST(
            (julianday(${extractionJobs.completedAt}) - julianday(${extractionJobs.startedAt})) * 86400000 AS INTEGER
          )
        `,
      })
      .from(extractionJobs)
      .where(sql`${extractionJobs.status} = 'completed'`)
      .limit(50);

    const avgProcessingTime = recentJobs.length > 0
      ? Math.round(recentJobs.reduce((sum: number, job: { processingTime: number | null }) => sum + (job.processingTime || 0), 0) / recentJobs.length)
      : 0;

    // Return aggregate metrics
    res.status(200).json({
      success: true,
      metrics: {
        totalEntities: totalEntitiesResult.total,
        totalRelationships: totalRelationshipsResult.total,
        avgConfidence: parseFloat(avgConfidenceResult.avgConfidence || '0'),
        needsReview: needsReviewResult.count,
        verifiedEntities: verifiedEntitiesResult.count,
        avgProcessingTime,
        entityTypeBreakdown: entityTypeBreakdown.map((item: { type: string; count: number }) => ({
          type: item.type,
          count: item.count,
        })),
        confidenceBreakdown: confidenceDistribution.map((item: { confidenceRange: string; count: number }) => ({
          range: item.confidenceRange,
          count: item.count,
        })),
      },
    });
  } catch (error) {
    console.error('[Metrics Controller] Failed to get aggregate metrics:', error);
    next(error);
  }
}

/**
 * GET /api/metrics/quality
 *
 * Get quality report with alerts and issues
 */
export async function getQualityReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log('[Metrics Controller] Generating quality report');

    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      count?: number;
    }> = [];

    // Check for low confidence entities
    const [lowConfidenceResult] = await db
      .select({
        count: count(),
      })
      .from(entities)
      .where(sql`CAST(${entities.confidence} AS REAL) < 0.3`);

    if (lowConfidenceResult.count > 0) {
      alerts.push({
        type: 'warning',
        message: `${lowConfidenceResult.count} entities with very low confidence (<30%)`,
        count: lowConfidenceResult.count,
      });
    }

    // Check for entities needing review
    const [needsReviewResult] = await db
      .select({
        count: count(),
      })
      .from(entities)
      .where(sql`CAST(${entities.confidence} AS REAL) < 0.5 AND ${entities.verified} = 0`);

    if (needsReviewResult.count > 100) {
      alerts.push({
        type: 'warning',
        message: `${needsReviewResult.count} unverified entities need review`,
        count: needsReviewResult.count,
      });
    }

    // Check for failed extraction jobs
    const [failedJobsResult] = await db
      .select({
        count: count(),
      })
      .from(extractionJobs)
      .where(sql`${extractionJobs.status} = 'failed'`);

    if (failedJobsResult.count > 0) {
      alerts.push({
        type: 'error',
        message: `${failedJobsResult.count} extraction jobs failed`,
        count: failedJobsResult.count,
      });
    }

    // Check for entities without relationships
    const entitiesWithoutRelationships = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${entities.id})`,
      })
      .from(entities)
      .leftJoin(
        relationships,
        sql`${entities.id} = ${relationships.subjectId} OR ${entities.id} = ${relationships.objectId}`
      )
      .where(sql`${relationships.id} IS NULL`);

    const orphanedEntitiesCount = entitiesWithoutRelationships[0]?.count || 0;
    if (orphanedEntitiesCount > 0) {
      alerts.push({
        type: 'info',
        message: `${orphanedEntitiesCount} entities have no relationships`,
        count: orphanedEntitiesCount,
      });
    }

    // Add success message if no issues
    if (alerts.length === 0) {
      alerts.push({
        type: 'info',
        message: 'No quality issues detected',
      });
    }

    // Return quality report
    res.status(200).json({
      success: true,
      qualityReport: {
        alerts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Metrics Controller] Failed to generate quality report:', error);
    next(error);
  }
}

/**
 * GET /api/extract/jobs
 *
 * Get recent extraction jobs
 */
export async function getRecentExtractionJobs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    console.log(`[Metrics Controller] Fetching ${limit} recent extraction jobs`);

    const jobs = await db
      .select({
        id: extractionJobs.id,
        translationId: extractionJobs.translationId,
        status: extractionJobs.status,
        entityCount: extractionJobs.entitiesExtracted,
        relationshipCount: extractionJobs.relationshipsExtracted,
        averageConfidence: extractionJobs.confidenceAvg,
        processingTime: sql<number>`
          CASE
            WHEN ${extractionJobs.completedAt} IS NOT NULL AND ${extractionJobs.startedAt} IS NOT NULL
            THEN CAST(
              (julianday(${extractionJobs.completedAt}) - julianday(${extractionJobs.startedAt})) * 86400000 AS INTEGER
            )
            ELSE NULL
          END
        `,
        startedAt: extractionJobs.startedAt,
        completedAt: extractionJobs.completedAt,
        error: extractionJobs.errorMessage,
      })
      .from(extractionJobs)
      .orderBy(desc(extractionJobs.createdAt))
      .limit(limit);

    res.status(200).json({
      success: true,
      jobs: jobs.map((job: any) => ({
        ...job,
        averageConfidence: job.averageConfidence ? parseFloat(job.averageConfidence) : null,
      })),
    });
  } catch (error) {
    console.error('[Metrics Controller] Failed to get recent extraction jobs:', error);
    next(error);
  }
}
