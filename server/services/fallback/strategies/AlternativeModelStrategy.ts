/**
 * Alternative Model Strategy
 *
 * Tries next provider in chain (e.g., switches from Gemini to GPT-4 or Claude).
 * Uses same prompt with alternative model.
 *
 * @author Translation Service Team
 */

import type { FallbackStrategy, TranslationRequest, TranslationResult } from '../types';

/**
 * AlternativeModelStrategy - Tries alternative AI provider
 *
 * When primary provider fails, this strategy:
 * - Gets next available provider
 * - Uses same prompt
 * - Marks result with alternative model used
 */
export class AlternativeModelStrategy implements FallbackStrategy {
  public readonly name = 'ALTERNATIVE_MODEL';

  constructor(private providerService: any) {}

  /**
   * Execute alternative model strategy
   *
   * @param request - Translation request
   * @returns Translation result
   */
  public async execute(request: TranslationRequest): Promise<TranslationResult> {
    console.log(`[AlternativeModelStrategy] Executing for page ${request.pageNumber}`);

    // Get next available provider
    const alternativeProvider = this.providerService.getNextProvider();

    if (!alternativeProvider) {
      throw new Error('No alternative providers available');
    }

    console.log(`[AlternativeModelStrategy] Using alternative provider: ${alternativeProvider}`);

    // Use same prompt with alternative provider
    const result = await this.providerService.translate({
      text: request.text,
      prompt: request.context?.originalPrompt,
      provider: alternativeProvider
    });

    return {
      translation: result.translation,
      confidence: result.confidence,
      metadata: {
        fallbackStrategy: 'ALTERNATIVE_MODEL',
        modelUsed: alternativeProvider
      }
    };
  }
}
