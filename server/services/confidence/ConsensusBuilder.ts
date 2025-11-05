/**
 * ConsensusBuilder - Multi-Model Result Aggregation
 *
 * Builds consensus from multiple translation results by:
 * - Calculating semantic agreement between all results
 * - Weighting results by confidence × agreement
 * - Selecting highest weighted result
 * - Boosting final confidence based on agreement level
 *
 * @module server/services/confidence/ConsensusBuilder
 */

import type { TranslationResult, TranslationMetadata } from '../../../shared/types.js';
import type { EmbeddingProvider } from '../../../tests/utils/mocks.js';
import { SemanticAgreement } from './SemanticAgreement.js';

/**
 * Extended translation result with consensus metadata
 */
export interface ConsensusResult extends TranslationResult {
  metadata: TranslationMetadata & {
    /** Whether this result is from multi-model consensus */
    consensus: boolean;
    /** Semantic agreement score between models (0-1) */
    modelAgreement: number;
    /** List of models used in consensus */
    modelsUsed: string[];
  };
}

/**
 * ConsensusBuilder aggregates multiple translation results.
 *
 * Algorithm:
 * 1. Calculate semantic agreement between all results
 * 2. For each result, calculate weight = confidence × agreement
 * 3. Select result with highest weight
 * 4. Boost selected result's confidence based on agreement
 * 5. Add consensus metadata
 *
 * Confidence Boosting:
 * ```
 * if (agreement > 0.9) boost = +0.15
 * else if (agreement > 0.8) boost = +0.10
 * else if (agreement > 0.7) boost = +0.05
 * else boost = 0
 *
 * finalConfidence = min(0.98, originalConfidence + boost)
 * ```
 *
 * @example
 * ```typescript
 * const embeddingProvider = new GeminiEmbeddingProvider(config);
 * const builder = new ConsensusBuilder(embeddingProvider);
 *
 * const results = [
 *   { translation: 'Greetings (བཀྲ་ཤིས།).', confidence: 0.85, ... },
 *   { translation: 'Hello (བཀྲ་ཤིས།).', confidence: 0.82, ... },
 *   { translation: 'Salutations (བཀྲ་ཤིས།).', confidence: 0.80, ... }
 * ];
 *
 * const consensus = await builder.build(results, 'བཀྲ་ཤིས།');
 * // Returns enhanced result with boosted confidence
 * ```
 */
export class ConsensusBuilder {
  private semanticAgreement: SemanticAgreement;

  /** Maximum confidence value */
  private readonly MAX_CONFIDENCE = 0.98;

  /**
   * Create a new ConsensusBuilder.
   *
   * @param embeddingProvider - Provider for generating embeddings
   */
  constructor(embeddingProvider: EmbeddingProvider) {
    this.semanticAgreement = new SemanticAgreement(embeddingProvider);
  }

  /**
   * Build consensus from multiple translation results.
   *
   * Process:
   * 1. Validate input
   * 2. Calculate semantic agreement
   * 3. Weight results by confidence × agreement
   * 4. Select best result
   * 5. Boost confidence based on agreement
   * 6. Add consensus metadata
   *
   * @param results - Array of translation results from different models
   * @param originalText - Original Tibetan text being translated
   * @returns Enhanced result with consensus metadata
   * @throws Error if no results provided or embedding calculation fails
   */
  async build(
    results: TranslationResult[],
    originalText: string
  ): Promise<ConsensusResult> {
    // Validate input
    if (results.length === 0) {
      throw new Error('No translation results provided');
    }

    // Handle single result
    if (results.length === 1) {
      return this.buildSingleResult(results[0]);
    }

    // Extract translations for semantic analysis
    const translations = results.map(r => r.translation);

    // Calculate semantic agreement between all translations
    const agreement = await this.semanticAgreement.calculate(translations);

    // Calculate weighted scores for each result
    const weightedResults = results.map((result, index) => ({
      result,
      index,
      weight: this.calculateWeight(result, agreement, results, index),
    }));

    // Select result with highest weight
    const best = weightedResults.reduce((max, current) =>
      current.weight > max.weight ? current : max
    );

    // Boost confidence based on agreement
    const boostedConfidence = this.boostConfidence(
      best.result.confidence,
      agreement
    );

    // Build consensus result with enhanced metadata
    return {
      translation: best.result.translation,
      confidence: boostedConfidence,
      metadata: {
        ...best.result.metadata,
        consensus: true,
        modelAgreement: agreement,
        modelsUsed: results.map(r => r.metadata.model),
      },
    };
  }

  /**
   * Build result for single translation (no consensus).
   *
   * @param result - Single translation result
   * @returns Enhanced result with consensus metadata (consensus=false)
   */
  private buildSingleResult(result: TranslationResult): ConsensusResult {
    return {
      translation: result.translation,
      confidence: result.confidence,
      metadata: {
        ...result.metadata,
        consensus: false,
        modelAgreement: 1.0, // Perfect agreement with self
        modelsUsed: [result.metadata.model],
      },
    };
  }

  /**
   * Calculate weight for a translation result.
   *
   * Weight = confidence × agreement_with_others
   *
   * @param result - Translation result to weight
   * @param overallAgreement - Overall semantic agreement score
   * @param allResults - All translation results
   * @param currentIndex - Index of current result
   * @returns Weight score (higher = better)
   */
  private calculateWeight(
    result: TranslationResult,
    overallAgreement: number,
    allResults: TranslationResult[],
    currentIndex: number
  ): number {
    // Base weight is confidence
    const baseWeight = result.confidence;

    // Boost weight by overall agreement
    const agreementBoost = overallAgreement;

    // Combined weight: confidence × agreement
    return baseWeight * (0.7 + agreementBoost * 0.3);
  }

  /**
   * Boost confidence based on model agreement.
   *
   * Boosting tiers:
   * - agreement > 0.9: +0.15
   * - agreement > 0.8: +0.10
   * - agreement > 0.7: +0.05
   * - agreement ≤ 0.7: +0.00
   *
   * @param originalConfidence - Original confidence score
   * @param agreement - Semantic agreement score (0-1)
   * @returns Boosted confidence (capped at 0.98)
   */
  private boostConfidence(
    originalConfidence: number,
    agreement: number
  ): number {
    let boost = 0;

    if (agreement > 0.9) {
      boost = 0.15;
    } else if (agreement > 0.8) {
      boost = 0.10;
    } else if (agreement > 0.7) {
      boost = 0.05;
    }

    const boostedConfidence = originalConfidence + boost;

    // Cap at maximum confidence
    return Math.min(this.MAX_CONFIDENCE, boostedConfidence);
  }
}
