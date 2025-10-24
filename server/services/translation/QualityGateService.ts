/**
 * @file QualityGateService.ts
 * @description Service for simulating a panel of experts to review and improve translations.
 */

import { GeminiService } from './GeminiService';
import { PromptGenerator } from './PromptGenerator';
import { TranslationChunk } from './types';
import { CancellationManager } from '../CancellationManager';

interface ExpertCritique {
  expert: string;
  critique: string;
}

/**
 * Simulates a panel of experts to review and refine translations.
 */
export class QualityGateService {
  private promptGenerator: PromptGenerator;
  private geminiService: GeminiService;

  constructor(promptGenerator: PromptGenerator, geminiService: GeminiService) {
    this.promptGenerator = promptGenerator;
    this.geminiService = geminiService;
  }

  /**
   * Reviews a translation with a simulated panel of experts and refines it if necessary.
   * @param chunk The original text chunk.
   * @param translation The translated text.
   * @param abortSignal The signal to abort the operation.
   * @returns The refined translation.
   */
  public async reviewAndRefine(chunk: TranslationChunk, translation: string, abortSignal?: AbortSignal): Promise<string> {
    CancellationManager.throwIfCancelled(abortSignal, 'quality gate review');
    const experts = ['Historian', 'Linguist', 'Religious Scholar'];
    const critiques: ExpertCritique[] = [];

    for (const expert of experts) {
      CancellationManager.throwIfCancelled(abortSignal, `quality gate expert critique: ${expert}`);
      const critiquePrompt = this.promptGenerator.createCritiquePrompt(chunk.content, translation, expert);
      const result = await this.geminiService.generateContent(critiquePrompt, 30000, abortSignal);
      const response = await result.response;
      critiques.push({ expert, critique: response.text() });
    }

    const significantIssues = critiques.filter(c => !c.critique.toLowerCase().includes("no significant issues"));

    if (significantIssues.length > 0) {
      CancellationManager.throwIfCancelled(abortSignal, 'quality gate refinement');
      const refinementPrompt = this.promptGenerator.createRefinementPrompt(
        chunk.content,
        translation,
        significantIssues.map(c => `${c.expert}'s feedback: ${c.critique}`)
      );

      const result = await this.geminiService.generateContent(refinementPrompt, 60000, abortSignal);
      const response = await result.response;
      return response.text();
    }

    return translation;
  }
}
