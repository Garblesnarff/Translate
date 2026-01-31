/**
 * MetricsCollector - Collects and buffers translation metrics for analysis
 *
 * Features:
 * - Low-overhead metric collection (<1% overhead)
 * - In-memory buffering with periodic flushing
 * - Comprehensive metric tracking (performance, quality, usage, errors)
 */

export interface TranslationMetrics {
  // Performance metrics
  processingTimeMs: number;
  tokensProcessed: number;
  apiLatencyMs: number;

  // Quality metrics
  confidenceScore: number;
  qualityScore?: number;
  modelAgreement?: number;

  // Usage metrics
  modelUsed: string;
  iterationsUsed: number;
  retriesNeeded: number;

  // Business metrics
  pageNumber?: number;
  documentId?: string;
  sessionId?: string;
  timestamp: Date;

  // Error metrics
  errorType?: string;
  errorMessage?: string;

  // Additional context
  textLength: number;
  chunkCount?: number;
}

export interface MetricsSummary {
  totalTranslations: number;
  averageProcessingTime: number;
  averageConfidence: number;
  averageQuality: number;
  errorRate: number;
  totalErrors: number;
  period: {
    start: Date;
    end: Date;
  };
}

export class MetricsCollector {
  private metricsBuffer: TranslationMetrics[] = [];
  private readonly bufferSize: number;
  private readonly flushIntervalMs: number;
  private flushTimer?: NodeJS.Timeout;
  private onFlush?: (metrics: TranslationMetrics[]) => Promise<void>;

  constructor(
    bufferSize: number = 100,
    flushIntervalMs: number = 30000, // 30 seconds
    onFlush?: (metrics: TranslationMetrics[]) => Promise<void>
  ) {
    this.bufferSize = bufferSize;
    this.flushIntervalMs = flushIntervalMs;
    this.onFlush = onFlush;

    // Start periodic flushing
    this.startPeriodicFlush();
  }

  /**
   * Record a metric for a translation
   */
  recordMetric(metric: TranslationMetrics): void {
    this.metricsBuffer.push(metric);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flush().catch(error => {
        console.error('Failed to flush metrics:', error);
      });
    }
  }

  /**
   * Start periodic flushing of metrics
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.metricsBuffer.length > 0) {
        this.flush().catch(error => {
          console.error('Periodic flush failed:', error);
        });
      }
    }, this.flushIntervalMs);
  }

  /**
   * Flush buffered metrics to storage
   */
  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    if (this.onFlush) {
      try {
        await this.onFlush(metricsToFlush);
      } catch (error) {
        console.error('Error in onFlush callback:', error);
        // Put metrics back in buffer to retry
        this.metricsBuffer.unshift(...metricsToFlush);
      }
    }
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.metricsBuffer.length;
  }

  /**
   * Calculate summary statistics from buffered metrics
   */
  calculateSummary(): MetricsSummary {
    const metrics = this.metricsBuffer;

    if (metrics.length === 0) {
      const now = new Date();
      return {
        totalTranslations: 0,
        averageProcessingTime: 0,
        averageConfidence: 0,
        averageQuality: 0,
        errorRate: 0,
        totalErrors: 0,
        period: { start: now, end: now }
      };
    }

    const totalTranslations = metrics.length;
    const totalErrors = metrics.filter(m => m.errorType).length;
    const errorRate = totalErrors / totalTranslations;

    const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / totalTranslations;
    const avgConfidence = metrics.reduce((sum, m) => sum + m.confidenceScore, 0) / totalTranslations;

    const metricsWithQuality = metrics.filter(m => m.qualityScore !== undefined);
    const avgQuality = metricsWithQuality.length > 0
      ? metricsWithQuality.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / metricsWithQuality.length
      : 0;

    const timestamps = metrics.map(m => m.timestamp);
    const start = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const end = new Date(Math.max(...timestamps.map(t => t.getTime())));

    return {
      totalTranslations,
      averageProcessingTime: avgProcessingTime,
      averageConfidence: avgConfidence,
      averageQuality: avgQuality,
      errorRate,
      totalErrors,
      period: { start, end }
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Final flush before destroying
    this.flush().catch(console.error);
  }
}

// Singleton instance
let metricsCollectorInstance: MetricsCollector | null = null;

export function getMetricsCollector(
  onFlush?: (metrics: TranslationMetrics[]) => Promise<void>
): MetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new MetricsCollector(100, 30000, onFlush);
  }
  return metricsCollectorInstance;
}
