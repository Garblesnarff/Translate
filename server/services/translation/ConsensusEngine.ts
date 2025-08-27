export interface TranslationConsensus {
  finalTranslation: string;
  confidence: number;
  modelAgreement: number;
  models: string[];
  individualResponses: AIResponse[];
}

export interface AIResponse {
  translation: string;
  confidence: number;
  model: string;
  provider: string;
  reasoning?: string;
  tokensUsed?: number;
  processingTime?: number;
}

interface SentenceAlignment {
  geminiSentence: string;
  helperSentences: { model: string; sentence: string; confidence: number }[];
  tibetanOriginal: string;
  consensus: string;
  agreementScore: number;
}

/**
 * Engine for creating consensus translations from multiple AI models
 * Analyzes agreement between models and creates the best possible translation
 */
export class ConsensusEngine {
  private readonly AGREEMENT_THRESHOLD = 0.7;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;

  /**
   * Creates a consensus translation from Gemini and helper AI responses
   */
  public createConsensus(
    geminiTranslation: string,
    geminiConfidence: number,
    helperResponses: AIResponse[]
  ): TranslationConsensus {
    if (helperResponses.length === 0) {
      // No helper responses, return Gemini translation
      return {
        finalTranslation: geminiTranslation,
        confidence: geminiConfidence,
        modelAgreement: 1.0,
        models: ['gemini-2.0-flash-exp'],
        individualResponses: []
      };
    }

    // Filter out low-confidence helper responses
    const validHelperResponses = helperResponses.filter(
      response => response.confidence >= this.MIN_CONFIDENCE_THRESHOLD && response.translation.trim().length > 0
    );

    if (validHelperResponses.length === 0) {
      return {
        finalTranslation: geminiTranslation,
        confidence: geminiConfidence * 0.9, // Slight penalty for no valid helpers
        modelAgreement: 1.0,
        models: ['gemini-2.0-flash-exp'],
        individualResponses: helperResponses
      };
    }

    // Align sentences for comparison
    const alignments = this.alignSentences(geminiTranslation, validHelperResponses);
    
    // Build consensus translation sentence by sentence
    const consensusBuilder: string[] = [];
    let totalAgreementScore = 0;
    
    for (const alignment of alignments) {
      consensusBuilder.push(alignment.consensus);
      totalAgreementScore += alignment.agreementScore;
    }

    const finalTranslation = consensusBuilder.join(' ').trim();
    const averageAgreement = alignments.length > 0 ? totalAgreementScore / alignments.length : 0;
    const finalConfidence = this.calculateFinalConfidence(geminiConfidence, validHelperResponses, averageAgreement);

    return {
      finalTranslation,
      confidence: finalConfidence,
      modelAgreement: averageAgreement,
      models: ['gemini-2.0-flash-exp', ...validHelperResponses.map(r => r.model)],
      individualResponses: helperResponses
    };
  }

  /**
   * Aligns sentences from different translations for comparison
   */
  private alignSentences(geminiTranslation: string, helperResponses: AIResponse[]): SentenceAlignment[] {
    const geminiSentences = this.splitIntoSentences(geminiTranslation);
    const helperSentenceSets = helperResponses.map(response => ({
      model: response.model,
      sentences: this.splitIntoSentences(response.translation),
      confidence: response.confidence
    }));

    const alignments: SentenceAlignment[] = [];

    // Process each Gemini sentence
    for (let i = 0; i < geminiSentences.length; i++) {
      const geminiSentence = geminiSentences[i];
      const tibetanOriginal = this.extractTibetanFromSentence(geminiSentence);
      
      // Find corresponding sentences in helper translations
      const helperSentences = helperSentenceSets.map(helperSet => {
        const correspondingSentence = this.findCorrespondingSentence(
          geminiSentence,
          helperSet.sentences,
          i,
          tibetanOriginal
        );
        return {
          model: helperSet.model,
          sentence: correspondingSentence,
          confidence: helperSet.confidence
        };
      }).filter(helper => helper.sentence.length > 0);

      // Create consensus for this sentence
      const { consensus, agreementScore } = this.createSentenceConsensus(
        geminiSentence,
        helperSentences,
        tibetanOriginal
      );

      alignments.push({
        geminiSentence,
        helperSentences,
        tibetanOriginal,
        consensus,
        agreementScore
      });
    }

    return alignments;
  }

  /**
   * Creates consensus for a single sentence from multiple translations
   */
  private createSentenceConsensus(
    geminiSentence: string,
    helperSentences: { model: string; sentence: string; confidence: number }[],
    tibetanOriginal: string
  ): { consensus: string; agreementScore: number } {
    if (helperSentences.length === 0) {
      return {
        consensus: geminiSentence,
        agreementScore: 1.0
      };
    }

    // Compare English parts (without Tibetan in parentheses)
    const geminiEnglish = this.extractEnglishFromSentence(geminiSentence);
    const helperEnglishParts = helperSentences.map(helper => ({
      ...helper,
      english: this.extractEnglishFromSentence(helper.sentence)
    }));

    // Calculate similarity scores
    const similarities = helperEnglishParts.map(helper => ({
      ...helper,
      similarity: this.calculateSimilarity(geminiEnglish, helper.english)
    }));

    // Find the translation with highest agreement
    const bestHelper = similarities.reduce((best, current) => 
      current.similarity > best.similarity ? current : best
    );

    let consensus: string;
    let agreementScore: number;

    if (bestHelper.similarity >= this.AGREEMENT_THRESHOLD) {
      // High agreement - use the best translation but ensure Tibetan is included
      if (bestHelper.confidence > 0.8 && bestHelper.similarity > 0.8) {
        consensus = this.ensureTibetanIncluded(bestHelper.sentence, tibetanOriginal);
        agreementScore = bestHelper.similarity;
      } else {
        consensus = geminiSentence; // Fallback to Gemini
        agreementScore = bestHelper.similarity * 0.8;
      }
    } else {
      // Low agreement - prefer Gemini but note the disagreement
      consensus = geminiSentence;
      agreementScore = Math.max(...similarities.map(s => s.similarity));
    }

    return { consensus, agreementScore };
  }

  /**
   * Splits translation into sentences, preserving Tibetan parentheses
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries but keep Tibetan parentheses with their sentences
    const sentences: string[] = [];
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    
    for (const part of parts) {
      if (part.trim().length > 0) {
        sentences.push(part.trim());
      }
    }
    
    return sentences.length > 0 ? sentences : [text];
  }

  /**
   * Extracts Tibetan text from parentheses in a sentence
   */
  private extractTibetanFromSentence(sentence: string): string {
    const tibetanMatch = sentence.match(/\(([^)]*[\u0F00-\u0FFF][^)]*)\)/);
    return tibetanMatch ? tibetanMatch[1] : '';
  }

  /**
   * Extracts English text (removes Tibetan parentheses)
   */
  private extractEnglishFromSentence(sentence: string): string {
    return sentence.replace(/\s*\([^)]*[\u0F00-\u0FFF][^)]*\)/g, '').trim();
  }

  /**
   * Finds corresponding sentence in helper translation
   */
  private findCorrespondingSentence(
    geminiSentence: string,
    helperSentences: string[],
    position: number,
    tibetanOriginal: string
  ): string {
    if (position < helperSentences.length) {
      return helperSentences[position];
    }

    // If helper has fewer sentences, try to find by Tibetan content
    if (tibetanOriginal) {
      for (const helperSentence of helperSentences) {
        if (helperSentence.includes(tibetanOriginal)) {
          return helperSentence;
        }
      }
    }

    // Fallback: find most similar sentence
    const geminiEnglish = this.extractEnglishFromSentence(geminiSentence);
    let bestMatch = '';
    let bestSimilarity = 0;

    for (const helperSentence of helperSentences) {
      const helperEnglish = this.extractEnglishFromSentence(helperSentence);
      const similarity = this.calculateSimilarity(geminiEnglish, helperEnglish);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = helperSentence;
      }
    }

    return bestSimilarity > 0.3 ? bestMatch : '';
  }

  /**
   * Calculates similarity between two English text strings
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Ensures Tibetan original text is included in the translation
   */
  private ensureTibetanIncluded(sentence: string, tibetanOriginal: string): string {
    if (!tibetanOriginal) return sentence;
    
    // Check if Tibetan is already included
    if (sentence.includes(tibetanOriginal)) {
      return sentence;
    }
    
    // Add Tibetan at the end of the sentence
    const englishPart = this.extractEnglishFromSentence(sentence);
    return `${englishPart} (${tibetanOriginal})`;
  }

  /**
   * Calculates final confidence score based on all models
   */
  private calculateFinalConfidence(
    geminiConfidence: number,
    helperResponses: AIResponse[],
    agreementScore: number
  ): number {
    if (helperResponses.length === 0) {
      return geminiConfidence;
    }

    // Weight Gemini confidence with helper confidences and agreement
    const helperConfidences = helperResponses.map(r => r.confidence);
    const averageHelperConfidence = helperConfidences.reduce((a, b) => a + b, 0) / helperConfidences.length;
    
    // Base confidence is weighted average of all models
    const baseConfidence = (geminiConfidence * 0.4) + (averageHelperConfidence * 0.6);
    
    // Boost confidence based on agreement between models
    const agreementBoost = agreementScore * 0.2;
    
    // Slight penalty if models disagree significantly
    const disagreementPenalty = agreementScore < 0.5 ? 0.1 : 0;
    
    return Math.min(0.98, Math.max(0.1, baseConfidence + agreementBoost - disagreementPenalty));
  }

  /**
   * Provides detailed analysis of the consensus process
   */
  public analyzeConsensus(consensus: TranslationConsensus): {
    summary: string;
    details: string[];
    recommendations: string[];
  } {
    const analysis = {
      summary: '',
      details: [] as string[],
      recommendations: [] as string[]
    };

    // Generate summary
    if (consensus.modelAgreement >= 0.8) {
      analysis.summary = 'High agreement between models - translation is likely very accurate';
    } else if (consensus.modelAgreement >= 0.6) {
      analysis.summary = 'Moderate agreement between models - translation is reasonably accurate';
    } else {
      analysis.summary = 'Low agreement between models - translation may need review';
    }

    // Add details
    analysis.details.push(`Models used: ${consensus.models.join(', ')}`);
    analysis.details.push(`Final confidence: ${(consensus.confidence * 100).toFixed(1)}%`);
    analysis.details.push(`Model agreement: ${(consensus.modelAgreement * 100).toFixed(1)}%`);

    // Add recommendations
    if (consensus.modelAgreement < 0.5) {
      analysis.recommendations.push('Consider manual review due to low model agreement');
    }
    if (consensus.confidence < 0.7) {
      analysis.recommendations.push('Translation confidence is below threshold - verify with additional sources');
    }
    if (consensus.individualResponses.some(r => r.reasoning?.includes('Error'))) {
      analysis.recommendations.push('Some models failed - consider checking API configurations');
    }

    return analysis;
  }
}