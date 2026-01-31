/**
 * Translation Confidence Calculator
 *
 * Handles confidence score calculations for translations.
 * This module contains various algorithms for assessing translation quality.
 *
 * @author Translation Service Team
 */

import { semanticSimilarityService } from './SemanticSimilarity';
import { TibetanDictionary } from '../../dictionary';

/**
 * Enhanced confidence calculation with multiple factors
 *
 * Phase 2.2.2 Enhancements:
 * - Dictionary term coverage factor (0.15 weight)
 * - Punctuation preservation factor (0.1 weight)
 * - Formatting quality factor (0.1 weight)
 * - Reweighted existing factors
 *
 * @param translation - The generated translation
 * @param originalText - The original text being translated
 * @param dictionary - Optional dictionary for term coverage analysis
 * @returns Confidence score between 0 and 1
 */
export async function calculateEnhancedConfidence(
  translation: string,
  originalText: string,
  dictionary?: TibetanDictionary
): Promise<number> {
  let confidence = 0.5; // Base confidence (reduced from 0.6 to make room for new factors)

  // Factor 1: Tibetan text preservation (0.15 weight)
  const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
  confidence += Math.min(0.15, tibetanParens * 0.025);

  // Factor 2: Proper sentence structure (0.15 weight)
  const sentences = translation.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const properStructure = sentences.filter(s => /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(s)).length;
  if (sentences.length > 0) {
    confidence += (properStructure / sentences.length) * 0.15;
  }

  // Factor 3: Length appropriateness (0.1 weight)
  const lengthRatio = translation.replace(/\([^)]*\)/g, '').length / originalText.length;
  if (lengthRatio >= 0.5 && lengthRatio <= 3) {
    confidence += 0.1;
  } else if (lengthRatio >= 0.3 && lengthRatio <= 4) {
    confidence += 0.05; // Partial credit for reasonable length
  }

  // Factor 4: No obvious errors (0.05 weight)
  if (!translation.includes('Error:') && !translation.includes('Failed:') &&
      !translation.includes('I cannot') && !translation.includes('I apologize')) {
    confidence += 0.05;
  }

  // Factor 5: Dictionary term coverage (0.15 weight) - NEW
  if (dictionary) {
    const coverageScore = await calculateDictionaryTermCoverage(originalText, translation, dictionary);
    confidence += coverageScore * 0.15;
  }

  // Factor 6: Punctuation preservation (0.1 weight) - NEW
  const punctuationScore = calculatePunctuationPreservation(originalText, translation);
  confidence += punctuationScore * 0.1;

  // Factor 7: Formatting quality (0.1 weight) - NEW
  const formatScore = calculateFormattingQuality(translation);
  confidence += formatScore * 0.1;

  return Math.min(0.98, Math.max(0.1, confidence));
}

/**
 * Synchronous version for backwards compatibility
 */
export function calculateEnhancedConfidenceSync(translation: string, originalText: string): number {
  let confidence = 0.5;

  const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
  confidence += Math.min(0.15, tibetanParens * 0.025);

  const sentences = translation.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const properStructure = sentences.filter(s => /\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(s)).length;
  if (sentences.length > 0) {
    confidence += (properStructure / sentences.length) * 0.15;
  }

  const lengthRatio = translation.replace(/\([^)]*\)/g, '').length / originalText.length;
  if (lengthRatio >= 0.5 && lengthRatio <= 3) {
    confidence += 0.1;
  } else if (lengthRatio >= 0.3 && lengthRatio <= 4) {
    confidence += 0.05;
  }

  if (!translation.includes('Error:') && !translation.includes('Failed:') &&
      !translation.includes('I cannot') && !translation.includes('I apologize')) {
    confidence += 0.05;
  }

  const punctuationScore = calculatePunctuationPreservation(originalText, translation);
  confidence += punctuationScore * 0.1;

  const formatScore = calculateFormattingQuality(translation);
  confidence += formatScore * 0.1;

  return Math.min(0.98, Math.max(0.1, confidence));
}

/**
 * Calculate dictionary term coverage score
 * Checks how well the translation uses dictionary terms
 *
 * @returns Score between 0 and 1
 */
async function calculateDictionaryTermCoverage(
  originalText: string,
  translation: string,
  dictionary: TibetanDictionary
): Promise<number> {
  try {
    // Extract relevant terms from the original text
    const relevantTerms = await dictionary.extractRelevantTerms(originalText, 20);

    if (relevantTerms.length === 0) {
      return 0.5; // Neutral score if no dictionary terms found
    }

    let matchedTerms = 0;
    let totalTerms = relevantTerms.length;

    // Check if each term's translation appears in the output
    for (const term of relevantTerms) {
      const englishTerm = term.english.toLowerCase();
      const translationLower = translation.toLowerCase();

      // Check for exact match or alternate translations
      if (translationLower.includes(englishTerm)) {
        matchedTerms++;
      } else if (term.alternateTranslations) {
        const hasAlternate = term.alternateTranslations.some(alt =>
          translationLower.includes(alt.toLowerCase())
        );
        if (hasAlternate) {
          matchedTerms++;
        }
      }
    }

    // Return ratio of matched terms
    return totalTerms > 0 ? matchedTerms / totalTerms : 0.5;
  } catch (error) {
    console.warn('[Confidence] Dictionary term coverage check failed:', error);
    return 0.5; // Neutral score on error
  }
}

/**
 * Calculate punctuation preservation score
 * Checks if Tibetan punctuation (shad, etc.) is preserved
 *
 * @returns Score between 0 and 1
 */
function calculatePunctuationPreservation(originalText: string, translation: string): number {
  // Count Tibetan punctuation marks in original
  const shadInOriginal = (originalText.match(/།/g) || []).length;
  const doubleShadInOriginal = (originalText.match(/༎/g) || []).length;
  const nyisShadInOriginal = (originalText.match(/༑/g) || []).length;

  // Extract Tibetan text from parentheses in translation
  const tibetanInTranslation = translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g)?.join(' ') || '';

  const shadInTranslation = (tibetanInTranslation.match(/།/g) || []).length;
  const doubleShadInTranslation = (tibetanInTranslation.match(/༎/g) || []).length;
  const nyisShadInTranslation = (tibetanInTranslation.match(/༑/g) || []).length;

  const totalOriginal = shadInOriginal + doubleShadInOriginal + nyisShadInOriginal;
  const totalTranslation = shadInTranslation + doubleShadInTranslation + nyisShadInTranslation;

  if (totalOriginal === 0) {
    return 1.0; // No punctuation to preserve
  }

  // Calculate preservation ratio
  const preservationRatio = Math.min(totalTranslation / totalOriginal, 1.0);

  // Penalize if too much punctuation added or removed
  const difference = Math.abs(totalOriginal - totalTranslation);
  const penalty = Math.min(difference * 0.1, 0.3);

  return Math.max(0, preservationRatio - penalty);
}

/**
 * Calculate formatting quality score
 * Checks parentheses balance, no meta-text, proper structure
 *
 * @returns Score between 0 and 1
 */
function calculateFormattingQuality(translation: string): number {
  let score = 1.0;

  // Check 1: Balanced parentheses
  const openParens = (translation.match(/\(/g) || []).length;
  const closeParens = (translation.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    score -= 0.3; // Major penalty for unbalanced parentheses
  }

  // Check 2: No meta-text
  const metaTextPatterns = [
    /^Translation:/i,
    /^Here is/i,
    /^I have translated/i,
    /^Output:/i,
    /^Result:/i,
    /The translation is:/i
  ];

  for (const pattern of metaTextPatterns) {
    if (pattern.test(translation.trim())) {
      score -= 0.2;
      break;
    }
  }

  // Check 3: Tibetan text only in parentheses
  const tibetanOutsideParens = translation
    .replace(/\([^)]*\)/g, '') // Remove all parentheses content
    .match(/[\u0F00-\u0FFF]/g);

  if (tibetanOutsideParens && tibetanOutsideParens.length > 2) {
    score -= 0.2; // Penalty for Tibetan outside parentheses
  }

  // Check 4: Proper sentence structure
  const hasSentences = /[.!?]/.test(translation);
  if (!hasSentences && translation.length > 50) {
    score -= 0.1; // Minor penalty for missing sentence endings
  }

  // Check 5: Not too many consecutive parentheses without English
  const consecutiveParens = translation.match(/\)\s*\(/g);
  if (consecutiveParens && consecutiveParens.length > 3) {
    score -= 0.1; // Penalty for possibly malformed structure
  }

  return Math.max(0, score);
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

  // Factor 2: Translation quality (use sync version for compatibility)
  confidence += calculateEnhancedConfidenceSync(finalTranslation, originalText) * 0.3;

  // Factor 3: Consistency in Tibetan preservation
  const tibetanMatches = finalTranslation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g);
  if (tibetanMatches && tibetanMatches.length > 0) {
    confidence += 0.1;
  }

  return Math.min(0.95, Math.max(0.3, confidence));
}

/**
 * Calculates model agreement score using semantic similarity
 *
 * Phase 2.2.3 Enhancement: Uses semantic embeddings for more accurate agreement
 *
 * @param translations - Array of translations from different models
 * @param confidences - Optional array of confidence scores for weighted agreement
 * @returns Agreement score between 0 and 1
 */
export async function calculateModelAgreement(
  translations: string[],
  confidences?: number[]
): Promise<number> {
  if (translations.length < 2) return 1.0;

  let totalAgreement = 0;
  let totalWeight = 0;

  // Compare each pair of translations
  for (let i = 0; i < translations.length; i++) {
    for (let j = i + 1; j < translations.length; j++) {
      const agreement = await calculateTranslationSimilarity(translations[i], translations[j]);

      // Apply confidence-based weighting if available
      if (confidences && confidences.length === translations.length) {
        const weight = (confidences[i] + confidences[j]) / 2;
        totalAgreement += agreement * weight;
        totalWeight += weight;
      } else {
        totalAgreement += agreement;
        totalWeight += 1;
      }
    }
  }

  return totalWeight > 0 ? totalAgreement / totalWeight : 1.0;
}

/**
 * Synchronous version for backwards compatibility
 */
export function calculateModelAgreementSync(translations: string[]): number {
  if (translations.length < 2) return 1.0;

  let totalAgreement = 0;
  let pairCount = 0;

  for (let i = 0; i < translations.length; i++) {
    for (let j = i + 1; j < translations.length; j++) {
      const agreement = calculateTranslationSimilaritySync(translations[i], translations[j]);
      totalAgreement += agreement;
      pairCount++;
    }
  }

  return pairCount > 0 ? totalAgreement / pairCount : 1.0;
}

/**
 * Calculates similarity between two translations using semantic embeddings
 *
 * Phase 2.2.1 Enhancement: Uses semantic similarity service with embedding support
 *
 * @param translation1 - First translation
 * @param translation2 - Second translation
 * @returns Similarity score between 0 and 1
 */
async function calculateTranslationSimilarity(translation1: string, translation2: string): Promise<number> {
  try {
    const result = await semanticSimilarityService.compareTranslations(translation1, translation2);
    return result.score;
  } catch (error) {
    console.warn('[Confidence] Semantic similarity failed, using fallback:', error);
    return calculateTranslationSimilaritySync(translation1, translation2);
  }
}

/**
 * Synchronous fallback similarity calculation
 * Uses word-based Jaccard similarity
 */
function calculateTranslationSimilaritySync(translation1: string, translation2: string): number {
  // Clean translations - remove Tibetan text in parentheses
  const clean1 = translation1.replace(/\([^)]*\)/g, '').toLowerCase();
  const clean2 = translation2.replace(/\([^)]*\)/g, '').toLowerCase();

  const words1 = clean1.split(/\s+/).filter(word => word.length > 2); // Filter short words
  const words2 = clean2.split(/\s+/).filter(word => word.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Use Jaccard similarity (more accurate than simple overlap)
  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Detect outlier translations that differ significantly from consensus
 *
 * Phase 2.2.3 Enhancement: Identifies translations that should be excluded
 *
 * @param translations - Array of translations
 * @param threshold - Similarity threshold below which translation is considered outlier
 * @returns Array of outlier indices
 */
export async function detectOutlierTranslations(
  translations: string[],
  threshold: number = 0.4
): Promise<number[]> {
  if (translations.length < 3) return [];

  const outliers: number[] = [];

  // Calculate each translation's average similarity to all others
  for (let i = 0; i < translations.length; i++) {
    let totalSimilarity = 0;
    let count = 0;

    for (let j = 0; j < translations.length; j++) {
      if (i !== j) {
        const similarity = await calculateTranslationSimilarity(translations[i], translations[j]);
        totalSimilarity += similarity;
        count++;
      }
    }

    const avgSimilarity = count > 0 ? totalSimilarity / count : 1;

    if (avgSimilarity < threshold) {
      outliers.push(i);
    }
  }

  return outliers;
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
