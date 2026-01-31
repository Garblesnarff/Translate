/**
 * Fallback System Types
 *
 * Type definitions for the fallback system.
 *
 * @author Translation Service Team
 */

/**
 * Translation request for fallback strategies
 */
export interface TranslationRequest {
  text: string;
  pageNumber: number;
  context?: {
    dictionaryTerms?: string[];
    originalPrompt?: string;
    originalError?: Error;
    previousPage?: string;
    nextPage?: string;
  };
}

/**
 * Translation result from fallback strategies
 */
export interface TranslationResult {
  translation: string;
  confidence: number;
  metadata: {
    fallbackStrategy?: string;
    fallbackUsed?: boolean;
    requiresManualReview?: boolean;
    reviewId?: string;
    modelUsed?: string;
    chunksUsed?: number;
    originalError?: Error;
    [key: string]: any;
  };
}

/**
 * Fallback strategy interface
 */
export interface FallbackStrategy {
  name: string;
  execute(request: TranslationRequest): Promise<TranslationResult>;
}
