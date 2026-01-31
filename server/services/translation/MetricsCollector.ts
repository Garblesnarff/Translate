/**
 * Metrics Collector
 *
 * Collects and stores translation metrics for monitoring and analysis.
 * Tracks quality, performance, and gate pass/fail rates.
 *
 * Phase 2.4.3 Implementation:
 * - Track gate pass/fail rates
 * - Track confidence score distribution
 * - Track processing times
 * - Track retry rates
 *
 * @author Translation Service Team
 */

import { db } from '@db/index';
import { getTables } from '@db/config';
import { GateRunResults } from './QualityGates';

/**
 * Translation metrics to be stored
 */
export interface TranslationMetrics {
  // Identification
  translationId?: string;
  sessionId?: string;
  timestamp: Date;

  // Quality metrics
  confidenceScore: number;
  qualityScore?: number;
  modelAgreement?: number;
  formatScore?: number;

  // Performance metrics
  processingTimeMs: number;
  tokensProcessed?: number;
  apiLatencyMs?: number;

  // Usage metrics
  modelUsed: string;
  iterationsUsed: number;
  retriesNeeded: number;
  helperModelsUsed?: string[];

  // Gate metrics
  gatesPassed: boolean;
  gateResults?: { [gateName: string]: boolean };
  failedGates?: string[];

  // Document metadata
  pageNumber?: number;
  documentId?: string;
  textLength: number;

  // Error metrics
  errorOccurred: boolean;
  errorType?: string;
  errorMessage?: string;
}

/**
 * Aggregated metrics for reporting
 */
export interface AggregatedMetrics {
  totalTranslations: number;
  averageConfidence: number;
  averageProcessingTime: number;
  averageIterations: number;
  gatePassRate: number;
  retryRate: number;
  errorRate: number;
  gateBreakdown: {
    [gateName: string]: {
      passRate: number;
      totalChecks: number;
    };
  };
}

/**
 * Metrics Collector Class
 * Collects, buffers, and stores translation metrics
 */
export class MetricsCollector {
  private metricsBuffer: TranslationMetrics[] = [];
  private readonly BUFFER_SIZE = 10; // Flush after 10 metrics
  private readonly FLUSH_INTERVAL_MS = 30000; // Or flush every 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private tables: any;

  constructor() {
    this.tables = getTables();
    this.startFlushTimer();
  }

  /**
   * Record a translation metric
   */
  public async recordMetric(metric: TranslationMetrics): Promise<void> {
    try {
      // Add to buffer
      this.metricsBuffer.push(metric);

      // Flush if buffer is full
      if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
        await this.flush();
      }
    } catch (error) {
      console.error('[MetricsCollector] Failed to record metric:', error);
    }
  }

  /**
   * Record metrics from a translation result
   */
  public async recordTranslationResult(
    result: {
      translation: string;
      originalText: string;
      confidence: number;
      quality?: any;
      modelAgreement?: number;
      iterationsUsed: number;
      helperModels?: string[];
      processingTime: number;
      validationMetadata?: any;
    },
    gateResults?: GateRunResults,
    options?: {
      translationId?: string;
      sessionId?: string;
      pageNumber?: number;
      documentId?: string;
      modelUsed?: string;
      retriesNeeded?: number;
    }
  ): Promise<void> {
    const metric: TranslationMetrics = {
      translationId: options?.translationId,
      sessionId: options?.sessionId,
      timestamp: new Date(),

      // Quality metrics
      confidenceScore: result.confidence,
      qualityScore: result.quality?.overallScore,
      modelAgreement: result.modelAgreement,
      formatScore: result.validationMetadata?.outputValidation?.formatCompliance,

      // Performance metrics
      processingTimeMs: result.processingTime,
      tokensProcessed: undefined, // Could be added later
      apiLatencyMs: undefined,

      // Usage metrics
      modelUsed: options?.modelUsed || 'gemini-2.0-flash-exp',
      iterationsUsed: result.iterationsUsed,
      retriesNeeded: options?.retriesNeeded || 0,
      helperModelsUsed: result.helperModels,

      // Gate metrics
      gatesPassed: gateResults?.passed || true,
      gateResults: gateResults ? this.extractGateResults(gateResults) : undefined,
      failedGates: gateResults ? this.extractFailedGates(gateResults) : undefined,

      // Document metadata
      pageNumber: options?.pageNumber,
      documentId: options?.documentId,
      textLength: result.originalText.length,

      // Error metrics
      errorOccurred: false
    };

    await this.recordMetric(metric);
  }

  /**
   * Record an error metric
   */
  public async recordError(
    error: Error,
    context: {
      sessionId?: string;
      pageNumber?: number;
      documentId?: string;
      textLength?: number;
      processingTimeMs?: number;
    }
  ): Promise<void> {
    const metric: TranslationMetrics = {
      sessionId: context.sessionId,
      timestamp: new Date(),

      // Set to defaults for error case
      confidenceScore: 0,
      processingTimeMs: context.processingTimeMs || 0,
      modelUsed: 'unknown',
      iterationsUsed: 0,
      retriesNeeded: 0,

      // Document metadata
      pageNumber: context.pageNumber,
      documentId: context.documentId,
      textLength: context.textLength || 0,

      // Gate metrics
      gatesPassed: false,

      // Error metrics
      errorOccurred: true,
      errorType: error.name,
      errorMessage: error.message
    };

    await this.recordMetric(metric);
  }

  /**
   * Flush metrics buffer to database
   */
  public async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Check if table exists before trying to insert
      if (!this.tables.translationMetrics) {
        console.warn('[MetricsCollector] translation_metrics table not available, skipping flush');
        return;
      }

      // Insert metrics into database
      for (const metric of metricsToFlush) {
        await db.insert(this.tables.translationMetrics).values({
          translationId: metric.translationId?.toString(),
          sessionId: metric.sessionId,
          timestamp: metric.timestamp.toISOString(),

          confidenceScore: metric.confidenceScore.toString(),
          qualityScore: metric.qualityScore?.toString() || null,
          modelAgreement: metric.modelAgreement?.toString() || null,
          formatScore: metric.formatScore?.toString() || null,

          processingTimeMs: metric.processingTimeMs,
          tokensProcessed: metric.tokensProcessed,
          apiLatencyMs: metric.apiLatencyMs,

          modelUsed: metric.modelUsed,
          iterationsUsed: metric.iterationsUsed,
          retriesNeeded: metric.retriesNeeded,
          helperModelsUsed: metric.helperModelsUsed ? JSON.stringify(metric.helperModelsUsed) : null,

          gatesPassed: metric.gatesPassed ? 1 : 0,
          gateResults: metric.gateResults ? JSON.stringify(metric.gateResults) : null,
          failedGates: metric.failedGates ? JSON.stringify(metric.failedGates) : null,

          pageNumber: metric.pageNumber,
          documentId: metric.documentId,
          textLength: metric.textLength,

          errorOccurred: metric.errorOccurred ? 1 : 0,
          errorType: metric.errorType,
          errorMessage: metric.errorMessage
        });
      }

      console.log(`[MetricsCollector] Flushed ${metricsToFlush.length} metrics to database`);
    } catch (error) {
      console.error('[MetricsCollector] Failed to flush metrics:', error);
      // Restore metrics to buffer if flush failed
      this.metricsBuffer.unshift(...this.metricsBuffer);
    }
  }

  /**
   * Get aggregated metrics for a time period
   */
  public async getAggregatedMetrics(
    startDate: Date,
    endDate: Date,
    documentId?: string
  ): Promise<AggregatedMetrics> {
    try {
      if (!this.tables.translationMetrics) {
        return this.getEmptyAggregatedMetrics();
      }

      // This is a simplified version - in production you'd use proper SQL aggregation
      const metrics = await db
        .select()
        .from(this.tables.translationMetrics)
        .where((eb: any) => {
          let condition = eb.and([
            eb.gte('timestamp', startDate),
            eb.lte('timestamp', endDate)
          ]);

          if (documentId) {
            condition = eb.and([condition, eb.eq('documentId', documentId)]);
          }

          return condition;
        });

      if (metrics.length === 0) {
        return this.getEmptyAggregatedMetrics();
      }

      // Calculate aggregates
      const totalTranslations = metrics.length;
      const averageConfidence = metrics.reduce((sum: number, m: any) => sum + parseFloat(m.confidenceScore), 0) / totalTranslations;
      const averageProcessingTime = metrics.reduce((sum: number, m: any) => sum + m.processingTimeMs, 0) / totalTranslations;
      const averageIterations = metrics.reduce((sum: number, m: any) => sum + m.iterationsUsed, 0) / totalTranslations;

      const gatesPassed = metrics.filter((m: any) => m.gatesPassed).length;
      const gatePassRate = gatesPassed / totalTranslations;

      const retriesNeeded = metrics.filter((m: any) => m.retriesNeeded > 0).length;
      const retryRate = retriesNeeded / totalTranslations;

      const errorsOccurred = metrics.filter((m: any) => m.errorOccurred).length;
      const errorRate = errorsOccurred / totalTranslations;

      // Calculate gate breakdown
      const gateBreakdown = this.calculateGateBreakdown(metrics);

      return {
        totalTranslations,
        averageConfidence,
        averageProcessingTime,
        averageIterations,
        gatePassRate,
        retryRate,
        errorRate,
        gateBreakdown
      };
    } catch (error) {
      console.error('[MetricsCollector] Failed to get aggregated metrics:', error);
      return this.getEmptyAggregatedMetrics();
    }
  }

  /**
   * Extract gate results from GateRunResults
   */
  private extractGateResults(gateResults: GateRunResults): { [gateName: string]: boolean } {
    const results: { [gateName: string]: boolean } = {};

    for (const [name, result] of Object.entries(gateResults.gates)) {
      results[name] = result.passed;
    }

    return results;
  }

  /**
   * Extract failed gates from GateRunResults
   */
  private extractFailedGates(gateResults: GateRunResults): string[] {
    return Object.entries(gateResults.gates)
      .filter(([_, result]) => !result.passed)
      .map(([name, _]) => name);
  }

  /**
   * Calculate gate breakdown from metrics
   */
  private calculateGateBreakdown(metrics: any[]): AggregatedMetrics['gateBreakdown'] {
    const breakdown: AggregatedMetrics['gateBreakdown'] = {};

    for (const metric of metrics) {
      if (!metric.gateResults) continue;

      const gateResults = typeof metric.gateResults === 'string'
        ? JSON.parse(metric.gateResults)
        : metric.gateResults;

      for (const [gateName, passed] of Object.entries(gateResults)) {
        if (!breakdown[gateName]) {
          breakdown[gateName] = { passRate: 0, totalChecks: 0 };
        }

        breakdown[gateName].totalChecks++;
        if (passed) {
          breakdown[gateName].passRate++;
        }
      }
    }

    // Convert to percentages
    for (const gateName in breakdown) {
      const total = breakdown[gateName].totalChecks;
      breakdown[gateName].passRate = total > 0 ? breakdown[gateName].passRate / total : 0;
    }

    return breakdown;
  }

  /**
   * Get empty aggregated metrics
   */
  private getEmptyAggregatedMetrics(): AggregatedMetrics {
    return {
      totalTranslations: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      averageIterations: 0,
      gatePassRate: 0,
      retryRate: 0,
      errorRate: 0,
      gateBreakdown: {}
    };
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop flush timer and flush remaining metrics
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await metricsCollector.shutdown();
});

process.on('SIGINT', async () => {
  await metricsCollector.shutdown();
});
