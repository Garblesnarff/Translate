/**
 * PerformanceMonitor - Tracks and analyzes translation performance metrics
 *
 * Features:
 * - Precise timing instrumentation for each pipeline phase
 * - Percentile latency calculation (P50, P95, P99)
 * - Performance alerts for threshold violations
 * - Bottleneck identification
 */

import { db } from '@db/index';
import { getTables } from '@db/config';

export interface PhaseTimings {
  preprocessing?: number;
  initialTranslation?: number;
  iterativeRefinement?: number;
  formatting?: number;
  qualityAnalysis?: number;
  postprocessing?: number;
  total: number;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  totalTranslations: number;
  averageTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  minTime: number;
  maxTime: number;
  throughput: number; // translations per minute
  averageApiLatency: number;
  bottlenecks: {
    phase: string;
    avgTime: number;
    percentage: number;
  }[];
}

export interface PerformanceAlert {
  type: 'threshold_exceeded' | 'spike_detected' | 'degradation';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class PerformanceMonitor {
  private tables: any;
  private readonly thresholds = {
    averageTime: 30000, // 30 seconds
    p95Time: 60000, // 60 seconds
    apiLatency: 10000, // 10 seconds
    throughputMin: 0.5, // minimum 0.5 translations per minute
  };

  constructor() {
    this.tables = getTables();
  }

  /**
   * Track timing for a specific translation phase
   */
  startPhaseTimer(): () => number {
    const start = performance.now();
    return () => performance.now() - start;
  }

  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceReport> {
    try {
      // Query metrics from database
      const metrics = await db
        .select()
        .from(this.tables.translationMetrics)
        .where((table: any) => {
          return table.timestamp.gte(startDate).and(table.timestamp.lte(endDate));
        });

      if (metrics.length === 0) {
        return this.emptyReport(startDate, endDate);
      }

      const processingTimes = metrics.map((m: any) => m.processingTimeMs);
      const apiLatencies = metrics.map((m: any) => m.apiLatencyMs);

      // Calculate statistics
      const totalTranslations = metrics.length;
      const averageTime = processingTimes.reduce((a: number, b: number) => a + b, 0) / totalTranslations;
      const medianTime = this.calculatePercentile(processingTimes, 50);
      const p95Time = this.calculatePercentile(processingTimes, 95);
      const p99Time = this.calculatePercentile(processingTimes, 99);
      const minTime = Math.min(...processingTimes);
      const maxTime = Math.max(...processingTimes);

      // Calculate throughput
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      const throughput = totalTranslations / durationMinutes;

      const averageApiLatency = apiLatencies.reduce((a: number, b: number) => a + b, 0) / totalTranslations;

      // Identify bottlenecks (simplified - would need phase-level timing data)
      const bottlenecks = [
        { phase: 'API Latency', avgTime: averageApiLatency, percentage: (averageApiLatency / averageTime) * 100 },
        { phase: 'Processing', avgTime: averageTime - averageApiLatency, percentage: ((averageTime - averageApiLatency) / averageTime) * 100 }
      ].sort((a, b) => b.avgTime - a.avgTime);

      return {
        period: { start: startDate, end: endDate },
        totalTranslations,
        averageTime,
        medianTime,
        p95Time,
        p99Time,
        minTime,
        maxTime,
        throughput,
        averageApiLatency,
        bottlenecks
      };
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return this.emptyReport(startDate, endDate);
    }
  }

  /**
   * Check for performance threshold violations
   */
  async checkPerformanceAlerts(
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];
    const report = await this.generatePerformanceReport(startDate, endDate);

    // Check average time threshold
    if (report.averageTime > this.thresholds.averageTime) {
      alerts.push({
        type: 'threshold_exceeded',
        severity: 'warning',
        message: `Average processing time (${Math.round(report.averageTime)}ms) exceeds threshold (${this.thresholds.averageTime}ms)`,
        metric: 'averageTime',
        value: report.averageTime,
        threshold: this.thresholds.averageTime,
        timestamp: new Date()
      });
    }

    // Check P95 latency
    if (report.p95Time > this.thresholds.p95Time) {
      alerts.push({
        type: 'threshold_exceeded',
        severity: 'critical',
        message: `P95 latency (${Math.round(report.p95Time)}ms) exceeds threshold (${this.thresholds.p95Time}ms)`,
        metric: 'p95Time',
        value: report.p95Time,
        threshold: this.thresholds.p95Time,
        timestamp: new Date()
      });
    }

    // Check API latency
    if (report.averageApiLatency > this.thresholds.apiLatency) {
      alerts.push({
        type: 'threshold_exceeded',
        severity: 'warning',
        message: `Average API latency (${Math.round(report.averageApiLatency)}ms) exceeds threshold (${this.thresholds.apiLatency}ms)`,
        metric: 'apiLatency',
        value: report.averageApiLatency,
        threshold: this.thresholds.apiLatency,
        timestamp: new Date()
      });
    }

    // Check throughput
    if (report.throughput < this.thresholds.throughputMin) {
      alerts.push({
        type: 'degradation',
        severity: 'warning',
        message: `Throughput (${report.throughput.toFixed(2)} trans/min) below minimum (${this.thresholds.throughputMin} trans/min)`,
        metric: 'throughput',
        value: report.throughput,
        threshold: this.thresholds.throughputMin,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Detect performance spikes (comparing to historical baseline)
   */
  async detectPerformanceSpikes(
    currentPeriod: { start: Date; end: Date },
    baselinePeriod: { start: Date; end: Date }
  ): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    const currentReport = await this.generatePerformanceReport(currentPeriod.start, currentPeriod.end);
    const baselineReport = await this.generatePerformanceReport(baselinePeriod.start, baselinePeriod.end);

    // Check for significant increase (>50%) in average time
    const timeIncrease = (currentReport.averageTime - baselineReport.averageTime) / baselineReport.averageTime;
    if (timeIncrease > 0.5) {
      alerts.push({
        type: 'spike_detected',
        severity: 'critical',
        message: `Processing time increased by ${Math.round(timeIncrease * 100)}% compared to baseline`,
        metric: 'averageTime',
        value: currentReport.averageTime,
        threshold: baselineReport.averageTime * 1.5,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Get current system performance snapshot
   */
  async getCurrentPerformance(): Promise<PerformanceReport> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    return this.generatePerformanceReport(oneHourAgo, now);
  }

  private emptyReport(start: Date, end: Date): PerformanceReport {
    return {
      period: { start, end },
      totalTranslations: 0,
      averageTime: 0,
      medianTime: 0,
      p95Time: 0,
      p99Time: 0,
      minTime: 0,
      maxTime: 0,
      throughput: 0,
      averageApiLatency: 0,
      bottlenecks: []
    };
  }
}
