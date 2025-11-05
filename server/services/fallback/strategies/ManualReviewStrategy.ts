/**
 * Manual Review Strategy
 *
 * Doesn't actually translate - returns placeholder with manual review flag.
 * Saves failed translation to manual_review queue.
 *
 * @author Translation Service Team
 */

import type { FallbackStrategy, TranslationRequest, TranslationResult } from '../types';

/**
 * ManualReviewStrategy - Escalates to human review
 *
 * When all automated strategies fail, this strategy:
 * - Returns empty translation with confidence 0
 * - Sets requiresManualReview flag
 * - Saves to manual review queue
 * - Returns review ID for tracking
 */
export class ManualReviewStrategy implements FallbackStrategy {
  public readonly name = 'MANUAL_REVIEW';

  constructor(private reviewQueue: any) {}

  /**
   * Execute manual review strategy
   *
   * @param request - Translation request
   * @returns Translation result with manual review flag
   */
  public async execute(request: TranslationRequest): Promise<TranslationResult> {
    console.log(`[ManualReviewStrategy] Executing for page ${request.pageNumber} - escalating to manual review`);

    // Add to manual review queue
    const reviewId = await this.reviewQueue.add({
      text: request.text,
      pageNumber: request.pageNumber,
      error: request.context?.originalError?.message || 'Unknown error',
      attemptedStrategies: []
    });

    console.log(`[ManualReviewStrategy] Added to manual review queue with ID: ${reviewId}`);

    return {
      translation: '',
      confidence: 0,
      metadata: {
        requiresManualReview: true,
        fallbackStrategy: 'MANUAL_REVIEW',
        reviewId
      }
    };
  }
}
