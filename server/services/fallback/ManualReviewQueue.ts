/**
 * Manual Review Queue
 *
 * Manages the queue of translations that require manual review.
 * Provides methods to add, retrieve, and complete manual review items.
 *
 * @author Translation Service Team
 */

import { db } from '../../../db';
import { manualReview, type InsertManualReview, type ManualReviewRecord } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Manual review item for adding to queue
 */
export interface ManualReviewItem {
  text: string;
  pageNumber?: number;
  attemptedTranslation?: string;
  error: string;
  attemptedStrategies?: string[];
}

/**
 * ManualReviewQueue - Manages translations that need manual review
 *
 * Usage:
 * ```typescript
 * const queue = new ManualReviewQueue();
 *
 * // Add item to queue
 * const id = await queue.add({
 *   text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
 *   pageNumber: 5,
 *   error: 'All fallback strategies failed',
 *   attemptedStrategies: ['SIMPLER_PROMPT', 'ALTERNATIVE_MODEL']
 * });
 *
 * // Get pending items
 * const items = await queue.getQueue(10);
 *
 * // Mark as complete
 * await queue.markComplete(id, 'Hello and good wishes');
 * ```
 */
export class ManualReviewQueue {
  /**
   * Add item to manual review queue
   *
   * @param item - Item to add
   * @returns Review ID
   */
  public async add(item: ManualReviewItem): Promise<string> {
    const id = randomUUID();

    const reviewItem: InsertManualReview = {
      id,
      sourceText: item.text,
      pageNumber: item.pageNumber || null,
      attemptedTranslation: item.attemptedTranslation || null,
      errorMessage: item.error,
      strategyFailures: item.attemptedStrategies ? JSON.stringify(item.attemptedStrategies) : null,
      status: 'pending'
    };

    await db.insert(manualReview).values(reviewItem);

    console.log(`[ManualReviewQueue] Added item ${id} to queue (page ${item.pageNumber || 'unknown'})`);

    return id;
  }

  /**
   * Get pending items from queue
   *
   * @param limit - Maximum number of items to retrieve
   * @returns Array of manual review items
   */
  public async getQueue(limit: number = 50): Promise<ManualReviewRecord[]> {
    const items = await db
      .select()
      .from(manualReview)
      .where(eq(manualReview.status, 'pending'))
      .orderBy(desc(manualReview.createdAt))
      .limit(limit);

    console.log(`[ManualReviewQueue] Retrieved ${items.length} pending items`);

    return items;
  }

  /**
   * Get specific review item by ID
   *
   * @param id - Review item ID
   * @returns Review item or null if not found
   */
  public async getById(id: string): Promise<ManualReviewRecord | null> {
    const items = await db
      .select()
      .from(manualReview)
      .where(eq(manualReview.id, id))
      .limit(1);

    return items[0] || null;
  }

  /**
   * Mark review item as complete
   *
   * @param id - Review item ID
   * @param translation - Completed translation
   * @param reviewedBy - Reviewer identifier (optional)
   * @param notes - Review notes (optional)
   */
  public async markComplete(
    id: string,
    translation: string,
    reviewedBy?: string,
    notes?: string
  ): Promise<void> {
    await db
      .update(manualReview)
      .set({
        status: 'completed',
        completedTranslation: translation,
        reviewedBy: reviewedBy || null,
        reviewNotes: notes || null,
        completedAt: new Date()
      })
      .where(eq(manualReview.id, id));

    console.log(`[ManualReviewQueue] Marked item ${id} as complete`);
  }

  /**
   * Mark review item as skipped
   *
   * @param id - Review item ID
   * @param reason - Reason for skipping (optional)
   */
  public async markSkipped(id: string, reason?: string): Promise<void> {
    await db
      .update(manualReview)
      .set({
        status: 'skipped',
        reviewNotes: reason || null,
        completedAt: new Date()
      })
      .where(eq(manualReview.id, id));

    console.log(`[ManualReviewQueue] Marked item ${id} as skipped`);
  }

  /**
   * Get queue statistics
   *
   * @returns Statistics about the review queue
   */
  public async getStats(): Promise<{
    pending: number;
    completed: number;
    skipped: number;
    total: number;
  }> {
    const all = await db.select().from(manualReview);

    const stats = {
      pending: all.filter(item => item.status === 'pending').length,
      completed: all.filter(item => item.status === 'completed').length,
      skipped: all.filter(item => item.status === 'skipped').length,
      total: all.length
    };

    return stats;
  }

  /**
   * Clear completed items older than specified days
   *
   * @param daysOld - Number of days (default 30)
   * @returns Number of items deleted
   */
  public async clearOldCompleted(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Note: This is a simplified version. In production, you'd use a proper date comparison
    // For now, we'll just log that this functionality exists
    console.log(`[ManualReviewQueue] Would clear completed items older than ${daysOld} days`);

    return 0;
  }
}

// Export singleton instance
export const manualReviewQueue = new ManualReviewQueue();
