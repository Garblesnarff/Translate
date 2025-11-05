/**
 * TermLearningService (Task 2.4.1.3)
 *
 * Automatically learns Tibetan-English terminology from completed translations.
 * Extracts high-confidence term pairs, stores them in a learning database,
 * and provides workflow for human review and approval.
 *
 * Features:
 * - Automatic term extraction from translations
 * - High-confidence filtering (>0.8)
 * - Deduplication with existing dictionary
 * - Frequency tracking across multiple translations
 * - Approval workflow to move terms to main dictionary
 * - Statistics and reporting
 *
 * @module server/services/dictionary/TermLearningService
 */

import { TermExtractor, type TermPair } from './TermExtractor.js';
import type { DictionaryDatabase } from './DictionaryService.js';

/**
 * Translation result interface
 */
export interface TranslationResult {
  id: string;
  translation: string;
  sourceText: string;
  confidence: number;
  metadata?: Record<string, any>;
}

/**
 * Learned term database record
 */
export interface LearnedTerm {
  id: string;
  tibetan: string;
  english: string;
  confidence: number;
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  approved: boolean;
  translationIds?: string[]; // Track which translations this term appeared in
}

/**
 * Database interface for learned terms
 */
export interface LearnedTermsDatabase {
  /**
   * Get a learned term by Tibetan text
   */
  getByTibetan(tibetan: string): Promise<LearnedTerm | null>;

  /**
   * Insert a new learned term
   */
  insert(term: Omit<LearnedTerm, 'id'>): Promise<string>;

  /**
   * Update an existing learned term
   */
  update(id: string, updates: Partial<LearnedTerm>): Promise<void>;

  /**
   * Query learned terms with filters
   */
  query(filters: {
    minConfidence?: number;
    approved?: boolean;
    limit?: number;
  }): Promise<LearnedTerm[]>;

  /**
   * Get statistics
   */
  getStats(): Promise<{
    total: number;
    highConfidence: number;
    pending: number;
    approved: number;
  }>;
}

/**
 * TermLearningService manages automatic term learning from translations.
 *
 * Workflow:
 * 1. Extract terms from translation using TermExtractor
 * 2. Filter for high-confidence terms (>0.8)
 * 3. Check if term already exists in dictionary (deduplicate)
 * 4. Check if term already learned (update frequency)
 * 5. Store new terms in learned_terms table
 * 6. Human reviews pending terms
 * 7. Approved terms moved to main dictionary
 *
 * @example
 * ```typescript
 * const service = new TermLearningService(db, learnedDb, cache);
 *
 * // Learn from translation
 * const translation = {
 *   id: 'trans-1',
 *   translation: 'Buddha (སངས་རྒྱས་) taught...',
 *   confidence: 0.9
 * };
 * const learned = await service.learnFromTranslation(translation);
 *
 * // Review high-confidence terms
 * const pending = await service.getLearnedTerms(0.85);
 *
 * // Approve selected terms
 * await service.approveTerms(pending.slice(0, 10));
 * ```
 */
export class TermLearningService {
  private extractor: TermExtractor;
  private dictionaryDb: DictionaryDatabase;
  private learnedDb: LearnedTermsDatabase;

  constructor(
    dictionaryDb: DictionaryDatabase,
    learnedDb: LearnedTermsDatabase
  ) {
    this.extractor = new TermExtractor();
    this.dictionaryDb = dictionaryDb;
    this.learnedDb = learnedDb;
  }

  /**
   * Learn terms from a translation result.
   *
   * Process:
   * 1. Extract all terms from translation text
   * 2. Filter for high-confidence terms (>0.8)
   * 3. Deduplicate with existing dictionary
   * 4. Update or insert learned terms
   * 5. Track frequency and timestamps
   *
   * @param translation - Translation result to learn from
   * @returns Array of learned term pairs (high confidence only)
   */
  async learnFromTranslation(translation: TranslationResult): Promise<TermPair[]> {
    // Validate input
    if (!translation || !translation.translation || !translation.id) {
      throw new Error('Invalid translation: missing required fields');
    }

    // Extract all terms
    const allTerms = this.extractor.extract(translation.translation);

    // Filter for high confidence (>0.8)
    const highConfidenceTerms = allTerms.filter(term => term.confidence > 0.8);

    if (highConfidenceTerms.length === 0) {
      return [];
    }

    // Get existing dictionary entries to avoid duplicates
    const tibetanTexts = highConfidenceTerms.map(t => t.tibetan);
    const existingDictTerms = await this.dictionaryDb.query(tibetanTexts);
    const existingTibetanSet = new Set(existingDictTerms.map(t => t.tibetan));

    // Filter out terms already in dictionary
    const newTerms = highConfidenceTerms.filter(
      term => !existingTibetanSet.has(term.tibetan)
    );

    // Process each new term
    const learnedTerms: TermPair[] = [];

    for (const term of newTerms) {
      try {
        // Check if we've already learned this term
        const existing = await this.learnedDb.getByTibetan(term.tibetan);

        if (existing) {
          // Update frequency and lastSeen
          await this.learnedDb.update(existing.id, {
            frequency: existing.frequency + 1,
            lastSeen: new Date(),
            // Update confidence if higher
            confidence: Math.max(existing.confidence, term.confidence),
            // Add translation ID if tracking
            translationIds: existing.translationIds
              ? [...existing.translationIds, translation.id]
              : [translation.id],
          });

          learnedTerms.push(term);
        } else {
          // Insert new learned term
          const now = new Date();
          await this.learnedDb.insert({
            tibetan: term.tibetan,
            english: term.english,
            confidence: term.confidence,
            frequency: 1,
            firstSeen: now,
            lastSeen: now,
            approved: false,
            translationIds: [translation.id],
          });

          learnedTerms.push(term);
        }
      } catch (error) {
        console.error(`Error saving learned term ${term.tibetan}:`, error);
        // Continue with other terms
      }
    }

    return learnedTerms;
  }

  /**
   * Get learned terms filtered by confidence.
   *
   * @param minConfidence - Minimum confidence threshold (default: 0)
   * @returns Array of learned terms, sorted by confidence (highest first)
   */
  async getLearnedTerms(minConfidence: number = 0): Promise<LearnedTerm[]> {
    return this.learnedDb.query({
      minConfidence,
      approved: false, // Only return pending terms by default
      limit: 1000, // Reasonable limit
    });
  }

  /**
   * Approve terms and move them to main dictionary.
   *
   * Process:
   * 1. For each term, check if already in dictionary
   * 2. Determine frequency category based on usage count
   * 3. Insert into main dictionary
   * 4. Mark as approved in learned_terms
   *
   * Frequency Mapping:
   * - 20+ occurrences: very_common
   * - 10-19 occurrences: common
   * - 3-9 occurrences: uncommon
   * - 1-2 occurrences: rare
   *
   * @param terms - Array of term pairs to approve
   */
  async approveTerms(terms: TermPair[]): Promise<void> {
    if (!terms || terms.length === 0) {
      return;
    }

    // Get existing dictionary entries to avoid duplicates
    const tibetanTexts = terms.map(t => t.tibetan);
    const existingDictTerms = await this.dictionaryDb.query(tibetanTexts);
    const existingTibetanSet = new Set(existingDictTerms.map(t => t.tibetan));

    for (const term of terms) {
      try {
        // Skip if already in dictionary
        if (existingTibetanSet.has(term.tibetan)) {
          console.log(`Term ${term.tibetan} already in dictionary, skipping`);
          continue;
        }

        // Get learned term details for frequency info
        const learnedTerm = await this.learnedDb.getByTibetan(term.tibetan);

        if (!learnedTerm) {
          console.warn(`Learned term ${term.tibetan} not found, skipping`);
          continue;
        }

        // Determine frequency category
        const frequency = this.determineFrequency(learnedTerm.frequency);

        // Insert into main dictionary
        await this.dictionaryDb.insert({
          tibetan: term.tibetan,
          english: term.english,
          frequency,
          category: this.guessCategory(term.english),
        });

        // Mark as approved in learned_terms
        await this.learnedDb.update(learnedTerm.id, {
          approved: true,
        });

        console.log(`Approved term: ${term.tibetan} -> ${term.english} (${frequency})`);
      } catch (error) {
        console.error(`Error approving term ${term.tibetan}:`, error);
        // Continue with other terms
      }
    }
  }

  /**
   * Determine frequency category based on usage count.
   *
   * @param count - Number of occurrences
   * @returns Frequency category
   */
  private determineFrequency(
    count: number
  ): 'very_common' | 'common' | 'uncommon' | 'rare' {
    if (count >= 20) return 'very_common';
    if (count >= 10) return 'common';
    if (count >= 3) return 'uncommon';
    return 'rare';
  }

  /**
   * Guess category based on English translation.
   * This is a simple heuristic - could be improved with ML.
   *
   * @param english - English translation
   * @returns Guessed category
   */
  private guessCategory(english: string): string {
    const lower = english.toLowerCase();

    // Religious terms
    const religious = ['buddha', 'dharma', 'sangha', 'monk', 'nun', 'lama', 'teacher',
      'meditation', 'enlightenment', 'nirvana', 'karma', 'rebirth',
      'compassion', 'wisdom', 'bodhisattva', 'arhat', 'sutra', 'mantra'];

    for (const word of religious) {
      if (lower.includes(word)) {
        return 'religious';
      }
    }

    // Philosophical terms
    const philosophical = ['mind', 'consciousness', 'emptiness', 'reality', 'truth',
      'essence', 'nature', 'existence', 'awareness'];

    for (const word of philosophical) {
      if (lower.includes(word)) {
        return 'philosophical';
      }
    }

    // Greeting/social
    const greeting = ['greet', 'hello', 'welcome', 'thank', 'please'];

    for (const word of greeting) {
      if (lower.includes(word)) {
        return 'greeting';
      }
    }

    // Default
    return 'general';
  }

  /**
   * Get statistics about learned terms.
   *
   * @returns Statistics object
   */
  async getStats(): Promise<{
    total: number;
    highConfidence: number;
    pending: number;
    approved: number;
  }> {
    return this.learnedDb.getStats();
  }

  /**
   * Get extraction statistics for a translation.
   * Useful for understanding what was learned.
   *
   * @param translation - Translation to analyze
   * @returns Extraction statistics
   */
  async getExtractionStats(translation: TranslationResult): Promise<{
    totalExtracted: number;
    highConfidence: number;
    alreadyInDictionary: number;
    alreadyLearned: number;
    newTerms: number;
  }> {
    const allTerms = this.extractor.extract(translation.translation);
    const highConfidence = allTerms.filter(t => t.confidence > 0.8);

    const tibetanTexts = allTerms.map(t => t.tibetan);
    const existingDictTerms = await this.dictionaryDb.query(tibetanTexts);
    const existingTibetanSet = new Set(existingDictTerms.map(t => t.tibetan));

    let alreadyLearned = 0;
    for (const term of highConfidence) {
      const learned = await this.learnedDb.getByTibetan(term.tibetan);
      if (learned) {
        alreadyLearned++;
      }
    }

    const newTerms = highConfidence.length -
      highConfidence.filter(t => existingTibetanSet.has(t.tibetan)).length -
      alreadyLearned;

    return {
      totalExtracted: allTerms.length,
      highConfidence: highConfidence.length,
      alreadyInDictionary: highConfidence.filter(t =>
        existingTibetanSet.has(t.tibetan)
      ).length,
      alreadyLearned,
      newTerms: Math.max(0, newTerms),
    };
  }
}
