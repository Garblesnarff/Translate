/**
 * Translation Refinement Helper
 *
 * Handles iterative refinement of translations using specialized prompts.
 * This module contains the logic for improving translation quality through multiple passes.
 *
 * @author Translation Service Team
 */

import { PromptGenerator } from './PromptGenerator';
import { oddPagesGeminiService, evenPagesGeminiService } from './GeminiService';
import { CancellationManager } from '../CancellationManager';
import { TibetanDictionary } from '../../dictionary';
import { TranslationConfig, RefinementResult } from './types';

/**
 * Performs a refinement iteration using specialized prompts
 *
 * @param originalText - The original Tibetan text
 * @param currentTranslation - The current translation to refine
 * @param iteration - Current iteration number
 * @param config - Translation configuration
 * @param pageNumber - Page number for service selection
 * @param abortSignal - Optional abort signal for cancellation
 * @returns Promise with refined translation and confidence
 */
export async function performRefinementIteration(
  originalText: string,
  currentTranslation: string,
  iteration: number,
  config: TranslationConfig,
  pageNumber: number,
  abortSignal?: AbortSignal
): Promise<RefinementResult> {
  const focusAreas = determineFocusAreas(currentTranslation, iteration);

  // Initialize prompt generator with dictionary
  const dictionary = new TibetanDictionary();
  const promptGenerator = new PromptGenerator(dictionary);

  const refinementPrompt = promptGenerator.createRefinementPrompt(
    originalText,
    currentTranslation,
    focusAreas
  );

  // Check for cancellation before refinement
  CancellationManager.throwIfCancelled(abortSignal, 'refinement API call');

  // Use correct Gemini service based on page number
  const geminiService = getGeminiService(pageNumber);
  const result = await geminiService.generateContent(refinementPrompt, config.timeout, abortSignal);
  const response = await result.response;
  const refinedTranslation = response.text();

  const confidence = calculateRefinementConfidence(refinedTranslation, originalText);

  return {
    translation: refinedTranslation,
    confidence
  };
}

/**
 * Determines focus areas for refinement based on iteration and current quality
 *
 * @param translation - The current translation
 * @param iteration - Current iteration number
 * @returns Array of focus areas for refinement
 */
export function determineFocusAreas(translation: string, iteration: number): string[] {
  const focusAreas: string[] = [];

  switch (iteration) {
    case 2:
      focusAreas.push('Improve accuracy of Buddhist terminology');
      focusAreas.push('Enhance naturalness of English expression');
      break;
    case 3:
      focusAreas.push('Ensure consistency in technical terms');
      focusAreas.push('Perfect sentence structure and flow');
      break;
    default:
      focusAreas.push('Refine cultural and contextual nuances');
      focusAreas.push('Optimize overall readability');
  }

  // Add specific focus based on translation characteristics
  if (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g)?.length === 0) {
    focusAreas.push('Include Tibetan original text in parentheses');
  }

  return focusAreas;
}

/**
 * Calculates confidence score for refined translations
 *
 * @param translation - The refined translation
 * @param originalText - The original text being translated
 * @returns Confidence score between 0 and 1
 */
function calculateRefinementConfidence(translation: string, originalText: string): number {
  let confidence = 0.7; // Higher base confidence for refinements

  // Factor 1: Tibetan text preservation in parentheses
  const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
  confidence += Math.min(0.2, tibetanParens * 0.04);

  // Factor 2: Proper sentence structure
  const sentences = translation.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const properStructure = sentences.filter(s => /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(s)).length;
  if (sentences.length > 0) {
    confidence += (properStructure / sentences.length) * 0.2;
  }

  // Factor 3: Length appropriateness (refinements should be more precise)
  const lengthRatio = translation.replace(/\([^)]*\)/g, '').length / originalText.length;
  if (lengthRatio >= 0.7 && lengthRatio <= 2.5) {
    confidence += 0.15;
  }

  // Factor 4: No obvious errors
  if (!translation.includes('Error:') && !translation.includes('Failed:')) {
    confidence += 0.05;
  }

  return Math.min(0.95, Math.max(0.2, confidence));
}

/**
 * Get the appropriate Gemini service based on page number
 *
 * @param pageNumber - The page number to determine service for
 * @returns The appropriate Gemini service instance
 */
function getGeminiService(pageNumber: number) {
  return pageNumber % 2 === 0 ? evenPagesGeminiService : oddPagesGeminiService;
}
