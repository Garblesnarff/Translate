/**
 * ErrorMonitor - Tracks and analyzes translation errors
 *
 * Features:
 * - Error rate tracking by type
 * - Error spike detection
 * - Error dashboard and reporting
 * - Root cause analysis
 */

import { db } from '@db/index';
import { getTables } from '@db/config';

export interface ErrorSummary {
  period: {
    start: Date;
    end: Date;
  };
  totalErrors: number;
  totalTranslations: number;
  errorRate: number;
  errorsByType: {
    [errorType: string]: {
      count: number;
      percentage: number;
      examples: string[];
    };
  };
  topErrors: {
    type: string;
    count: number;
    percentage: number;
  }[];
}

export interface ErrorAlert {
  type: 'error_spike' | 'high_error_rate' | 'recurring_error';
  severity: 'warning' | 'critical';
  message: string;
  errorType?: string;
  errorRate: number;
  timestamp: Date;
}

export class ErrorMonitor {
  private tables: any;
  private readonly thresholds = {
    errorRateWarning: 0.05, // 5% error rate warning
    errorRateCritical: 0.10, // 10% error rate critical
    spikeMultiplier: 2.0, // 2x baseline is a spike
  };

  constructor() {
    this.tables = getTables();
  }

  /**
   * Generate comprehensive error summary
   */
  async generateErrorSummary(
    startDate: Date,
    endDate: Date
  ): Promise<ErrorSummary> {
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

      const totalTranslations = metrics.length;
      const errors = metrics.filter((m: any) => m.errorType !== null);
      const totalErrors = errors.length;
      const errorRate = totalErrors / totalTranslations;

      // Group errors by type
      const errorsByType: { [key: string]: any } = {};
      errors.forEach((error: any) => {
        const type = error.errorType || 'UNKNOWN';
        if (!errorsByType[type]) {
          errorsByType[type] = {
            count: 0,
            percentage: 0,
            examples: []
          };
        }
        errorsByType[type].count++;
        if (errorsByType[type].examples.length < 3 && error.errorMessage) {
          errorsByType[type].examples.push(error.errorMessage);
        }
      });

      // Calculate percentages
      Object.keys(errorsByType).forEach(type => {
        errorsByType[type].percentage = (errorsByType[type].count / totalErrors) * 100;
      });

      // Get top errors
      const topErrors = Object.entries(errorsByType)
        .map(([type, data]: [string, any]) => ({
          type,
          count: data.count,
          percentage: data.percentage
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        period: { start: startDate, end: endDate },
        totalErrors,
        totalTranslations,
        errorRate,
        errorsByType,
        topErrors
      };
    } catch (error) {
      console.error('Failed to generate error summary:', error);
      return this.emptyReport(startDate, endDate);
    }
  }

  /**
   * Check for error alerts
   */
  async checkErrorAlerts(
    startDate: Date,
    endDate: Date
  ): Promise<ErrorAlert[]> {
    const alerts: ErrorAlert[] = [];
    const summary = await this.generateErrorSummary(startDate, endDate);

    // Check overall error rate
    if (summary.errorRate >= this.thresholds.errorRateCritical) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `Critical error rate: ${(summary.errorRate * 100).toFixed(1)}% (${summary.totalErrors}/${summary.totalTranslations} translations failed)`,
        errorRate: summary.errorRate,
        timestamp: new Date()
      });
    } else if (summary.errorRate >= this.thresholds.errorRateWarning) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'warning',
        message: `Elevated error rate: ${(summary.errorRate * 100).toFixed(1)}% (${summary.totalErrors}/${summary.totalTranslations} translations failed)`,
        errorRate: summary.errorRate,
        timestamp: new Date()
      });
    }

    // Check for specific recurring errors
    summary.topErrors.forEach(error => {
      if (error.count >= 5) {
        alerts.push({
          type: 'recurring_error',
          severity: 'warning',
          message: `Recurring error "${error.type}": ${error.count} occurrences (${error.percentage.toFixed(1)}% of errors)`,
          errorType: error.type,
          errorRate: summary.errorRate,
          timestamp: new Date()
        });
      }
    });

    return alerts;
  }

  /**
   * Detect error spikes compared to baseline
   */
  async detectErrorSpikes(
    currentPeriod: { start: Date; end: Date },
    baselinePeriod: { start: Date; end: Date }
  ): Promise<ErrorAlert[]> {
    const alerts: ErrorAlert[] = [];

    const currentSummary = await this.generateErrorSummary(currentPeriod.start, currentPeriod.end);
    const baselineSummary = await this.generateErrorSummary(baselinePeriod.start, baselinePeriod.end);

    // Check for overall error spike
    if (baselineSummary.errorRate > 0) {
      const spikeRatio = currentSummary.errorRate / baselineSummary.errorRate;
      if (spikeRatio >= this.thresholds.spikeMultiplier) {
        alerts.push({
          type: 'error_spike',
          severity: 'critical',
          message: `Error spike detected: ${(spikeRatio).toFixed(1)}x baseline (current: ${(currentSummary.errorRate * 100).toFixed(1)}%, baseline: ${(baselineSummary.errorRate * 100).toFixed(1)}%)`,
          errorRate: currentSummary.errorRate,
          timestamp: new Date()
        });
      }
    }

    // Check for specific error type spikes
    Object.keys(currentSummary.errorsByType).forEach(errorType => {
      const currentCount = currentSummary.errorsByType[errorType].count;
      const baselineCount = baselineSummary.errorsByType[errorType]?.count || 0;

      if (baselineCount > 0) {
        const typeSpike = currentCount / baselineCount;
        if (typeSpike >= this.thresholds.spikeMultiplier && currentCount >= 3) {
          alerts.push({
            type: 'error_spike',
            severity: 'warning',
            message: `Spike in "${errorType}" errors: ${currentCount} occurrences (${typeSpike.toFixed(1)}x baseline)`,
            errorType,
            errorRate: currentSummary.errorRate,
            timestamp: new Date()
          });
        }
      }
    });

    return alerts;
  }

  /**
   * Get error metrics for a specific document
   */
  async getDocumentErrors(documentId: string): Promise<ErrorSummary | null> {
    try {
      const metrics = await db
        .select()
        .from(this.tables.translationMetrics)
        .where((table: any) => table.documentId.eq(documentId));

      if (metrics.length === 0) return null;

      const timestamps = metrics.map((m: any) => new Date(m.timestamp));
      const start = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const end = new Date(Math.max(...timestamps.map(t => t.getTime())));

      return this.generateErrorSummary(start, end);
    } catch (error) {
      console.error('Failed to get document errors:', error);
      return null;
    }
  }

  /**
   * Get recent errors (last N errors)
   */
  async getRecentErrors(limit: number = 10): Promise<any[]> {
    try {
      const errors = await db
        .select()
        .from(this.tables.translationMetrics)
        .where((table: any) => table.errorType.isNotNull())
        .orderBy((table: any) => table.timestamp.desc())
        .limit(limit);

      return errors;
    } catch (error) {
      console.error('Failed to get recent errors:', error);
      return [];
    }
  }

  private emptyReport(start: Date, end: Date): ErrorSummary {
    return {
      period: { start, end },
      totalErrors: 0,
      totalTranslations: 0,
      errorRate: 0,
      errorsByType: {},
      topErrors: []
    };
  }
}
