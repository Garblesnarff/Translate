/**
 * ReviewAnalytics - Analytics and reporting for review workflow
 *
 * Features:
 * - Track review metrics
 * - Identify improvement areas
 * - Generate weekly reports
 */

import { db } from '@db/index';
import { getTables } from '@db/config';

export interface ReviewMetrics {
  period: {
    start: Date;
    end: Date;
  };
  totalReviews: number;
  averageTurnaroundTime: number; // in minutes
  approvalRate: number;
  rejectionRate: number;
  byPriority: {
    high: { count: number; averageTurnaround: number };
    medium: { count: number; averageTurnaround: number };
    low: { count: number; averageTurnaround: number };
  };
  topReasons: { reason: string; count: number }[];
  reviewerPerformance?: { reviewer: string; reviewed: number; averageTurnaround: number }[];
}

export interface WeeklyReport {
  week: string;
  metrics: ReviewMetrics;
  correctionStats: {
    total: number;
    byType: Record<string, number>;
  };
  improvementAreas: string[];
  recommendations: string[];
}

export class ReviewAnalytics {
  private tables: any;

  constructor() {
    this.tables = getTables();
  }

  /**
   * Calculate review metrics for a period
   */
  async calculateMetrics(startDate: Date, endDate: Date): Promise<ReviewMetrics> {
    try {
      const reviews = await db
        .select()
        .from(this.tables.reviewQueue)
        .where((table: any) => {
          return table.createdAt.gte(startDate).and(table.createdAt.lte(endDate));
        });

      if (reviews.length === 0) {
        return this.emptyMetrics(startDate, endDate);
      }

      // Calculate turnaround times for completed reviews
      const completedReviews = reviews.filter((r: any) => r.reviewedAt);
      const turnaroundTimes = completedReviews.map((r: any) => {
        const created = new Date(r.createdAt);
        const reviewed = new Date(r.reviewedAt);
        return (reviewed.getTime() - created.getTime()) / (1000 * 60); // minutes
      });

      const averageTurnaroundTime = turnaroundTimes.length > 0
        ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length
        : 0;

      // Calculate approval/rejection rates
      const approved = reviews.filter((r: any) => r.status === 'approved').length;
      const rejected = reviews.filter((r: any) => r.status === 'rejected').length;
      const totalCompleted = approved + rejected;

      const approvalRate = totalCompleted > 0 ? approved / totalCompleted : 0;
      const rejectionRate = totalCompleted > 0 ? rejected / totalCompleted : 0;

      // By priority
      const priorities = ['high', 'medium', 'low'] as const;
      const byPriority = {} as ReviewMetrics['byPriority'];

      for (const priority of priorities) {
        const priorityReviews = reviews.filter((r: any) => r.severity === priority);
        const priorityCompleted = priorityReviews.filter((r: any) => r.reviewedAt);
        const priorityTurnarounds = priorityCompleted.map((r: any) => {
          const created = new Date(r.createdAt);
          const reviewed = new Date(r.reviewedAt);
          return (reviewed.getTime() - created.getTime()) / (1000 * 60);
        });

        byPriority[priority] = {
          count: priorityReviews.length,
          averageTurnaround: priorityTurnarounds.length > 0
            ? priorityTurnarounds.reduce((a, b) => a + b, 0) / priorityTurnarounds.length
            : 0
        };
      }

      // Top reasons
      const reasonMap = new Map<string, number>();
      reviews.forEach((r: any) => {
        const count = reasonMap.get(r.reason) || 0;
        reasonMap.set(r.reason, count + 1);
      });

      const topReasons = Array.from(reasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        period: { start: startDate, end: endDate },
        totalReviews: reviews.length,
        averageTurnaroundTime,
        approvalRate,
        rejectionRate,
        byPriority,
        topReasons
      };
    } catch (error) {
      console.error('Failed to calculate review metrics:', error);
      return this.emptyMetrics(startDate, endDate);
    }
  }

  /**
   * Identify improvement areas based on review data
   */
  async identifyImprovementAreas(metrics: ReviewMetrics): Promise<string[]> {
    const areas: string[] = [];

    // High rejection rate
    if (metrics.rejectionRate > 0.3) {
      areas.push('High rejection rate (>30%) - review translation quality thresholds');
    }

    // Long turnaround times
    if (metrics.averageTurnaroundTime > 24 * 60) { // more than 24 hours
      areas.push('Long review turnaround time - consider adding more reviewers');
    }

    // High priority items piling up
    if (metrics.byPriority.high.count > 10) {
      areas.push('High number of high-priority reviews - prioritize critical issues');
    }

    // Common rejection reasons
    if (metrics.topReasons.length > 0) {
      const topReason = metrics.topReasons[0];
      if (topReason.count > metrics.totalReviews * 0.2) {
        areas.push(`Common issue: "${topReason.reason}" - address systematically`);
      }
    }

    return areas;
  }

  /**
   * Generate recommendations based on metrics
   */
  generateRecommendations(
    metrics: ReviewMetrics,
    improvementAreas: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Based on rejection rate
    if (metrics.rejectionRate > 0.3) {
      recommendations.push('Increase confidence threshold to reduce low-quality translations reaching review');
      recommendations.push('Enhance quality gates to catch issues earlier in pipeline');
    }

    // Based on turnaround time
    if (metrics.averageTurnaroundTime > 24 * 60) {
      recommendations.push('Distribute review load among multiple reviewers');
      recommendations.push('Implement automated pre-screening for obvious issues');
    }

    // Based on top reasons
    if (metrics.topReasons.length > 0) {
      const topReason = metrics.topReasons[0].reason.toLowerCase();

      if (topReason.includes('confidence')) {
        recommendations.push('Review and adjust confidence calculation methodology');
      } else if (topReason.includes('format')) {
        recommendations.push('Strengthen format validation and auto-correction');
      } else if (topReason.includes('terminology')) {
        recommendations.push('Expand dictionary with corrected terms');
        recommendations.push('Use terminology corrections as training examples');
      }
    }

    return recommendations;
  }

  /**
   * Generate weekly report
   */
  async generateWeeklyReport(weekStart: Date): Promise<WeeklyReport> {
    // Calculate week end (7 days from start)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get review metrics
    const metrics = await this.calculateMetrics(weekStart, weekEnd);

    // Get correction stats (from FeedbackProcessor)
    const corrections = await db
      .select()
      .from(this.tables.translationCorrections)
      .where((table: any) => {
        return table.createdAt.gte(weekStart).and(table.createdAt.lte(weekEnd));
      });

    const correctionStats = {
      total: corrections.length,
      byType: corrections.reduce((acc: any, c: any) => {
        acc[c.correctionType] = (acc[c.correctionType] || 0) + 1;
        return acc;
      }, {})
    };

    // Identify improvement areas
    const improvementAreas = await this.identifyImprovementAreas(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, improvementAreas);

    return {
      week: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
      metrics,
      correctionStats,
      improvementAreas,
      recommendations
    };
  }

  /**
   * Format weekly report as markdown
   */
  formatWeeklyReport(report: WeeklyReport): string {
    let md = `# Weekly Review Report\n\n`;
    md += `**Week:** ${report.week}\n\n`;

    md += `## Review Metrics\n\n`;
    md += `- **Total Reviews:** ${report.metrics.totalReviews}\n`;
    md += `- **Average Turnaround:** ${Math.round(report.metrics.averageTurnaroundTime)} minutes\n`;
    md += `- **Approval Rate:** ${(report.metrics.approvalRate * 100).toFixed(1)}%\n`;
    md += `- **Rejection Rate:** ${(report.metrics.rejectionRate * 100).toFixed(1)}%\n\n`;

    md += `### By Priority\n`;
    md += `- **High:** ${report.metrics.byPriority.high.count} reviews (avg ${Math.round(report.metrics.byPriority.high.averageTurnaround)}min)\n`;
    md += `- **Medium:** ${report.metrics.byPriority.medium.count} reviews (avg ${Math.round(report.metrics.byPriority.medium.averageTurnaround)}min)\n`;
    md += `- **Low:** ${report.metrics.byPriority.low.count} reviews (avg ${Math.round(report.metrics.byPriority.low.averageTurnaround)}min)\n\n`;

    if (report.metrics.topReasons.length > 0) {
      md += `### Top Review Reasons\n`;
      report.metrics.topReasons.forEach((r, i) => {
        md += `${i + 1}. ${r.reason} (${r.count} occurrences)\n`;
      });
      md += `\n`;
    }

    md += `## Corrections\n\n`;
    md += `- **Total:** ${report.correctionStats.total}\n`;
    Object.entries(report.correctionStats.byType).forEach(([type, count]) => {
      md += `- **${type}:** ${count}\n`;
    });
    md += `\n`;

    if (report.improvementAreas.length > 0) {
      md += `## Improvement Areas\n\n`;
      report.improvementAreas.forEach(area => {
        md += `- ${area}\n`;
      });
      md += `\n`;
    }

    if (report.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      report.recommendations.forEach((rec, i) => {
        md += `${i + 1}. ${rec}\n`;
      });
      md += `\n`;
    }

    return md;
  }

  private emptyMetrics(start: Date, end: Date): ReviewMetrics {
    return {
      period: { start, end },
      totalReviews: 0,
      averageTurnaroundTime: 0,
      approvalRate: 0,
      rejectionRate: 0,
      byPriority: {
        high: { count: 0, averageTurnaround: 0 },
        medium: { count: 0, averageTurnaround: 0 },
        low: { count: 0, averageTurnaround: 0 }
      },
      topReasons: []
    };
  }
}
