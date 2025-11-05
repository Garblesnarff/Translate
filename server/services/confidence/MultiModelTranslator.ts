/**
 * MultiModelTranslator - Multi-Model Translation Orchestrator
 *
 * Coordinates translation using multiple AI models:
 * - Translates text using all providers in parallel
 * - Aggregates results using ConsensusBuilder
 * - Handles partial failures gracefully
 * - Returns highest-confidence result with consensus metadata
 *
 * @module server/services/confidence/MultiModelTranslator
 */

import type { TranslationProvider, EmbeddingProvider } from '../../../tests/utils/mocks.js';
import type { TranslationResult } from '../../../shared/types.js';
import { ConsensusBuilder, type ConsensusResult } from './ConsensusBuilder.js';

/**
 * MultiModelTranslator orchestrates multi-model translations.
 *
 * Process:
 * 1. Translate text using all providers in parallel
 * 2. Collect successful results (ignore failures)
 * 3. Use ConsensusBuilder to aggregate results
 * 4. Return best result with enhanced confidence
 *
 * Error Handling:
 * - If some providers fail: Continue with successful results
 * - If all providers fail: Throw error
 *
 * @example
 * ```typescript
 * const providers = [
 *   geminiProvider,
 *   gpt4Provider,
 *   claudeProvider
 * ];
 *
 * const translator = new MultiModelTranslator(providers, embeddingProvider);
 *
 * const result = await translator.translate(
 *   'བཀྲ་ཤིས་བདེ་ལེགས།',
 *   'Translate this Tibetan text to English'
 * );
 *
 * console.log(result.metadata.consensus); // true
 * console.log(result.metadata.modelAgreement); // 0.92
 * console.log(result.metadata.modelsUsed); // ['gemini', 'gpt-4', 'claude']
 * ```
 */
export class MultiModelTranslator {
  private providers: TranslationProvider[];
  private consensusBuilder: ConsensusBuilder;

  /**
   * Create a new MultiModelTranslator.
   *
   * @param providers - Array of translation providers to use
   * @param embeddingProvider - Provider for semantic similarity calculation
   * @throws Error if no providers given
   */
  constructor(
    providers: TranslationProvider[],
    embeddingProvider: EmbeddingProvider
  ) {
    if (providers.length === 0) {
      throw new Error('At least one translation provider is required');
    }

    this.providers = providers;
    this.consensusBuilder = new ConsensusBuilder(embeddingProvider);
  }

  /**
   * Translate text using multiple models and build consensus.
   *
   * Process:
   * 1. Start all translations in parallel
   * 2. Collect successful results (catch and log failures)
   * 3. If no results: throw error
   * 4. Use ConsensusBuilder to select best result
   * 5. Return enhanced result with consensus metadata
   *
   * @param text - Text to translate
   * @param prompt - Translation prompt/instructions
   * @returns Consensus translation result
   * @throws Error if all providers fail
   */
  async translate(text: string, prompt: string): Promise<ConsensusResult> {
    // Translate using all providers in parallel
    const translationPromises = this.providers.map(provider =>
      this.translateWithProvider(provider, text, prompt)
    );

    // Wait for all translations (successful or failed)
    const results = await Promise.allSettled(translationPromises);

    // Extract successful translations
    const successfulResults: TranslationResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        successfulResults.push(result.value);
      } else if (result.status === 'rejected') {
        // Log failure but continue with other results
        console.error('Provider failed:', result.reason);
      }
    }

    // Check if we have any successful results
    if (successfulResults.length === 0) {
      throw new Error('All translation providers failed');
    }

    // Use ConsensusBuilder to select best result
    const consensus = await this.consensusBuilder.build(successfulResults, text);

    return consensus;
  }

  /**
   * Translate text using a single provider with error handling.
   *
   * @param provider - Translation provider to use
   * @param text - Text to translate
   * @param prompt - Translation prompt
   * @returns Translation result or null if provider fails
   */
  private async translateWithProvider(
    provider: TranslationProvider,
    text: string,
    prompt: string
  ): Promise<TranslationResult | null> {
    try {
      const result = await provider.translate(text, prompt);
      return result;
    } catch (error) {
      // Log error and return null (will be filtered out)
      console.error('Translation provider error:', error);
      throw error; // Re-throw to be caught by Promise.allSettled
    }
  }
}
