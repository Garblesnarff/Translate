/**
 * Simpler Prompt Strategy
 *
 * Removes dictionary terms and examples from prompt to simplify translation.
 * Uses basic prompt: "Translate this Tibetan text to English. Include original Tibetan in parentheses."
 *
 * @author Translation Service Team
 */

import type { FallbackStrategy, TranslationRequest, TranslationResult } from '../types';

/**
 * SimplerPromptStrategy - Simplifies prompt by removing extras
 *
 * When complex prompts fail, this strategy:
 * - Removes dictionary terms
 * - Removes examples
 * - Uses minimal context
 * - Basic instruction only
 */
export class SimplerPromptStrategy implements FallbackStrategy {
  public readonly name = 'SIMPLER_PROMPT';

  constructor(private translationService: any) {}

  /**
   * Execute simpler prompt strategy
   *
   * @param request - Translation request
   * @returns Translation result
   */
  public async execute(request: TranslationRequest): Promise<TranslationResult> {
    console.log(`[SimplerPromptStrategy] Executing for page ${request.pageNumber}`);

    // Create simplified prompt
    const simplifiedPrompt = this.createSimplifiedPrompt(request.text);

    // Call translation service with simplified options
    const result = await this.translationService.translate({
      text: request.text,
      prompt: simplifiedPrompt,
      includeDictionary: false,
      includeExamples: false,
      useChainOfThought: false,
      contextWindow: 0
    });

    return {
      translation: result.translation,
      confidence: result.confidence,
      metadata: {
        fallbackStrategy: 'SIMPLER_PROMPT'
      }
    };
  }

  /**
   * Create simplified prompt without extras
   *
   * @param text - Tibetan text
   * @returns Simplified prompt
   */
  private createSimplifiedPrompt(text: string): string {
    return `Translate the following Tibetan text to English.
Include the original Tibetan text in parentheses after each English translation.
Format: English translation (Tibetan text)

Tibetan Text:
${text}

Translation:`;
  }
}
