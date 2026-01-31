/**
 * QualityMonitor - Tracks translation quality trends and detects degradation
 *
 * Features:
 * - Confidence score trend analysis
 * - Quality gate failure rate tracking
 * - Quality degradation detection vs. baseline
 * - Quality segmentation by document type
 */

import { db } from '@db/index';
import { getTables } from '@db/config';

export interface QualityReport {
  period: {
    start: Date;
    end: Date;
  };
  totalTranslations: number;
  averageConfidence: number;
  averageQuality: number;
  averageModelAgreement: number;
  confidenceDistribution: {
    high: number; // >= 0.8
    medium: number; // 0.6-0.8
    low: number; // < 0.6
  };
  trend: 'improving' | 'stable' | 'degrading';
  qualityGateFailures?: number;
}

export interface QualityAlert {
  type: 'confidence_drop' | 'quality_degradation' | 'high_failure_rate';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class QualityMonitor {
  private tables: any;
  private readonly thresholds = {
    minimumConfidence: 0.7,
    minimumQuality: 0.7,
    confidenceDropThreshold: 0.1, // 10% drop is significant
    failureRateThreshold: 0.15, // 15% failure rate is concerning
  };

  constructor() {
    this.tables = getTables();
  }

  /**
   * Generate comprehensive quality report
   */
  async generateQualityReport(
    startDate: Date,
    endDate: Date
  ): Promise<QualityReport> {
    try {
      const metrics = await db
        .select()
        .from(this.tables.translationMetrics)
        .where((table: any) => {
          return table.timestamp.gte(startDate).and(table.timestamp.lte(endDate));
        });

      if (metrics.length === 0) {
        return this.emptyReport(startDate, endDate);
      }

      // Parse numeric values from text fields
      const confidenceScores = metrics.map((m: any) => parseFloat(m.confidenceScore));
      const qualityScores = metrics
        .filter((m: any) => m.qualityScore)
        .map((m: any) => parseFloat(m.qualityScore));
      const modelAgreements = metrics
        .filter((m: any) => m.modelAgreement)
        .map((m: any) => parseFloat(m.modelAgreement));

      // Calculate averages
      const averageConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
      const averageQuality = qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;
      const averageModelAgreement = modelAgreements.length > 0
        ? modelAgreements.reduce((a, b) => a + b, 0) / modelAgreements.length
        : 0;

      // Confidence distribution
      const high = confidenceScores.filter(c => c >= 0.8).length;
      const medium = confidenceScores.filter(c => c >= 0.6 && c < 0.8).length;
      const low = confidenceScores.filter(c => c < 0.6).length;

      const confidenceDistribution = {
        high: high / confidenceScores.length,
        medium: medium / confidenceScores.length,
        low: low / confidenceScores.length
      };

      // Determine trend by comparing first half vs second half
      const midpoint = Math.floor(metrics.length / 2);
      const firstHalfConfidence = confidenceScores
        .slice(0, midpoint)
        .reduce((a, b) => a + b, 0) / midpoint;
      const secondHalfConfidence = confidenceScores
        .slice(midpoint)
        .reduce((a, b) => a + b, 0) / (metrics.length - midpoint);

      let trend: 'improving' | 'stable' | 'degrading';
      const confidenceDiff = secondHalfConfidence - firstHalfConfidence;
      if (confidenceDiff > 0.05) {
        trend = 'improving';
      } else if (confidenceDiff < -0.05) {
        trend = 'degrading';
      } else {
        trend = 'stable';
      }

      return {
        period: { start: startDate, end: endDate },
        totalTranslations: metrics.length,
        averageConfidence,
        averageQuality,
        averageModelAgreement,
        confidenceDistribution,
        trend
      };
    } catch (error) {
      console.error('Failed to generate quality report:', error);
      return this.emptyReport(startDate, endDate);
    }
  }

  /**
   * Check for quality alerts
   */
  async checkQualityAlerts(
    startDate: Date,
    endDate: Date
  ): Promise<QualityAlert[]> {
    const alerts: QualityAlert[] = [];
    const report = await this.generateQualityReport(startDate, endDate);

    // Check minimum confidence threshold
    if (report.averageConfidence < this.thresholds.minimumConfidence) {
      alerts.push({
        type: 'confidence_drop',
        severity: 'critical',
        message: `Average confidence (${report.averageConfidence.toFixed(3)}) below minimum threshold (${this.thresholds.minimumConfidence})`,
        metric: 'averageConfidence',
        value: report.averageConfidence,
        threshold: this.thresholds.minimumConfidence,
        timestamp: new Date()
      });
    }

    // Check quality threshold
    if (report.averageQuality > 0 && report.averageQuality < this.thresholds.minimumQuality) {
      alerts.push({
        type: 'quality_degradation',
        severity: 'warning',
        message: `Average quality score (${report.averageQuality.toFixed(3)}) below minimum threshold (${this.thresholds.minimumQuality})`,
        metric: 'averageQuality',
        value: report.averageQuality,
        threshold: this.thresholds.minimumQuality,
        timestamp: new Date()
      });
    }

    // Check low confidence rate
    if (report.confidenceDistribution.low > this.thresholds.failureRateThreshold) {
      alerts.push({
        type: 'high_failure_rate',
        severity: 'warning',
        message: `High rate of low-confidence translations (${(report.confidenceDistribution.low * 100).toFixed(1)}%)`,
        metric: 'lowConfidenceRate',
        value: report.confidenceDistribution.low,
        threshold: this.thresholds.failureRateThreshold,
        timestamp: new Date()
      });
    }

    // Check for degrading trend
    if (report.trend === 'degrading') {
      alerts.push({
        type: 'quality_degradation',
        severity: 'warning',
        message: 'Quality trend is degrading over the reporting period',
        metric: 'trend',
        value: report.averageConfidence,
        threshold: this.thresholds.minimumConfidence,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Compare quality between current period and baseline
   */
  async compareToBaseline(
    currentPeriod: { start: Date; end: Date },
    baselinePeriod: { start: Date; end: Date }
  ): Promise<QualityAlert[]> {
    const alerts: QualityAlert[] = [];

    const currentReport = await this.generateQualityReport(currentPeriod.start, currentPeriod.end);
    const baselineReport = await this.generateQualityReport(baselinePeriod.start, baselinePeriod.end);

    // Check for significant confidence drop
    const confidenceDrop = baselineReport.averageConfidence - currentReport.averageConfidence;
    if (confidenceDrop > this.thresholds.confidenceDropThreshold) {
      alerts.push({
        type: 'confidence_drop',
        severity: 'critical',
        message: `Confidence dropped by ${(confidenceDrop * 100).toFixed(1)}% compared to baseline`,
        metric: 'confidenceDrop',
        value: currentReport.averageConfidence,
        threshold: baselineReport.averageConfidence - this.thresholds.confidenceDropThreshold,
        timestamp: new Date()
      });
    }

    // Check for quality drop
    if (baselineReport.averageQuality > 0 && currentReport.averageQuality > 0) {
      const qualityDrop = baselineReport.averageQuality - currentReport.averageQuality;
      if (qualityDrop > this.thresholds.confidenceDropThreshold) {
        alerts.push({
          type: 'quality_degradation',
          severity: 'warning',
          message: `Quality score dropped by ${(qualityDrop * 100).toFixed(1)}% compared to baseline`,
          metric: 'qualityDrop',
          value: currentReport.averageQuality,
          threshold: baselineReport.averageQuality - this.thresholds.confidenceDropThreshold,
          timestamp: new Date()
        });
      }
    }

    return alerts;
  }

  /**
   * Get quality metrics for a specific document
   */
  async getDocumentQualityMetrics(documentId: string): Promise<QualityReport | null> {
    try {
      const metrics = await db
        .select()
        .from(this.tables.translationMetrics)
        .where((table: any) => table.documentId.eq(documentId));

      if (metrics.length === 0) return null;

      const timestamps = metrics.map((m: any) => new Date(m.timestamp));
      const start = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const end = new Date(Math.max(...timestamps.map(t => t.getTime())));

      return this.generateQualityReport(start, end);
    } catch (error) {
      console.error('Failed to get document quality metrics:', error);
      return null;
    }
  }

  private emptyReport(start: Date, end: Date): QualityReport {
    return {
      period: { start, end },
      totalTranslations: 0,
      averageConfidence: 0,
      averageQuality: 0,
      averageModelAgreement: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      trend: 'stable'
    };
  }
}
