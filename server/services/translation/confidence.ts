/**
 * Translation Confidence Calculator
 *
 * Handles confidence score calculations for translations.
 * This module contains various algorithms for assessing translation quality.
 *
 * @author Translation Service Team
 */

/**
 * Enhanced confidence calculation with multiple factors
 *
 * @param translation - The generated translation
 * @param originalText - The original text being translated
 * @returns Confidence score between 0 and 1
 */
export function calculateEnhancedConfidence(translation: string, originalText: string): number {
  let confidence = 0.6; // Base confidence

  // Factor 1: Dictionary term usage
  const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
  confidence += Math.min(0.2, tibetanParens * 0.03);

  // Factor 2: Proper sentence structure
  const sentences = translation.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const properStructure = sentences.filter(s => /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(s)).length;
  if (sentences.length > 0) {
    confidence += (properStructure / sentences.length) * 0.15;
  }

  // Factor 3: Length appropriateness
  const lengthRatio = translation.replace(/\([^)]*\)/g, '').length / originalText.length;
  if (lengthRatio >= 0.5 && lengthRatio <= 3) {
    confidence += 0.1;
  }

  // Factor 4: No obvious errors
  if (!translation.includes('Error:') && !translation.includes('Failed:')) {
    confidence += 0.05;
  }

  return Math.min(0.98, Math.max(0.1, confidence));
}

/**
 * Calculates confidence for consensus translations
 *
 * @param finalTranslation - The consensus translation
 * @param individualResponses - Array of individual AI responses
 * @param originalText - The original text being translated
 * @returns Confidence score between 0 and 1
 */
export function calculateConsensusConfidence(
  finalTranslation: string,
  individualResponses: Array<{ translation: string; confidence: number }>,
  originalText: string
): number {
  let confidence = 0.7; // Higher base for consensus

  // Factor 1: Agreement between models
  const avgIndividualConfidence = individualResponses.reduce((sum, resp) => sum + resp.confidence, 0) / individualResponses.length;
  confidence += avgIndividualConfidence * 0.2;

  // Factor 2: Translation quality
  confidence += calculateEnhancedConfidence(finalTranslation, originalText) * 0.3;

  // Factor 3: Consistency in Tibetan preservation
  const tibetanMatches = finalTranslation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g);
  if (tibetanMatches && tibetanMatches.length > 0) {
    confidence += 0.1;
  }

  return Math.min(0.95, Math.max(0.3, confidence));
}

/**
 * Calculates model agreement score
 *
 * @param translations - Array of translations from different models
 * @returns Agreement score between 0 and 1
 */
export function calculateModelAgreement(translations: string[]): number {
  if (translations.length < 2) return 1.0;

  let totalAgreement = 0;
  let pairCount = 0;

  // Compare each pair of translations
  for (let i = 0; i < translations.length; i++) {
    for (let j = i + 1; j < translations.length; j++) {
      const agreement = calculateTranslationSimilarity(translations[i], translations[j]);
      totalAgreement += agreement;
      pairCount++;
    }
  }

  return pairCount > 0 ? totalAgreement / pairCount : 1.0;
}

/**
 * Calculates similarity between two translations
 *
 * @param translation1 - First translation
 * @param translation2 - Second translation
 * @returns Similarity score between 0 and 1
 */
function calculateTranslationSimilarity(translation1: string, translation2: string): number {
  // Simple similarity based on common words (after removing Tibetan text in parentheses)
  const clean1 = translation1.replace(/\([^)]*\)/g, '').toLowerCase();
  const clean2 = translation2.replace(/\([^)]*\)/g, '').toLowerCase();

  const words1 = clean1.split(/\s+/).filter(word => word.length > 0);
  const words2 = clean2.split(/\s+/).filter(word => word.length > 0);

  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter(word => words2.includes(word));
  const maxWords = Math.max(words1.length, words2.length);

  return commonWords.length / maxWords;
}

/**
 * Validates translation quality based on multiple criteria
 *
 * @param translation - The translation to validate
 * @param originalText - The original text
 * @returns Object with validation results
 */
export function validateTranslationQuality(translation: string, originalText: string): {
  isValid: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 1.0;

  // Check for Tibetan text preservation
  const hasTibetanText = /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(translation);
  if (!hasTibetanText) {
    issues.push('Missing Tibetan text in parentheses');
    score -= 0.2;
  }

  // Check for reasonable length
  const cleanTranslation = translation.replace(/\([^)]*\)/g, '');
  const lengthRatio = cleanTranslation.length / originalText.length;
  if (lengthRatio < 0.3 || lengthRatio > 4) {
    issues.push('Translation length seems inappropriate');
    score -= 0.15;
  }

  // Check for obvious errors
  if (translation.includes('Error:') || translation.includes('Failed:')) {
    issues.push('Contains error messages');
    score -= 0.3;
  }

  // Check for empty or meaningless content
  if (cleanTranslation.trim().length < 10) {
    issues.push('Translation is too short');
    score -= 0.25;
  }

  return {
    isValid: issues.length === 0,
    issues,
    score: Math.max(0, score)
  };
}
