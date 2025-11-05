/**
 * ReviewQueue - Human review workflow management
 *
 * Features:
 * - Automatic flagging of translations needing review
 * - Priority-based queue management
 * - Review status tracking
 */

import { db } from '@db/index';
import { getTables } from '@db/config';
import { randomUUID } from 'crypto';

export interface ReviewItem {
  id: string;
  translationId: number;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  assignedTo?: string;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
}

export interface ReviewCriteria {
  checkLowConfidence: boolean;
  confidenceThreshold: number;
  checkQualityGateFailures: boolean;
  checkInconsistentTerminology: boolean;
  checkFormatIssues: boolean;
}

export class ReviewQueue {
  private tables: any;
  private readonly defaultCriteria: ReviewCriteria = {
    checkLowConfidence: true,
    confidenceThreshold: 0.7,
    checkQualityGateFailures: true,
    checkInconsistentTerminology: true,
    checkFormatIssues: true
  };

  constructor() {
    this.tables = getTables();
  }

  /**
   * Evaluate if a translation needs review
   */
  shouldReview(
    translationResult: {
      confidence: number;
      qualityScore?: number;
      hasFormatIssues?: boolean;
      hasInconsistencies?: boolean;
    },
    criteria: Partial<ReviewCriteria> = {}
  ): { needsReview: boolean; reason: string; severity: 'high' | 'medium' | 'low' } | null {
    const appliedCriteria = { ...this.defaultCriteria, ...criteria };

    // Check low confidence
    if (appliedCriteria.checkLowConfidence && translationResult.confidence < appliedCriteria.confidenceThreshold) {
      const severity = translationResult.confidence < 0.5 ? 'high'
        : translationResult.confidence < 0.6 ? 'medium'
        : 'low';

      return {
        needsReview: true,
        reason: `Low confidence score: ${translationResult.confidence.toFixed(2)}`,
        severity
      };
    }

    // Check quality gate failures
    if (appliedCriteria.checkQualityGateFailures && translationResult.qualityScore && translationResult.qualityScore < 0.6) {
      return {
        needsReview: true,
        reason: `Quality gate failure: ${translationResult.qualityScore.toFixed(2)}`,
        severity: 'high'
      };
    }

    // Check format issues
    if (appliedCriteria.checkFormatIssues && translationResult.hasFormatIssues) {
      return {
        needsReview: true,
        reason: 'Format validation failed',
        severity: 'medium'
      };
    }

    // Check inconsistencies
    if (appliedCriteria.checkInconsistentTerminology && translationResult.hasInconsistencies) {
      return {
        needsReview: true,
        reason: 'Inconsistent terminology detected',
        severity: 'medium'
      };
    }

    return null;
  }

  /**
   * Add translation to review queue
   */
  async addToQueue(
    translationId: number,
    reason: string,
    severity: 'high' | 'medium' | 'low'
  ): Promise<ReviewItem> {
    try {
      const reviewItem: ReviewItem = {
        id: randomUUID(),
        translationId,
        reason,
        severity,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(this.tables.reviewQueue).values({
        id: reviewItem.id,
        translationId: reviewItem.translationId,
        reason: reviewItem.reason,
        severity: reviewItem.severity,
        status: reviewItem.status,
        createdAt: reviewItem.createdAt,
        updatedAt: reviewItem.updatedAt
      });

      return reviewItem;
    } catch (error) {
      console.error('Failed to add to review queue:', error);
      throw error;
    }
  }

  /**
   * Get pending reviews
   */
  async getPendingReviews(limit: number = 50): Promise<ReviewItem[]> {
    try {
      const reviews = await db
        .select()
        .from(this.tables.reviewQueue)
        .where((table: any) => table.status.eq('pending'))
        .orderBy((table: any) => [
          // High severity first
          table.severity.asc(),
          // Oldest first
          table.createdAt.asc()
        ])
        .limit(limit);

      return reviews as ReviewItem[];
    } catch (error) {
      console.error('Failed to get pending reviews:', error);
      return [];
    }
  }

  /**
   * Get review by ID
   */
  async getReviewById(reviewId: string): Promise<ReviewItem | null> {
    try {
      const reviews = await db
        .select()
        .from(this.tables.reviewQueue)
        .where((table: any) => table.id.eq(reviewId))
        .limit(1);

      return reviews.length > 0 ? reviews[0] as ReviewItem : null;
    } catch (error) {
      console.error('Failed to get review:', error);
      return null;
    }
  }

  /**
   * Update review status
   */
  async updateReviewStatus(
    reviewId: string,
    status: 'pending' | 'in_review' | 'approved' | 'rejected',
    reviewNotes?: string,
    assignedTo?: string
  ): Promise<void> {
    try {
      const updates: any = {
        status,
        updatedAt: new Date()
      };

      if (reviewNotes) {
        updates.reviewNotes = reviewNotes;
      }

      if (assignedTo) {
        updates.assignedTo = assignedTo;
      }

      if (status === 'approved' || status === 'rejected') {
        updates.reviewedAt = new Date();
      }

      await db
        .update(this.tables.reviewQueue)
        .set(updates)
        .where((table: any) => table.id.eq(reviewId));
    } catch (error) {
      console.error('Failed to update review status:', error);
      throw error;
    }
  }

  /**
   * Assign review to user
   */
  async assignReview(reviewId: string, userId: string): Promise<void> {
    await this.updateReviewStatus(reviewId, 'in_review', undefined, userId);
  }

  /**
   * Approve translation
   */
  async approveReview(reviewId: string, reviewerNotes?: string): Promise<void> {
    await this.updateReviewStatus(reviewId, 'approved', reviewerNotes);
  }

  /**
   * Reject translation
   */
  async rejectReview(reviewId: string, reason: string): Promise<void> {
    await this.updateReviewStatus(reviewId, 'rejected', reason);
  }

  /**
   * Get review queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
    byPriority: { high: number; medium: number; low: number };
  }> {
    try {
      const allReviews = await db.select().from(this.tables.reviewQueue);

      const stats = {
        total: allReviews.length,
        pending: allReviews.filter((r: any) => r.status === 'pending').length,
        inReview: allReviews.filter((r: any) => r.status === 'in_review').length,
        approved: allReviews.filter((r: any) => r.status === 'approved').length,
        rejected: allReviews.filter((r: any) => r.status === 'rejected').length,
        byPriority: {
          high: allReviews.filter((r: any) => r.severity === 'high').length,
          medium: allReviews.filter((r: any) => r.severity === 'medium').length,
          low: allReviews.filter((r: any) => r.severity === 'low').length
        }
      };

      return stats;
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return {
        total: 0,
        pending: 0,
        inReview: 0,
        approved: 0,
        rejected: 0,
        byPriority: { high: 0, medium: 0, low: 0 }
      };
    }
  }
}
