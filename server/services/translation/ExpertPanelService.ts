/**
 * Expert Panel Service
 *
 * Simulates a panel of experts (Historian, Linguist, Religious Scholar)
 * reviewing and improving translations. Cherry-picked from PR #1.
 *
 * @author Translation Service Team
 */

import { GeminiService } from './GeminiService';
import { PromptGenerator } from './PromptGenerator';
import { TranslationChunk, ExpertCritique } from './types';
import { CancellationManager } from '../CancellationManager';

/**
 * Expert panel configuration
 */
export interface ExpertPanelConfig {
  experts?: string[];           // Expert types to use
  timeout?: number;             // Timeout for each expert call
  refinementTimeout?: number;   // Timeout for refinement call
}

const DEFAULT_EXPERTS = ['Historian', 'Linguist', 'Religious Scholar'];

/**
 * Simulates a panel of experts to review and refine translations.
 * Each expert provides critique from their specialized perspective,
 * and if significant issues are found, the translation is refined.
 */
export class ExpertPanelService {
  private promptGenerator: PromptGenerator;
  private geminiService: GeminiService;

  constructor(promptGenerator: PromptGenerator, geminiService: GeminiService) {
    this.promptGenerator = promptGenerator;
    this.geminiService = geminiService;
  }

  /**
   * Reviews a translation with a simulated panel of experts and refines if necessary.
   *
   * @param chunk - The original text chunk
   * @param translation - The translated text to review
   * @param config - Optional configuration
   * @param abortSignal - Signal to abort the operation
   * @returns The refined translation (or original if no issues found)
   */
  public async reviewAndRefine(
    chunk: TranslationChunk,
    translation: string,
    config: ExpertPanelConfig = {},
    abortSignal?: AbortSignal
  ): Promise<{ translation: string; critiques: ExpertCritique[]; wasRefined: boolean }> {
    CancellationManager.throwIfCancelled(abortSignal, 'expert panel review');

    const experts = config.experts || DEFAULT_EXPERTS;
    const timeout = config.timeout || 30000;
    const refinementTimeout = config.refinementTimeout || 60000;

    const critiques: ExpertCritique[] = [];

    // Gather critiques from each expert
    for (const expert of experts) {
      CancellationManager.throwIfCancelled(abortSignal, `expert critique: ${expert}`);

      try {
        const critiquePrompt = this.promptGenerator.createCritiquePrompt(
          chunk.content,
          translation,
          expert
        );

        const result = await this.geminiService.generateContent(critiquePrompt, timeout, abortSignal);
        const response = await result.response;
        const critiqueText = response.text().trim();

        const hasIssues = !critiqueText.toLowerCase().includes('no significant issues');

        critiques.push({
          expert,
          critique: critiqueText,
          hasIssues
        });

        console.log(`[ExpertPanel] ${expert}: ${hasIssues ? 'Issues found' : 'No issues'}`);
      } catch (error) {
        console.warn(`[ExpertPanel] ${expert} critique failed:`, error);
        // Continue with other experts if one fails
      }
    }

    // Check if any experts found significant issues
    const issuesFound = critiques.filter(c => c.hasIssues);

    if (issuesFound.length === 0) {
      console.log(`[ExpertPanel] All experts approved translation`);
      return { translation, critiques, wasRefined: false };
    }

    // Refine translation based on expert feedback
    console.log(`[ExpertPanel] ${issuesFound.length} expert(s) found issues, refining translation`);
    CancellationManager.throwIfCancelled(abortSignal, 'expert panel refinement');

    try {
      const feedbackItems = issuesFound.map(c => `${c.expert}'s feedback: ${c.critique}`);

      const refinementPrompt = this.promptGenerator.createRefinementPrompt(
        chunk.content,
        translation,
        feedbackItems
      );

      const result = await this.geminiService.generateContent(refinementPrompt, refinementTimeout, abortSignal);
      const response = await result.response;
      const refinedTranslation = response.text().trim();

      console.log(`[ExpertPanel] Translation refined based on expert feedback`);
      return { translation: refinedTranslation, critiques, wasRefined: true };
    } catch (error) {
      console.warn(`[ExpertPanel] Refinement failed, returning original:`, error);
      return { translation, critiques, wasRefined: false };
    }
  }

  /**
   * Get just the critiques without refinement (useful for analysis)
   */
  public async getCritiques(
    chunk: TranslationChunk,
    translation: string,
    config: ExpertPanelConfig = {},
    abortSignal?: AbortSignal
  ): Promise<ExpertCritique[]> {
    const result = await this.reviewAndRefine(chunk, translation, config, abortSignal);
    return result.critiques;
  }
}
