import { TranslationConsensus } from './HelperAIService';

export interface QualityMetrics {
  overallScore: number;
  dictionaryUsage: number;
  structuralIntegrity: number;
  terminologyConsistency: number;
  completeness: number;
  naturalness: number;
  details: QualityDetail[];
}

export interface QualityDetail {
  aspect: string;
  score: number;
  description: string;
  issues?: string[];
  suggestions?: string[];
}

export interface TranslationQuality {
  metrics: QualityMetrics;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  confidence: number;
  recommendations: string[];
}

/**
 * Advanced quality scoring system for Tibetan translations
 * Analyzes multiple aspects of translation quality
 */
export class QualityScorer {
  private readonly tibetanUnicodeRange = /[\u0F00-\u0FFF]/;
  private readonly buddhistTerms = [
    'bodhisattva', 'dharma', 'buddha', 'sangha', 'karma', 'samsara',
    'nirvana', 'enlightenment', 'meditation', 'compassion', 'wisdom',
    'emptiness', 'mindfulness', 'refuge', 'precepts', 'merit', 'dedication'
  ];

  /**
   * Analyzes translation quality across multiple dimensions
   */
  public analyzeTranslationQuality(
    originalText: string,
    translation: string,
    consensus: TranslationConsensus,
    dictionaryContext: string
  ): TranslationQuality {
    const metrics = this.calculateQualityMetrics(originalText, translation, consensus, dictionaryContext);
    const grade = this.calculateGrade(metrics.overallScore);
    const recommendations = this.generateRecommendations(metrics);

    return {
      metrics,
      grade,
      confidence: consensus.confidence,
      recommendations
    };
  }

  /**
   * Calculates detailed quality metrics
   */
  private calculateQualityMetrics(
    originalText: string,
    translation: string,
    consensus: TranslationConsensus,
    dictionaryContext: string
  ): QualityMetrics {
    const dictionaryUsage = this.scoreDictionaryUsage(translation, dictionaryContext);
    const structuralIntegrity = this.scoreStructuralIntegrity(originalText, translation);
    const terminologyConsistency = this.scoreTerminologyConsistency(translation);
    const completeness = this.scoreCompleteness(originalText, translation);
    const naturalness = this.scoreNaturalness(translation);

    const overallScore = this.calculateOverallScore([
      { score: dictionaryUsage.score, weight: 0.2 },
      { score: structuralIntegrity.score, weight: 0.25 },
      { score: terminologyConsistency.score, weight: 0.2 },
      { score: completeness.score, weight: 0.2 },
      { score: naturalness.score, weight: 0.15 }
    ]);

    return {
      overallScore,
      dictionaryUsage: dictionaryUsage.score,
      structuralIntegrity: structuralIntegrity.score,
      terminologyConsistency: terminologyConsistency.score,
      completeness: completeness.score,
      naturalness: naturalness.score,
      details: [
        dictionaryUsage,
        structuralIntegrity,
        terminologyConsistency,
        completeness,
        naturalness
      ]
    };
  }

  /**
   * Scores how well the translation uses dictionary terms
   */
  private scoreDictionaryUsage(translation: string, dictionaryContext: string): QualityDetail {
    const dictionaryTerms = this.extractDictionaryTerms(dictionaryContext);
    const usedTerms = this.findUsedDictionaryTerms(translation, dictionaryTerms);
    
    let score = 0.7; // Base score
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Boost score for dictionary term usage
    if (usedTerms.length > 0) {
      score += Math.min(0.3, usedTerms.length * 0.05);
    } else {
      issues.push('No dictionary terms detected in translation');
      suggestions.push('Consider using more dictionary references for technical terms');
    }

    // Check for proper bracketing of Tibetan terms
    const tibetanBrackets = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
    if (tibetanBrackets === 0) {
      score -= 0.2;
      issues.push('Tibetan original text not preserved in parentheses');
      suggestions.push('Include original Tibetan text in parentheses for reference');
    }

    return {
      aspect: 'Dictionary Usage',
      score: Math.max(0, Math.min(1, score)),
      description: `Dictionary term utilization and Tibetan text preservation`,
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Scores structural integrity (sentence boundaries, formatting)
   */
  private scoreStructuralIntegrity(originalText: string, translation: string): QualityDetail {
    let score = 0.8; // Base score
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check sentence count alignment
    const originalSentences = this.countSentences(originalText);
    const translatedSentences = this.countSentences(translation);
    const sentenceRatio = Math.min(originalSentences, translatedSentences) / Math.max(originalSentences, translatedSentences);
    
    if (sentenceRatio < 0.8) {
      score -= 0.2;
      issues.push(`Sentence count mismatch: original ${originalSentences}, translated ${translatedSentences}`);
      suggestions.push('Review sentence boundaries and ensure complete translation');
    }

    // Check for proper punctuation
    const punctuationPattern = /[.!?]\s*\([^)]*\)/g;
    const properlyPunctuated = (translation.match(punctuationPattern) || []).length;
    const totalSentences = this.countSentences(translation);
    
    if (totalSentences > 0 && properlyPunctuated / totalSentences < 0.7) {
      score -= 0.15;
      issues.push('Inconsistent punctuation with Tibetan references');
      suggestions.push('Ensure each sentence ends with proper punctuation before Tibetan reference');
    }

    // Check for formatting consistency
    const listItems = translation.match(/^\s*[*•-]/gm);
    if (listItems && listItems.length > 0) {
      score += 0.1; // Bonus for preserved formatting
    }

    return {
      aspect: 'Structural Integrity',
      score: Math.max(0, Math.min(1, score)),
      description: 'Sentence structure, formatting, and organizational consistency',
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Scores terminology consistency throughout the translation
   */
  private scoreTerminologyConsistency(translation: string): QualityDetail {
    let score = 0.8; // Base score
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Extract Buddhist/technical terms and check consistency
    const terms = this.extractTechnicalTerms(translation);
    const inconsistencies = this.findTerminologyInconsistencies(terms);

    if (inconsistencies.length > 0) {
      score -= Math.min(0.3, inconsistencies.length * 0.1);
      issues.push(...inconsistencies);
      suggestions.push('Standardize terminology throughout the translation');
    }

    // Check for proper capitalization of Buddhist terms
    const buddhistTermsFound = this.findBuddhistTerms(translation);
    const improperlyCapped = buddhistTermsFound.filter(term => 
      term[0] !== term[0].toUpperCase() && !term.includes('(')
    );
    
    if (improperlyCapped.length > 0) {
      score -= 0.1;
      issues.push('Some Buddhist terms may need proper capitalization');
      suggestions.push('Consider capitalizing key Buddhist concepts (Buddha, Dharma, etc.)');
    }

    return {
      aspect: 'Terminology Consistency',
      score: Math.max(0, Math.min(1, score)),
      description: 'Consistent use of technical and Buddhist terminology',
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Scores translation completeness
   */
  private scoreCompleteness(originalText: string, translation: string): QualityDetail {
    let score = 0.8; // Base score
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check relative length (very rough completeness indicator)
    const originalLength = originalText.replace(/\s+/g, ' ').length;
    const translationLength = translation.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').length;
    const lengthRatio = translationLength / originalLength;

    if (lengthRatio < 0.5) {
      score -= 0.3;
      issues.push('Translation appears significantly shorter than original');
      suggestions.push('Verify all content has been translated');
    } else if (lengthRatio > 3) {
      score -= 0.1;
      issues.push('Translation appears unusually verbose');
      suggestions.push('Consider more concise phrasing while maintaining accuracy');
    }

    // Check for incomplete sentences
    const incompletePattern = /[^.!?]\s*$/;
    if (incompletePattern.test(translation.trim())) {
      score -= 0.2;
      issues.push('Translation appears to end abruptly');
      suggestions.push('Ensure translation is complete with proper ending');
    }

    // Check for untranslated Tibetan sections (beyond parenthetical references)
    const untranslatedTibetan = translation.match(/[\u0F00-\u0FFF]{5,}/g);
    if (untranslatedTibetan && untranslatedTibetan.length > 0) {
      score -= 0.4;
      issues.push('Contains untranslated Tibetan text');
      suggestions.push('Translate all Tibetan content, keeping original in parentheses');
    }

    return {
      aspect: 'Completeness',
      score: Math.max(0, Math.min(1, score)),
      description: 'Translation completeness and thoroughness',
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Scores naturalness of English translation
   */
  private scoreNaturalness(translation: string): QualityDetail {
    let score = 0.7; // Base score
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for awkward constructions
    const awkwardPatterns = [
      /\b(the which|in which the|of the which)\b/gi,
      /\b(is being|are being)\b/gi,
      /\bthat that\b/gi,
      /\bof of\b/gi
    ];

    for (const pattern of awkwardPatterns) {
      if (pattern.test(translation)) {
        score -= 0.05;
      }
    }

    // Check sentence length variation
    const sentences = translation.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    
    if (avgSentenceLength > 30) {
      score -= 0.1;
      issues.push('Some sentences may be too long for natural reading');
      suggestions.push('Consider breaking up very long sentences');
    }

    // Check for repetitive sentence starters
    const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
    const starterCounts = starters.reduce((counts, starter) => {
      counts[starter] = (counts[starter] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const repetitiveStarters = Object.entries(starterCounts).filter(([, count]) => count > 3);
    if (repetitiveStarters.length > 0) {
      score -= 0.1;
      issues.push('Some sentences start with the same word repeatedly');
      suggestions.push('Vary sentence beginnings for better flow');
    }

    return {
      aspect: 'Naturalness',
      score: Math.max(0, Math.min(1, score)),
      description: 'Natural flow and readability of English translation',
      issues: issues.length > 0 ? issues : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Helper method to extract dictionary terms
   */
  private extractDictionaryTerms(dictionaryContext: string): Array<{ tibetan: string; english: string }> {
    const terms: Array<{ tibetan: string; english: string }> = [];
    const lines = dictionaryContext.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^-\s*(.+?):\s*(.+?)\s*\(/);
      if (match) {
        terms.push({ tibetan: match[1], english: match[2] });
      }
    }
    
    return terms;
  }

  /**
   * Finds which dictionary terms were used in the translation
   */
  private findUsedDictionaryTerms(translation: string, dictionaryTerms: Array<{ tibetan: string; english: string }>): string[] {
    const used: string[] = [];
    const translationLower = translation.toLowerCase();
    
    for (const term of dictionaryTerms) {
      if (translationLower.includes(term.english.toLowerCase()) || translation.includes(term.tibetan)) {
        used.push(term.english);
      }
    }
    
    return used;
  }

  /**
   * Counts sentences in text
   */
  private countSentences(text: string): number {
    return (text.match(/[.!?]+/g) || []).length;
  }

  /**
   * Extracts technical terms from translation
   */
  private extractTechnicalTerms(translation: string): string[] {
    const terms: string[] = [];
    
    // Look for capitalized terms
    const capitalizedMatches = translation.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    terms.push(...capitalizedMatches);
    
    // Look for Buddhist terms
    terms.push(...this.findBuddhistTerms(translation));
    
    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Finds Buddhist terms in translation
   */
  private findBuddhistTerms(translation: string): string[] {
    const found: string[] = [];
    const translationLower = translation.toLowerCase();
    
    for (const term of this.buddhistTerms) {
      if (translationLower.includes(term)) {
        found.push(term);
      }
    }
    
    return found;
  }

  /**
   * Finds terminology inconsistencies
   */
  private findTerminologyInconsistencies(terms: string[]): string[] {
    const inconsistencies: string[] = [];
    const termCounts = terms.reduce((counts, term) => {
      const normalized = term.toLowerCase();
      counts[normalized] = (counts[normalized] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Check for potential inconsistencies (same term with different capitalizations)
    for (const [term, count] of Object.entries(termCounts)) {
      if (count === 1) continue;
      
      const variations = terms.filter(t => t.toLowerCase() === term);
      const uniqueVariations = new Set(variations);
      
      if (uniqueVariations.size > 1) {
        inconsistencies.push(`Inconsistent capitalization for "${term}": ${Array.from(uniqueVariations).join(', ')}`);
      }
    }
    
    return inconsistencies;
  }

  /**
   * Calculates weighted overall score
   */
  private calculateOverallScore(weightedScores: Array<{ score: number; weight: number }>): number {
    const totalWeight = weightedScores.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = weightedScores.reduce((sum, item) => sum + (item.score * item.weight), 0);
    return weightedSum / totalWeight;
  }

  /**
   * Converts numerical score to grade
   */
  private calculateGrade(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.75) return 'Good';
    if (score >= 0.6) return 'Fair';
    return 'Poor';
  }

  /**
   * Generates actionable recommendations
   */
  private generateRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.overallScore < 0.7) {
      recommendations.push('Translation quality is below standard - consider comprehensive review');
    }
    
    if (metrics.dictionaryUsage < 0.6) {
      recommendations.push('Increase usage of dictionary terms for better accuracy');
    }
    
    if (metrics.structuralIntegrity < 0.7) {
      recommendations.push('Review sentence structure and formatting consistency');
    }
    
    if (metrics.terminologyConsistency < 0.7) {
      recommendations.push('Standardize terminology usage throughout the text');
    }
    
    if (metrics.completeness < 0.8) {
      recommendations.push('Verify all content has been fully translated');
    }
    
    if (metrics.naturalness < 0.6) {
      recommendations.push('Improve English flow and readability');
    }
    
    return recommendations;
  }
}