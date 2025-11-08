/**
 * Pattern-Based Relationship Extractor (STUB)
 *
 * This is a placeholder showing how PatternExtractor will integrate with
 * LLMRelationshipExtractor. To be implemented in Phase 3, Task 3.1.
 *
 * The pattern extractor handles simple, regex-based relationship extraction
 * and falls back to LLM for complex cases.
 */

import type { Relationship, Entity } from '../../types/entities';
import { llmRelationshipExtractor, type ExtractionContext } from './LLMRelationshipExtractor';

/**
 * Pattern-based relationship extractor
 */
export class PatternRelationshipExtractor {
  /**
   * Extract relationships using pattern matching
   *
   * @param text - Text to extract from
   * @param context - Extraction context
   * @returns Array of relationships
   */
  async extractRelationships(
    text: string,
    context: ExtractionContext
  ): Promise<Relationship[]> {
    const patternResults: Relationship[] = [];
    const complexSentences: string[] = [];

    // TODO: Implement pattern matching
    // For now, identify complex sentences that need LLM

    // Example: Split into sentences
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      if (this.isComplexSentence(sentence)) {
        complexSentences.push(sentence);
      } else {
        // TODO: Apply pattern matching
        // const patterns = this.applyPatterns(sentence, context);
        // patternResults.push(...patterns);
      }
    }

    // Fall back to LLM for complex sentences
    const llmResults: Relationship[] = [];
    for (const sentence of complexSentences) {
      const llmExtracted = await llmRelationshipExtractor.extractRelationships(
        sentence,
        context,
        { minConfidence: 0.7 }
      );
      llmResults.push(...llmExtracted);
    }

    // Combine and deduplicate
    return this.combineResults(patternResults, llmResults);
  }

  /**
   * Determine if sentence is too complex for pattern matching
   */
  private isComplexSentence(sentence: string): boolean {
    // Complex if:
    // - Multiple clauses (has "and", "but", "while", "after", etc.)
    // - Contains pronouns needing resolution
    // - Nested relationships
    // - Ambiguous structure

    const complexityMarkers = [
      /\b(he|she|they|it|the master|the teacher)\b/i, // Pronouns
      /\b(while|after|before|during|when)\b/i, // Temporal clauses
      /\b(who|which|that)\b.*\b(who|which|that)\b/i, // Nested relative clauses
      /,.*,.*,/, // Multiple commas indicating complex structure
    ];

    return complexityMarkers.some(pattern => pattern.test(sentence));
  }

  /**
   * Combine pattern and LLM results with deduplication
   */
  private combineResults(
    patternResults: Relationship[],
    llmResults: Relationship[]
  ): Relationship[] {
    const combined = new Map<string, Relationship>();

    // Add pattern results (higher confidence, faster)
    for (const rel of patternResults) {
      const key = `${rel.subjectId}-${rel.predicate}-${rel.objectId}`;
      combined.set(key, rel);
    }

    // Add LLM results only if not already found by patterns
    for (const rel of llmResults) {
      const key = `${rel.subjectId}-${rel.predicate}-${rel.objectId}`;
      if (!combined.has(key)) {
        combined.set(key, rel);
      }
    }

    return Array.from(combined.values());
  }
}

export const patternRelationshipExtractor = new PatternRelationshipExtractor();
