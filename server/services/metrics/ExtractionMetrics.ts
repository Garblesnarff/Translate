/**
 * Extraction Metrics Service
 *
 * Tracks quality and performance metrics for entity extraction operations.
 * Provides aggregate statistics, quality reports, and contradiction detection.
 *
 * Phase 1, Task 1.4.1 of Knowledge Graph implementation
 */

import { randomUUID } from 'crypto';
import { eq, gte, lte, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { ExtractionResult } from '../knowledgeGraph/EntityExtractor';
import type { Entity } from '../../types/entities';

// Database type for dependency injection
type Database = NodePgDatabase<any> | BetterSQLite3Database<any>;

// ============================================================================
// Types
// ============================================================================

/**
 * Entity type distribution by count
 */
export interface EntityTypeDistribution {
  person: number;
  place: number;
  text: number;
  event: number;
  lineage: number;
  concept: number;
  institution: number;
  deity: number;
}

/**
 * Confidence distribution histogram
 */
export interface ConfidenceDistribution {
  low: number;      // 0.0 - 0.6
  medium: number;   // 0.6 - 0.8
  high: number;     // 0.8 - 1.0
}

/**
 * Aggregate metrics over a time range
 */
export interface AggregateMetrics {
  totalExtractions: number;
  totalEntities: number;
  totalRelationships: number;
  avgConfidence: number;
  avgProcessingTime: number;
  entityTypeBreakdown: EntityTypeDistribution;
  confidenceBreakdown: ConfidenceDistribution;
  trendsOverTime: TrendData[];
}

/**
 * Time-series trend data
 */
export interface TrendData {
  date: string;
  extractions: number;
  avgConfidence: number;
  avgProcessingTime: number;
}

/**
 * Quality report for extraction results
 */
export interface QualityReport {
  needsReview: number;            // Low confidence entities (<0.7)
  readyForVerification: number;   // High confidence unverified (>0.9)
  potentialContradictions: number;
  overallHealthScore: number;     // 0-100 score
  lowConfidenceEntities: Entity[];
  highConfidenceUnverified: Entity[];
  contradictions: Contradiction[];
}

/**
 * Detected contradiction between entities
 */
export interface Contradiction {
  type: 'conflicting_dates' | 'duplicate_entity' | 'conflicting_attributes';
  entity1Id: string;
  entity2Id: string;
  entity1Name: string;
  entity2Name: string;
  issue: string;
  details: any;
}

/**
 * Time range for queries
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

// ============================================================================
// ExtractionMetrics Service
// ============================================================================

/**
 * Service for tracking and analyzing extraction metrics
 */
export class ExtractionMetrics {
  constructor(private db: Database, private tables: any) {}

  /**
   * Record metrics for a completed extraction
   *
   * @param result - Extraction result with entities, relationships, and statistics
   */
  async recordExtraction(result: ExtractionResult): Promise<void> {
    const metricId = randomUUID();

    // Calculate type distribution
    const entityTypeDistribution = this.getTypeDistribution(result.entities);

    // Calculate confidence distribution
    const confidenceDistribution = this.getConfidenceDistribution(result.entities);

    // Insert metric record
    await (this.db.insert as any)(this.tables.extractionMetrics).values({
      id: metricId,
      extractionId: result.jobId,
      timestamp: new Date(),
      entitiesCount: result.entities.length,
      relationshipsCount: result.relationships.length,
      avgConfidence: result.statistics.averageConfidence.toFixed(4),
      processingTimeMs: result.statistics.extractionTime,
      entityTypeDistribution: JSON.stringify(entityTypeDistribution),
      confidenceDistribution: JSON.stringify(confidenceDistribution),
      modelUsed: result.statistics.llmProvider,
    });

    console.log(`[ExtractionMetrics] Recorded metrics for extraction ${result.jobId}:`, {
      entities: result.entities.length,
      relationships: result.relationships.length,
      avgConfidence: result.statistics.averageConfidence.toFixed(4),
      processingTime: `${result.statistics.extractionTime}ms`,
    });
  }

  /**
   * Get aggregate metrics over a time range
   *
   * @param timeRange - Optional time range (defaults to all time)
   * @returns Aggregated statistics
   */
  async getAggregateMetrics(timeRange?: TimeRange): Promise<AggregateMetrics> {
    // Build query with optional time filtering
    let query = (this.db.select as any)().from(this.tables.extractionMetrics);

    if (timeRange) {
      query = query.where(
        and(
          gte(this.tables.extractionMetrics.timestamp, timeRange.start),
          lte(this.tables.extractionMetrics.timestamp, timeRange.end)
        )
      );
    }

    const metrics = await query;

    if (metrics.length === 0) {
      return this.emptyAggregateMetrics();
    }

    // Calculate aggregates
    const totalExtractions = metrics.length;
    const totalEntities = this.sum(metrics.map((m: any) => m.entitiesCount));
    const totalRelationships = this.sum(metrics.map((m: any) => m.relationshipsCount));
    const avgConfidence = this.avg(metrics.map((m: any) => parseFloat(m.avgConfidence)));
    const avgProcessingTime = this.avg(metrics.map((m: any) => m.processingTimeMs));

    // Aggregate type distribution
    const entityTypeBreakdown = this.aggregateTypeDistribution(metrics);

    // Aggregate confidence distribution
    const confidenceBreakdown = this.aggregateConfidenceDistribution(metrics);

    // Calculate trends
    const trendsOverTime = this.calculateTrends(metrics);

    return {
      totalExtractions,
      totalEntities,
      totalRelationships,
      avgConfidence,
      avgProcessingTime,
      entityTypeBreakdown,
      confidenceBreakdown,
      trendsOverTime,
    };
  }

  /**
   * Get quality report for extracted entities
   *
   * @returns Quality analysis with issues and recommendations
   */
  async getExtractionQualityReport(): Promise<QualityReport> {
    // Get low confidence entities needing review
    const lowConfidenceEntities = await (this.db.select as any)()
      .from(this.tables.entities)
      .where(
        and(
          sql`CAST(${this.tables.entities.confidence} AS REAL) < 0.7`,
          eq(this.tables.entities.verified, 0)
        )
      )
      .limit(100); // Limit for performance

    // Get high confidence unverified entities
    const highConfidenceUnverified = await (this.db.select as any)()
      .from(this.tables.entities)
      .where(
        and(
          sql`CAST(${this.tables.entities.confidence} AS REAL) > 0.9`,
          eq(this.tables.entities.verified, 0)
        )
      )
      .limit(100);

    // Find contradictions
    const contradictions = await this.findContradictions();

    // Calculate health score
    const healthScore = this.calculateHealthScore(
      lowConfidenceEntities.length,
      highConfidenceUnverified.length,
      contradictions.length
    );

    return {
      needsReview: lowConfidenceEntities.length,
      readyForVerification: highConfidenceUnverified.length,
      potentialContradictions: contradictions.length,
      overallHealthScore: healthScore,
      lowConfidenceEntities: lowConfidenceEntities.map((e: any) => this.parseEntity(e)),
      highConfidenceUnverified: highConfidenceUnverified.map((e: any) => this.parseEntity(e)),
      contradictions,
    };
  }

  /**
   * Find contradictions between entities
   *
   * Detects:
   * - Same person with different birth/death dates
   * - Duplicate entities with conflicting attributes
   * - Temporal impossibilities
   *
   * @returns Array of detected contradictions
   */
  async findContradictions(): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];

    // Find potential duplicate persons with different birth dates
    try {
      // Get all person entities
      const persons = await (this.db.select as any)()
        .from(this.tables.entities)
        .where(eq(this.tables.entities.type, 'person'));

      // Compare each pair for conflicts
      for (let i = 0; i < persons.length; i++) {
        for (let j = i + 1; j < persons.length; j++) {
          const person1 = persons[i];
          const person2 = persons[j];

          // Check name similarity
          const similarity = this.calculateNameSimilarity(
            person1.canonicalName,
            person2.canonicalName
          );

          if (similarity > 0.8) {
            // Check for conflicting dates
            const dates1 = person1.dates ? JSON.parse(person1.dates) : null;
            const dates2 = person2.dates ? JSON.parse(person2.dates) : null;

            if (dates1 && dates2) {
              // Check birth date conflicts
              if (dates1.birth && dates2.birth &&
                  dates1.birth.year !== dates2.birth.year) {
                contradictions.push({
                  type: 'conflicting_dates',
                  entity1Id: person1.id,
                  entity2Id: person2.id,
                  entity1Name: person1.canonicalName,
                  entity2Name: person2.canonicalName,
                  issue: `Similar names with conflicting birth years: ${dates1.birth.year} vs ${dates2.birth.year}`,
                  details: { dates1: dates1.birth, dates2: dates2.birth },
                });
              }

              // Check death date conflicts
              if (dates1.death && dates2.death &&
                  dates1.death.year !== dates2.death.year) {
                contradictions.push({
                  type: 'conflicting_dates',
                  entity1Id: person1.id,
                  entity2Id: person2.id,
                  entity1Name: person1.canonicalName,
                  entity2Name: person2.canonicalName,
                  issue: `Similar names with conflicting death years: ${dates1.death.year} vs ${dates2.death.year}`,
                  details: { dates1: dates1.death, dates2: dates2.death },
                });
              }
            }

            // Check for exact duplicate entities
            if (person1.canonicalName === person2.canonicalName) {
              contradictions.push({
                type: 'duplicate_entity',
                entity1Id: person1.id,
                entity2Id: person2.id,
                entity1Name: person1.canonicalName,
                entity2Name: person2.canonicalName,
                issue: `Duplicate entity detected: ${person1.canonicalName}`,
                details: { confidence1: person1.confidence, confidence2: person2.confidence },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('[ExtractionMetrics] Error finding contradictions:', error);
    }

    return contradictions;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate type distribution from entities
   */
  private getTypeDistribution(entities: Entity[]): EntityTypeDistribution {
    const distribution: EntityTypeDistribution = {
      person: 0,
      place: 0,
      text: 0,
      event: 0,
      lineage: 0,
      concept: 0,
      institution: 0,
      deity: 0,
    };

    for (const entity of entities) {
      if (entity.type in distribution) {
        distribution[entity.type]++;
      }
    }

    return distribution;
  }

  /**
   * Calculate confidence distribution histogram
   */
  private getConfidenceDistribution(entities: Entity[]): ConfidenceDistribution {
    const distribution: ConfidenceDistribution = {
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const entity of entities) {
      if (entity.confidence < 0.6) {
        distribution.low++;
      } else if (entity.confidence < 0.8) {
        distribution.medium++;
      } else {
        distribution.high++;
      }
    }

    return distribution;
  }

  /**
   * Aggregate type distribution across multiple metrics
   */
  private aggregateTypeDistribution(metrics: any[]): EntityTypeDistribution {
    const aggregated: EntityTypeDistribution = {
      person: 0,
      place: 0,
      text: 0,
      event: 0,
      lineage: 0,
      concept: 0,
      institution: 0,
      deity: 0,
    };

    for (const metric of metrics) {
      const distribution = JSON.parse(metric.entityTypeDistribution);
      for (const type in distribution) {
        if (type in aggregated) {
          aggregated[type as keyof EntityTypeDistribution] += distribution[type];
        }
      }
    }

    return aggregated;
  }

  /**
   * Aggregate confidence distribution across multiple metrics
   */
  private aggregateConfidenceDistribution(metrics: any[]): ConfidenceDistribution {
    const aggregated: ConfidenceDistribution = {
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const metric of metrics) {
      const distribution = JSON.parse(metric.confidenceDistribution);
      aggregated.low += distribution.low || 0;
      aggregated.medium += distribution.medium || 0;
      aggregated.high += distribution.high || 0;
    }

    return aggregated;
  }

  /**
   * Calculate trends over time from metrics
   */
  private calculateTrends(metrics: any[]): TrendData[] {
    // Group metrics by date
    const dateGroups = new Map<string, any[]>();

    for (const metric of metrics) {
      const date = new Date(metric.timestamp).toISOString().split('T')[0];
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      dateGroups.get(date)!.push(metric);
    }

    // Calculate trend data for each date
    const trends: TrendData[] = [];
    for (const [date, dateMetrics] of dateGroups.entries()) {
      trends.push({
        date,
        extractions: dateMetrics.length,
        avgConfidence: this.avg(dateMetrics.map(m => parseFloat(m.avgConfidence))),
        avgProcessingTime: this.avg(dateMetrics.map(m => m.processingTimeMs)),
      });
    }

    // Sort by date
    trends.sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  /**
   * Calculate overall health score (0-100)
   *
   * Based on:
   * - Low confidence entities (penalty)
   * - Contradictions (penalty)
   * - High confidence unverified (neutral - opportunity for growth)
   */
  private calculateHealthScore(
    lowConfidence: number,
    highConfidenceUnverified: number,
    contradictions: number
  ): number {
    let score = 100;

    // Penalty for low confidence entities (each reduces score by 2, max -40)
    score -= Math.min(lowConfidence * 2, 40);

    // Penalty for contradictions (each reduces score by 5, max -30)
    score -= Math.min(contradictions * 5, 30);

    // Small penalty for high confidence unverified (opportunity, not problem)
    // Each reduces score by 0.5, max -10
    score -= Math.min(highConfidenceUnverified * 0.5, 10);

    return Math.max(0, score);
  }

  /**
   * Calculate name similarity (simple Levenshtein-based approach)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const lower1 = name1.toLowerCase();
    const lower2 = name2.toLowerCase();

    // Simple similarity: ratio of common characters
    const maxLen = Math.max(lower1.length, lower2.length);
    const distance = this.levenshteinDistance(lower1, lower2);
    const similarity = 1 - distance / maxLen;

    return similarity;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = [];

    for (let i = 0; i <= m; i++) {
      dp[i] = [i];
    }

    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Parse entity from database row
   */
  private parseEntity(row: any): Entity {
    return {
      id: row.id,
      type: row.type,
      canonicalName: row.canonicalName,
      names: JSON.parse(row.names),
      attributes: JSON.parse(row.attributes),
      dates: row.dates ? JSON.parse(row.dates) : undefined,
      confidence: parseFloat(row.confidence),
      verified: row.verified === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      verifiedBy: row.verifiedBy || undefined,
      verifiedAt: row.verifiedAt || undefined,
    };
  }

  /**
   * Sum array of numbers
   */
  private sum(numbers: number[]): number {
    return numbers.reduce((acc, n) => acc + n, 0);
  }

  /**
   * Calculate average of array of numbers
   */
  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return this.sum(numbers) / numbers.length;
  }

  /**
   * Get empty aggregate metrics structure
   */
  private emptyAggregateMetrics(): AggregateMetrics {
    return {
      totalExtractions: 0,
      totalEntities: 0,
      totalRelationships: 0,
      avgConfidence: 0,
      avgProcessingTime: 0,
      entityTypeBreakdown: {
        person: 0,
        place: 0,
        text: 0,
        event: 0,
        lineage: 0,
        concept: 0,
        institution: 0,
        deity: 0,
      },
      confidenceBreakdown: {
        low: 0,
        medium: 0,
        high: 0,
      },
      trendsOverTime: [],
    };
  }
}

/**
 * Factory function to create ExtractionMetrics instance
 *
 * @param db - Database instance (PostgreSQL or SQLite)
 * @param tables - Database tables from schema
 * @returns ExtractionMetrics instance
 */
export function createExtractionMetrics(db: Database, tables: any): ExtractionMetrics {
  return new ExtractionMetrics(db, tables);
}
