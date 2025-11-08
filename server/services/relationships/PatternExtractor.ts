/**
 * Pattern-Based Relationship Extraction Service
 *
 * Extracts relationships from Tibetan Buddhist texts using 100+ regex patterns.
 * Part of Phase 3: Relationship Extraction (Task 3.1)
 *
 * Features:
 * - 100+ comprehensive regex patterns across 8 categories
 * - Active/passive voice handling
 * - Entity resolution with fuzzy matching
 * - Date and location extraction
 * - Confidence scoring based on pattern strength and entity match quality
 * - Extensible pattern library
 *
 * @see roadmaps/knowledge-graph/RELATIONSHIP_TYPES.md
 * @see roadmaps/knowledge-graph/PHASES_SUMMARY.md (lines 48-58)
 */

import type { Entity, Relationship, PredicateType, DateInfo } from '../../types/entities';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A single relationship extraction pattern with metadata
 */
export interface RelationshipPattern {
  /** Unique pattern identifier */
  id: string;

  /** Relationship type this pattern extracts */
  predicate: PredicateType;

  /** Regular expression for matching */
  pattern: RegExp;

  /** Capture group index for subject entity */
  subjectGroup: number;

  /** Capture group index for object entity */
  objectGroup: number;

  /** Base confidence score for this pattern (0.0-1.0) */
  confidence: number;

  /** Optional capture group for dates */
  dateGroup?: number;

  /** Optional capture group for locations */
  locationGroup?: number;

  /** Optional capture group for teaching/transmission */
  teachingGroup?: number;

  /** Optional capture group for duration */
  durationGroup?: number;

  /** Example sentences that match this pattern */
  examples: string[];

  /** Pattern category for organization */
  category: PatternCategory;

  /** Additional notes about usage or edge cases */
  notes?: string;

  /** Whether pattern is bidirectional (creates inverse relationship) */
  bidirectional?: boolean;

  /** Inverse predicate if bidirectional */
  inversePredicate?: PredicateType;
}

/**
 * Pattern categories for organization
 */
export type PatternCategory =
  | 'teacher-student'
  | 'authorship'
  | 'location'
  | 'text-relationship'
  | 'event'
  | 'lineage'
  | 'institutional'
  | 'family';

/**
 * Raw match from pattern before entity resolution
 */
export interface PatternMatch {
  /** Pattern that matched */
  pattern: RelationshipPattern;

  /** Full matched text */
  fullMatch: string;

  /** Subject name (raw text) */
  subjectText: string;

  /** Object name (raw text) */
  objectText: string;

  /** Extracted date if present */
  dateText?: string;

  /** Extracted location if present */
  locationText?: string;

  /** Extracted teaching if present */
  teachingText?: string;

  /** Extracted duration if present */
  durationText?: string;

  /** Position in source text */
  position: number;
}

/**
 * Resolved match with entity references
 */
export interface ResolvedMatch {
  /** Original pattern match */
  match: PatternMatch;

  /** Resolved subject entity */
  subject: Entity | null;

  /** Resolved object entity */
  object: Entity | null;

  /** Confidence in subject resolution (0.0-1.0) */
  subjectConfidence: number;

  /** Confidence in object resolution (0.0-1.0) */
  objectConfidence: number;

  /** Overall confidence score */
  overallConfidence: number;

  /** Whether this match should be reviewed */
  needsReview: boolean;

  /** Reason for review if needed */
  reviewReason?: string;
}

/**
 * Extraction statistics
 */
export interface ExtractionStats {
  totalPatterns: number;
  patternsMatched: number;
  totalMatches: number;
  resolvedMatches: number;
  unresolvedMatches: number;
  averageConfidence: number;
  relationshipsByPredicate: Record<string, number>;
  processingTime: number;
}

// ============================================================================
// Pattern-Based Relationship Extractor
// ============================================================================

export class PatternExtractor {
  private patterns: RelationshipPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Extract relationships from text using known entities
   *
   * @param text - Source text to extract from
   * @param entities - Known entities for resolution
   * @returns Extracted relationships with confidence scores
   */
  extractRelationships(text: string, entities: Entity[]): Relationship[] {
    const startTime = Date.now();
    const relationships: Relationship[] = [];

    // Find all pattern matches
    const matches = this.findAllMatches(text);

    // Resolve entity references
    const resolvedMatches = matches.map(match =>
      this.resolveEntityReferences(match, entities)
    );

    // Convert to relationships
    for (const resolved of resolvedMatches) {
      if (resolved.subject && resolved.object) {
        const relationship = this.createRelationship(resolved);
        relationships.push(relationship);

        // Create inverse relationship if bidirectional
        if (resolved.match.pattern.bidirectional && resolved.match.pattern.inversePredicate) {
          const inverseRel = this.createInverseRelationship(resolved);
          relationships.push(inverseRel);
        }
      }
    }

    return relationships;
  }

  /**
   * Match text against a specific pattern
   *
   * @param text - Text to search
   * @param pattern - Pattern to match
   * @returns Array of matches
   */
  matchPattern(text: string, pattern: RelationshipPattern): PatternMatch[] {
    const matches: PatternMatch[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    pattern.pattern.lastIndex = 0;

    while ((match = pattern.pattern.exec(text)) !== null) {
      matches.push({
        pattern,
        fullMatch: match[0],
        subjectText: match[pattern.subjectGroup]?.trim() || '',
        objectText: match[pattern.objectGroup]?.trim() || '',
        dateText: pattern.dateGroup ? match[pattern.dateGroup]?.trim() : undefined,
        locationText: pattern.locationGroup ? match[pattern.locationGroup]?.trim() : undefined,
        teachingText: pattern.teachingGroup ? match[pattern.teachingGroup]?.trim() : undefined,
        durationText: pattern.durationGroup ? match[pattern.durationGroup]?.trim() : undefined,
        position: match.index
      });
    }

    return matches;
  }

  /**
   * Resolve entity references in a pattern match
   *
   * @param match - Pattern match to resolve
   * @param entities - Known entities
   * @returns Resolved match with entity references
   */
  resolveEntityReferences(match: PatternMatch, entities: Entity[]): ResolvedMatch {
    const subject = this.findEntity(match.subjectText, entities);
    const object = this.findEntity(match.objectText, entities);

    const subjectConfidence = subject ? this.calculateMatchConfidence(match.subjectText, subject) : 0;
    const objectConfidence = object ? this.calculateMatchConfidence(match.objectText, object) : 0;

    // Overall confidence combines pattern strength and entity match quality
    const overallConfidence = match.pattern.confidence *
      ((subjectConfidence + objectConfidence) / 2);

    // Flag for review if confidence is low
    const needsReview = overallConfidence < 0.6 || !subject || !object;
    const reviewReason = this.getReviewReason(subject, object, subjectConfidence, objectConfidence);

    return {
      match,
      subject,
      object,
      subjectConfidence,
      objectConfidence,
      overallConfidence,
      needsReview,
      reviewReason
    };
  }

  /**
   * Get all patterns in the library
   */
  getAllPatterns(): RelationshipPattern[] {
    return [...this.patterns];
  }

  /**
   * Add a custom pattern to the library
   *
   * @param pattern - Pattern to add
   */
  addCustomPattern(pattern: RelationshipPattern): void {
    // Ensure pattern ID is unique
    if (this.patterns.some(p => p.id === pattern.id)) {
      throw new Error(`Pattern with ID ${pattern.id} already exists`);
    }

    this.patterns.push(pattern);
  }

  /**
   * Get patterns by predicate type
   *
   * @param predicate - Predicate type to filter by
   */
  getPatternsByPredicate(predicate: PredicateType): RelationshipPattern[] {
    return this.patterns.filter(p => p.predicate === predicate);
  }

  /**
   * Get patterns by category
   *
   * @param category - Category to filter by
   */
  getPatternsByCategory(category: PatternCategory): RelationshipPattern[] {
    return this.patterns.filter(p => p.category === category);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Find all pattern matches in text
   */
  private findAllMatches(text: string): PatternMatch[] {
    const allMatches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      const matches = this.matchPattern(text, pattern);
      allMatches.push(...matches);
    }

    // Sort by position in text
    return allMatches.sort((a, b) => a.position - b.position);
  }

  /**
   * Find entity by name with fuzzy matching
   */
  private findEntity(nameText: string, entities: Entity[]): Entity | null {
    if (!nameText) return null;

    const normalizedSearch = this.normalizeText(nameText);

    // Try exact match first (canonical name or any variant)
    for (const entity of entities) {
      if (this.normalizeText(entity.canonicalName) === normalizedSearch) {
        return entity;
      }

      // Check all name variants
      for (const nameList of Object.values(entity.names)) {
        if (nameList.some(name => this.normalizeText(name) === normalizedSearch)) {
          return entity;
        }
      }
    }

    // Try fuzzy matching with Levenshtein distance
    let bestMatch: Entity | null = null;
    let bestScore = 0;

    for (const entity of entities) {
      const score = this.calculateFuzzyScore(normalizedSearch, entity);
      if (score > 0.8 && score > bestScore) {
        bestMatch = entity;
        bestScore = score;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate fuzzy match score for entity
   */
  private calculateFuzzyScore(searchText: string, entity: Entity): number {
    const candidates = [
      entity.canonicalName,
      ...entity.names.english,
      ...entity.names.phonetic,
      ...entity.names.wylie
    ];

    let bestScore = 0;
    for (const candidate of candidates) {
      const normalized = this.normalizeText(candidate);
      const score = this.levenshteinSimilarity(searchText, normalized);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    return bestScore;
  }

  /**
   * Calculate match confidence based on name similarity
   */
  private calculateMatchConfidence(searchText: string, entity: Entity): number {
    const normalizedSearch = this.normalizeText(searchText);
    const normalizedCanonical = this.normalizeText(entity.canonicalName);

    // Exact match = 1.0
    if (normalizedSearch === normalizedCanonical) {
      return 1.0;
    }

    // Check variants
    for (const nameList of Object.values(entity.names)) {
      if (nameList.some(name => this.normalizeText(name) === normalizedSearch)) {
        return 0.95; // Very high confidence for variant match
      }
    }

    // Fuzzy match
    return this.calculateFuzzyScore(searchText, entity);
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[་།]/g, '') // Remove Tibetan punctuation
      .replace(/['']/g, "'") // Normalize apostrophes
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Calculate Levenshtein similarity (0.0-1.0)
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1.0 : 1.0 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Determine reason for manual review
   */
  private getReviewReason(
    subject: Entity | null,
    object: Entity | null,
    subjectConf: number,
    objectConf: number
  ): string | undefined {
    if (!subject && !object) return 'Both subject and object could not be resolved';
    if (!subject) return 'Subject entity could not be resolved';
    if (!object) return 'Object entity could not be resolved';
    if (subjectConf < 0.7) return `Low confidence subject match (${(subjectConf * 100).toFixed(0)}%)`;
    if (objectConf < 0.7) return `Low confidence object match (${(objectConf * 100).toFixed(0)}%)`;
    return undefined;
  }

  /**
   * Create relationship from resolved match
   */
  private createRelationship(resolved: ResolvedMatch): Relationship {
    const { match, subject, object, overallConfidence } = resolved;

    return {
      id: this.generateId(),
      subjectId: subject!.id,
      predicate: match.pattern.predicate,
      objectId: object!.id,
      properties: this.extractProperties(match),
      confidence: overallConfidence,
      verified: false,
      sourceQuote: match.fullMatch,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'pattern-extractor'
    };
  }

  /**
   * Create inverse relationship for bidirectional patterns
   */
  private createInverseRelationship(resolved: ResolvedMatch): Relationship {
    const { match, subject, object, overallConfidence } = resolved;

    return {
      id: this.generateId(),
      subjectId: object!.id,
      predicate: match.pattern.inversePredicate!,
      objectId: subject!.id,
      properties: this.extractProperties(match),
      confidence: overallConfidence,
      verified: false,
      sourceQuote: match.fullMatch,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'pattern-extractor'
    };
  }

  /**
   * Extract properties from match
   */
  private extractProperties(match: PatternMatch): Record<string, any> {
    const properties: Record<string, any> = {};

    if (match.dateText) {
      properties.dateText = match.dateText;
    }

    if (match.locationText) {
      properties.locationText = match.locationText;
    }

    if (match.teachingText) {
      properties.teaching = match.teachingText;
    }

    if (match.durationText) {
      properties.duration = match.durationText;
    }

    return properties;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==========================================================================
  // Pattern Library Initialization (100+ patterns)
  // ==========================================================================

  /**
   * Initialize the complete pattern library with 100+ patterns
   */
  private initializePatterns(): void {
    this.patterns = [
      ...this.getTeacherStudentPatterns(),      // 26 patterns
      ...this.getAuthorshipPatterns(),          // 22 patterns
      ...this.getLocationPatterns(),            // 21 patterns
      ...this.getTextRelationshipPatterns(),    // 16 patterns
      ...this.getEventPatterns(),               // 15 patterns
      ...this.getLineagePatterns(),             // 12 patterns
      ...this.getInstitutionalPatterns(),       // 10 patterns
      ...this.getFamilyPatterns(),              // 8 patterns
    ];
    // Total: 130 patterns
  }

  /**
   * Teacher-Student Relationship Patterns (26 patterns)
   */
  private getTeacherStudentPatterns(): RelationshipPattern[] {
    return [
      // Active voice: teacher teaches student
      {
        id: 'ts-001',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+taught\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.9,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['Marpa taught Milarepa', 'Tsongkhapa taught Gyaltsab Je']
      },
      {
        id: 'ts-002',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+instructed\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['Atisha instructed Dromtön']
      },
      {
        id: 'ts-003',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+trained\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['The master trained his disciples']
      },
      {
        id: 'ts-004',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+transmitted\s+(?:the\s+)?(?:teachings?|lineage)\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['Marpa transmitted the lineage to Milarepa']
      },
      {
        id: 'ts-005',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+gave\s+(?:teachings?|instructions?)\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['The lama gave teachings to his students']
      },

      // Passive voice: student studied under teacher
      {
        id: 'ts-006',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+studied\s+under\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.9,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['Milarepa studied under Marpa']
      },
      {
        id: 'ts-007',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+a\s+(?:student|disciple|pupil)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['Gampopa was a disciple of Milarepa']
      },
      {
        id: 'ts-008',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+learned\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.82,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['He learned from the great masters']
      },
      {
        id: 'ts-009',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+received\s+(?:teachings?|instructions?|training)\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['Sakya Pandita received teachings from his uncles']
      },
      {
        id: 'ts-010',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+trained\s+(?:with|under)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['He trained under the abbot']
      },

      // With duration
      {
        id: 'ts-011',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+studied\s+(?:with|under)\s+([A-Z][a-zA-Z\s'-]+)\s+for\s+([\d]+\s+years?)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        durationGroup: 3,
        confidence: 0.93,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['Milarepa studied under Marpa for twelve years']
      },
      {
        id: 'ts-012',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+spent\s+([\d]+\s+years?)\s+(?:studying\s+)?(?:with|under)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        durationGroup: 2,
        confidence: 0.91,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['He spent six years studying with the master']
      },

      // Possessive form
      {
        id: 'ts-013',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)['']s\s+(?:principal\s+)?(?:teacher|master|guru|lama)\s+was\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.9,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ["Gampopa's principal teacher was Milarepa"]
      },
      {
        id: 'ts-014',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)['']s\s+(?:main\s+)?(?:students?|disciples?)\s+(?:included|were)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ["Marpa's main disciples included Milarepa"]
      },

      // Ordination relationships
      {
        id: 'ts-015',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+ordained\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'teacher-student',
        examples: ['Atisha ordained many monks']
      },
      {
        id: 'ts-016',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:was\s+ordained\s+by|received\s+ordination\s+from)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['He was ordained by the abbot']
      },

      // With teaching specification
      {
        id: 'ts-017',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+taught\s+([A-Z][a-zA-Z\s'-]+)\s+the\s+([A-Za-z\s]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        teachingGroup: 3,
        confidence: 0.92,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['Marpa taught Milarepa the Hevajra Tantra']
      },
      {
        id: 'ts-018',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+received\s+the\s+([A-Za-z\s]+)\s+(?:teachings?|transmission)\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.91,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['Milarepa received the Mahamudra transmission from Marpa']
      },

      // At location
      {
        id: 'ts-019',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+studied\s+(?:with|under)\s+([A-Z][a-zA-Z\s'-]+)\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        locationGroup: 3,
        confidence: 0.92,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['He studied under the master at Sakya Monastery']
      },
      {
        id: 'ts-020',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+taught\s+([A-Z][a-zA-Z\s'-]+)\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        locationGroup: 3,
        confidence: 0.90,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['Tsongkhapa taught his disciples at Ganden']
      },

      // Mentorship variations
      {
        id: 'ts-021',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:was\s+)?(?:mentored|guided)\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['The young monk was mentored by the abbot']
      },
      {
        id: 'ts-022',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:mentored|guided)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['The abbot mentored many students']
      },

      // Apprenticeship
      {
        id: 'ts-023',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:was\s+an?\s+)?apprentice\s+(?:of|to)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['He was an apprentice to the translator']
      },

      // Served as
      {
        id: 'ts-024',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+served\s+(?:as\s+(?:a\s+)?(?:student|attendant)\s+to\s+)?([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.80,
        category: 'teacher-student',
        notes: 'Lower confidence as "served" can mean various things',
        examples: ['He served as attendant to the lama']
      },

      // Empowerment
      {
        id: 'ts-025',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+received\s+(?:an?\s+)?empowerments?\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'teacher_of',
        examples: ['Sakya Pandita received empowerments from his uncles']
      },
      {
        id: 'ts-026',
        predicate: 'teacher_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+gave\s+(?:an?\s+)?empowerments?\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'teacher-student',
        bidirectional: true,
        inversePredicate: 'student_of',
        examples: ['The lama gave empowerments to thousands']
      }
    ];
  }

  /**
   * Authorship Relationship Patterns (22 patterns)
   */
  private getAuthorshipPatterns(): RelationshipPattern[] {
    return [
      // Wrote/composed
      {
        id: 'au-001',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+wrote\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)(?:\.|,|;|\s+in\s+|\s+at\s+|\s+during\s+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.9,
        category: 'authorship',
        examples: ['Tsongkhapa wrote the Lamrim Chenmo.']
      },
      {
        id: 'au-002',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+composed\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)(?:\.|,|;|\s+in\s+|\s+at\s+|\s+during\s+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'authorship',
        examples: ['Sakya Pandita composed the Treasury of Logic.']
      },
      {
        id: 'au-003',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+authored\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)(?:\.|,|;|\s+in\s+|\s+at\s+|\s+during\s+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'authorship',
        examples: ['Nagarjuna authored the Root Verses on the Middle Way.']
      },
      {
        id: 'au-004',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+penned\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)(?:\.|,|;|\s+in\s+|\s+at\s+|\s+during\s+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'authorship',
        examples: ['The poet penned many verses.']
      },

      // Passive voice
      {
        id: 'au-005',
        predicate: 'wrote',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+was\s+(?:written|composed|authored)\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 2,
        objectGroup: 1,
        confidence: 0.92,
        category: 'authorship',
        examples: ['The Lamrim Chenmo was written by Tsongkhapa.']
      },
      {
        id: 'au-006',
        predicate: 'wrote',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+is\s+attributed\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 2,
        objectGroup: 1,
        confidence: 0.80,
        category: 'authorship',
        notes: 'Lower confidence as attribution can be uncertain',
        examples: ['The text is attributed to Padmasambhava.']
      },

      // With date
      {
        id: 'au-007',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:wrote|composed)\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+in\s+([\d]{3,4})/gi,
        subjectGroup: 1,
        objectGroup: 2,
        dateGroup: 3,
        confidence: 0.93,
        category: 'authorship',
        examples: ['Tsongkhapa composed the Lamrim Chenmo in 1402.']
      },

      // With location
      {
        id: 'au-008',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:wrote|composed)\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        locationGroup: 3,
        confidence: 0.92,
        category: 'authorship',
        examples: ['He composed the text at Sakya Monastery.']
      },

      // Translation patterns
      {
        id: 'au-009',
        predicate: 'translated',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+translated\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)(?:\.|,|;|\s+from\s+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'authorship',
        examples: ['Marpa translated the Hevajra Tantra.']
      },
      {
        id: 'au-010',
        predicate: 'translated',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+translated\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+from\s+(Sanskrit|Chinese|Pali)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'authorship',
        examples: ['Marpa translated the text from Sanskrit.']
      },
      {
        id: 'au-011',
        predicate: 'translated',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+was\s+translated\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 2,
        objectGroup: 1,
        confidence: 0.92,
        category: 'authorship',
        examples: ['The Prajnaparamita was translated by many lotsawas.']
      },
      {
        id: 'au-012',
        predicate: 'translated',
        pattern: /([A-Z][a-zA-Z\s'-]+)(?:\s+Lotsawa)?\s+rendered\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+into\s+Tibetan/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'authorship',
        examples: ['Marpa Lotsawa rendered the text into Tibetan.']
      },

      // Author of
      {
        id: 'au-013',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+),?\s+(?:the\s+)?author\s+of\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?),/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'authorship',
        examples: ['Nagarjuna, the author of the Root Verses, also wrote...']
      },
      {
        id: 'au-014',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)['']s\s+(?:famous\s+|renowned\s+)?(?:work|text|treatise|commentary)\s+([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'authorship',
        examples: ["Tsongkhapa's famous work the Lamrim Chenmo"]
      },

      // Compiled
      {
        id: 'au-015',
        predicate: 'compiled',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+compiled\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'authorship',
        examples: ['Buton compiled the Kangyur catalog.']
      },
      {
        id: 'au-016',
        predicate: 'compiled',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+was\s+compiled\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 2,
        objectGroup: 1,
        confidence: 0.89,
        category: 'authorship',
        examples: ['The collection was compiled by the editor.']
      },

      // Terma discoverer
      {
        id: 'au-017',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:revealed|discovered)\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+terma/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'authorship',
        notes: 'Terma treasure revealer',
        examples: ['Orgyen Lingpa revealed the Padma Kathang terma.']
      },

      // Commentary
      {
        id: 'au-018',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:wrote|composed)\s+a\s+commentary\s+on\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'authorship',
        notes: 'Should also create commentary_on relationship',
        examples: ['Chandrakirti wrote a commentary on the Root Verses.']
      },

      // Produced
      {
        id: 'au-019',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+produced\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.82,
        category: 'authorship',
        examples: ['The scholar produced many texts.']
      },

      // Creation
      {
        id: 'au-020',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+created\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.83,
        category: 'authorship',
        examples: ['The master created this liturgy.']
      },

      // Multi-author
      {
        id: 'au-021',
        predicate: 'wrote',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+and\s+([A-Z][a-zA-Z\s'-]+)\s+(?:co-)?(?:wrote|authored|composed)\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        confidence: 0.88,
        category: 'authorship',
        notes: 'Creates relationship for first author only; needs special handling for second',
        examples: ['Rinchen Zangpo and Atisha co-authored the text.']
      },

      // Work of
      {
        id: 'au-022',
        predicate: 'wrote',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?),?\s+a\s+work\s+(?:by|of)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 2,
        objectGroup: 1,
        confidence: 0.90,
        category: 'authorship',
        examples: ['The Bodhicharyavatara, a work by Shantideva']
      }
    ];
  }

  /**
   * Location Relationship Patterns (21 patterns)
   */
  private getLocationPatterns(): RelationshipPattern[] {
    return [
      // Lived at
      {
        id: 'loc-001',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+lived\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'location',
        examples: ['Milarepa lived at Mount Kailash.']
      },
      {
        id: 'loc-002',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+resided\s+(?:at|in)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'location',
        examples: ['The abbot resided at Sakya Monastery.']
      },
      {
        id: 'loc-003',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+stayed\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'location',
        examples: ['He stayed at the hermitage.']
      },
      {
        id: 'loc-004',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:dwelt|dwelled)\s+(?:at|in)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'location',
        examples: ['The yogi dwelt in a cave.']
      },

      // With duration
      {
        id: 'loc-005',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:lived|resided|stayed)\s+at\s+([A-Z][a-zA-Z\s'-]+)\s+for\s+([\d]+\s+years?)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        durationGroup: 3,
        confidence: 0.92,
        category: 'location',
        examples: ['He lived at the monastery for twenty years.']
      },
      {
        id: 'loc-006',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+spent\s+([\d]+\s+years?)\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        durationGroup: 2,
        confidence: 0.91,
        category: 'location',
        examples: ['He spent twelve years at the retreat center.']
      },

      // Abbot/leadership
      {
        id: 'loc-007',
        predicate: 'abbot_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+(?:the\s+)?abbot\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'location',
        examples: ['Tsongkhapa was the abbot of Ganden.']
      },
      {
        id: 'loc-008',
        predicate: 'abbot_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+served\s+as\s+abbot\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'location',
        examples: ['He served as abbot of the monastery.']
      },

      // Founded
      {
        id: 'loc-009',
        predicate: 'founded',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+founded\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'location',
        examples: ['Khön Könchok Gyalpo founded Sakya Monastery.']
      },
      {
        id: 'loc-010',
        predicate: 'founded',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+established\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'location',
        examples: ['Tsongkhapa established Ganden Monastery.']
      },
      {
        id: 'loc-011',
        predicate: 'founded',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+built\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'location',
        notes: 'Lower confidence as "built" can be literal construction',
        examples: ['The king built the temple.']
      },
      {
        id: 'loc-012',
        predicate: 'founded',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+founded\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'location',
        examples: ['Sakya Monastery was founded by Khön Könchok Gyalpo.']
      },

      // With date
      {
        id: 'loc-013',
        predicate: 'founded',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+founded\s+([A-Z][a-zA-Z\s'-]+)\s+in\s+([\d]{3,4})/gi,
        subjectGroup: 1,
        objectGroup: 2,
        dateGroup: 3,
        confidence: 0.95,
        category: 'location',
        examples: ['He founded the monastery in 1073.']
      },

      // Visited
      {
        id: 'loc-014',
        predicate: 'visited',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+visited\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'location',
        examples: ['Atisha visited Bodhgaya.']
      },
      {
        id: 'loc-015',
        predicate: 'visited',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+traveled\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'location',
        examples: ['Marpa traveled to India.']
      },
      {
        id: 'loc-016',
        predicate: 'visited',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+made\s+(?:a\s+)?pilgrimage\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'location',
        examples: ['He made a pilgrimage to Mount Kailash.']
      },
      {
        id: 'loc-017',
        predicate: 'visited',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+went\s+(?:on\s+pilgrimage\s+)?to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.82,
        category: 'location',
        examples: ['He went to the holy mountain.']
      },

      // Birth/death locations
      {
        id: 'loc-018',
        predicate: 'born_in',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+born\s+(?:in|at)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.94,
        category: 'location',
        examples: ['Tsongkhapa was born in Amdo.']
      },
      {
        id: 'loc-019',
        predicate: 'died_in',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+died\s+(?:in|at)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.94,
        category: 'location',
        examples: ['He died at Ganden Monastery.']
      },

      // Retreat
      {
        id: 'loc-020',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:was\s+)?(?:in\s+)?retreat\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'location',
        examples: ['Milarepa was in retreat at the cave.']
      },
      {
        id: 'loc-021',
        predicate: 'lived_at',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:meditated|practiced)\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.86,
        category: 'location',
        examples: ['He meditated at the hermitage.']
      }
    ];
  }

  /**
   * Text Relationship Patterns (16 patterns)
   */
  private getTextRelationshipPatterns(): RelationshipPattern[] {
    return [
      // Commentary on
      {
        id: 'txt-001',
        predicate: 'commentary_on',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+is\s+a\s+commentary\s+on\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'text-relationship',
        examples: ['The Madhyamakavatara is a commentary on the Mulamadhyamakakarika.']
      },
      {
        id: 'txt-002',
        predicate: 'commentary_on',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?),?\s+a\s+commentary\s+on\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'text-relationship',
        examples: ['The Clear Words, a commentary on the Root Verses']
      },
      {
        id: 'txt-003',
        predicate: 'commentary_on',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:explains|elucidates|expounds)\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'text-relationship',
        examples: ['This text explains the Prajnaparamita.']
      },
      {
        id: 'txt-004',
        predicate: 'commentary_on',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+comments\s+on\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'text-relationship',
        examples: ['This treatise comments on the sutras.']
      },

      // Cites/quotes
      {
        id: 'txt-005',
        predicate: 'cites',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+cites\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'text-relationship',
        examples: ['The Lamrim Chenmo cites many sutras.']
      },
      {
        id: 'txt-006',
        predicate: 'cites',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+quotes\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'text-relationship',
        examples: ['The text quotes the Lotus Sutra.']
      },
      {
        id: 'txt-007',
        predicate: 'cites',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+references\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'text-relationship',
        examples: ['The commentary references earlier works.']
      },
      {
        id: 'txt-008',
        predicate: 'cites',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+mentions\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.82,
        category: 'text-relationship',
        notes: 'Lower confidence as "mentions" is weaker than direct citation',
        examples: ['The biography mentions several texts.']
      },

      // Part of
      {
        id: 'txt-009',
        predicate: 'part_of',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+is\s+part\s+of\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'text-relationship',
        examples: ['The Heart Sutra is part of the Prajnaparamita.']
      },
      {
        id: 'txt-010',
        predicate: 'part_of',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:appears|is included)\s+in\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'text-relationship',
        examples: ['This sutra appears in the Kangyur.']
      },
      {
        id: 'txt-011',
        predicate: 'part_of',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+belongs\s+to\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+collection/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'text-relationship',
        examples: ['This text belongs to the Tengyur collection.']
      },

      // Contains (inverse of part_of)
      {
        id: 'txt-012',
        predicate: 'contains',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+contains\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'text-relationship',
        examples: ['The Kangyur contains many sutras.']
      },
      {
        id: 'txt-013',
        predicate: 'contains',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+includes\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'text-relationship',
        examples: ['The collection includes this treatise.']
      },

      // Based on
      {
        id: 'txt-014',
        predicate: 'cites',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:is\s+)?based\s+on\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.86,
        category: 'text-relationship',
        examples: ['The liturgy is based on the Hevajra Tantra.']
      },
      {
        id: 'txt-015',
        predicate: 'cites',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+draws\s+(?:on|from)\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.84,
        category: 'text-relationship',
        examples: ['The text draws from earlier sources.']
      },

      // Refutes
      {
        id: 'txt-016',
        predicate: 'refuted',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+refutes\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'text-relationship',
        examples: ['The Madhyamaka refutes essentialist views.']
      }
    ];
  }

  /**
   * Event Participation Patterns (15 patterns)
   */
  private getEventPatterns(): RelationshipPattern[] {
    return [
      // Attended
      {
        id: 'evt-001',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+attended\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'event',
        examples: ['Sakya Pandita attended the meeting with Godan Khan.']
      },
      {
        id: 'evt-002',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+participated\s+in\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'event',
        examples: ['Many masters participated in the council.']
      },
      {
        id: 'evt-003',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+present\s+at\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'event',
        examples: ['The abbot was present at the ceremony.']
      },
      {
        id: 'evt-004',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+took\s+part\s+in\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.86,
        category: 'event',
        examples: ['He took part in the debate.']
      },

      // Organized/sponsored
      {
        id: 'evt-005',
        predicate: 'organized',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+organized\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'event',
        examples: ['The king organized a great debate.']
      },
      {
        id: 'evt-006',
        predicate: 'organized',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+convened\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'event',
        examples: ['The emperor convened a council.']
      },
      {
        id: 'evt-007',
        predicate: 'sponsored',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+sponsored\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'event',
        examples: ['The patron sponsored the teaching event.']
      },
      {
        id: 'evt-008',
        predicate: 'sponsored',
        pattern: /(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+was\s+sponsored\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'event',
        examples: ['The festival was sponsored by the king.']
      },

      // Teaching role
      {
        id: 'evt-009',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:gave|delivered)\s+(?:teachings?|a\s+teaching)\s+at\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'event',
        examples: ['The Dalai Lama gave teachings at the Kalachakra ceremony.']
      },
      {
        id: 'evt-010',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+taught\s+at\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'event',
        examples: ['He taught at the summer gathering.']
      },

      // Hosted
      {
        id: 'evt-011',
        predicate: 'organized',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+hosted\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'event',
        examples: ['The monastery hosted the annual festival.']
      },

      // Performed
      {
        id: 'evt-012',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+performed\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:ceremony|ritual)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'event',
        examples: ['The lama performed the empowerment ceremony.']
      },

      // Presided
      {
        id: 'evt-013',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+presided\s+over\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'event',
        examples: ['The abbot presided over the ordination.']
      },

      // Received (empowerment/initiation)
      {
        id: 'evt-014',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+received\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:empowerment|initiation)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'event',
        examples: ['Thousands received the Kalachakra empowerment.']
      },

      // Witnessed
      {
        id: 'evt-015',
        predicate: 'attended',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+witnessed\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.83,
        category: 'event',
        examples: ['He witnessed the historic meeting.']
      }
    ];
  }

  /**
   * Lineage Transmission Patterns (12 patterns)
   */
  private getLineagePatterns(): RelationshipPattern[] {
    return [
      // Received transmission
      {
        id: 'lin-001',
        predicate: 'received_transmission',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+received\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:transmission|lineage)\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.93,
        category: 'lineage',
        bidirectional: true,
        inversePredicate: 'transmitted_to',
        examples: ['Milarepa received the Mahamudra transmission from Marpa.']
      },
      {
        id: 'lin-002',
        predicate: 'received_transmission',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+obtained\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:teachings?|lineage)\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.90,
        category: 'lineage',
        bidirectional: true,
        inversePredicate: 'transmitted_to',
        examples: ['He obtained the Dzogchen teachings from his master.']
      },

      // Transmitted to
      {
        id: 'lin-003',
        predicate: 'transmitted_to',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+transmitted\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.93,
        category: 'lineage',
        bidirectional: true,
        inversePredicate: 'received_transmission',
        examples: ['Marpa transmitted the lineage to Milarepa.']
      },
      {
        id: 'lin-004',
        predicate: 'transmitted_to',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+passed\s+(?:on\s+)?(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.88,
        category: 'lineage',
        bidirectional: true,
        inversePredicate: 'received_transmission',
        examples: ['The master passed on the teachings to his disciples.']
      },

      // Empowerment
      {
        id: 'lin-005',
        predicate: 'gave_empowerment',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+gave\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+empowerment\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.92,
        category: 'lineage',
        examples: ['The lama gave the Hevajra empowerment to his students.']
      },
      {
        id: 'lin-006',
        predicate: 'gave_empowerment',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+bestowed\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+(?:empowerment|initiation)\s+(?:upon|on)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.91,
        category: 'lineage',
        examples: ['He bestowed the initiation upon the assembly.']
      },
      {
        id: 'lin-007',
        predicate: 'gave_empowerment',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+received\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+?)\s+empowerment\s+from\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 3,
        teachingGroup: 2,
        confidence: 0.92,
        category: 'lineage',
        notes: 'Creates gave_empowerment with reversed subject/object',
        examples: ['He received the Chakrasamvara empowerment from the lama.']
      },

      // Incarnation
      {
        id: 'lin-008',
        predicate: 'incarnation_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:is|was)\s+(?:the\s+)?(?:reincarnation|tulku)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'lineage',
        examples: ['The 16th Karmapa is the reincarnation of the 15th Karmapa.']
      },
      {
        id: 'lin-009',
        predicate: 'incarnation_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:is|was)\s+recognized\s+as\s+(?:the\s+)?(?:rebirth|incarnation)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'lineage',
        examples: ['He was recognized as the rebirth of the great master.']
      },
      {
        id: 'lin-010',
        predicate: 'incarnation_of',
        pattern: /([A-Z][a-zA-Z\s'-]+),?\s+the\s+([\d]+)(?:st|nd|rd|th)\s+incarnation/gi,
        subjectGroup: 1,
        objectGroup: 0,
        confidence: 0.88,
        category: 'lineage',
        notes: 'Captures lineage position number',
        examples: ['The 14th Dalai Lama, the 14th incarnation']
      },

      // Lineage holder
      {
        id: 'lin-011',
        predicate: 'received_transmission',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:is|was)\s+(?:a\s+)?lineage\s+holder\s+of\s+(?:the\s+)?([A-Z][a-zA-Z\s'.,:;()-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'lineage',
        examples: ['He was a lineage holder of the Sakya tradition.']
      },

      // Heart son/disciple
      {
        id: 'lin-012',
        predicate: 'student_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:was|is)\s+(?:the\s+)?(?:heart\s+)?(?:son|disciple)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.90,
        category: 'lineage',
        notes: 'Indicates close teacher-student relationship',
        examples: ['Gampopa was the heart son of Milarepa.']
      }
    ];
  }

  /**
   * Institutional Relationship Patterns (10 patterns)
   */
  private getInstitutionalPatterns(): RelationshipPattern[] {
    return [
      // Member of
      {
        id: 'ins-001',
        predicate: 'member_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+a\s+(?:monk|member|resident)\s+(?:at|of)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'institutional',
        examples: ['He was a monk at Sakya Monastery.']
      },
      {
        id: 'ins-002',
        predicate: 'member_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+belonged\s+to\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.85,
        category: 'institutional',
        examples: ['He belonged to the Gelug order.']
      },
      {
        id: 'ins-003',
        predicate: 'member_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+joined\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.87,
        category: 'institutional',
        examples: ['He joined Nalanda monastery.']
      },

      // Patron of
      {
        id: 'ins-004',
        predicate: 'patron_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+(?:a\s+)?patron\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'institutional',
        examples: ['Kublai Khan was a patron of the Sakya tradition.']
      },
      {
        id: 'ins-005',
        predicate: 'patron_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+patronized\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.89,
        category: 'institutional',
        examples: ['The emperor patronized many monasteries.']
      },
      {
        id: 'ins-006',
        predicate: 'patron_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+supported\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.82,
        category: 'institutional',
        notes: 'Lower confidence as "supported" is general',
        examples: ['The king supported Buddhist institutions.']
      },
      {
        id: 'ins-007',
        predicate: 'patron_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+supported\s+by\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'institutional',
        examples: ['The monastery was supported by the royal family.']
      },

      // Served as
      {
        id: 'ins-008',
        predicate: 'member_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+served\s+as\s+(?:a\s+)?(?:teacher|scholar|administrator)\s+at\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.86,
        category: 'institutional',
        examples: ['He served as a teacher at the monastery.']
      },

      // Affiliated with
      {
        id: 'ins-009',
        predicate: 'member_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+affiliated\s+with\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.84,
        category: 'institutional',
        examples: ['The scholar was affiliated with Nalanda.']
      },

      // Associated with
      {
        id: 'ins-010',
        predicate: 'member_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+associated\s+with\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.78,
        category: 'institutional',
        notes: 'Lowest confidence for institutional patterns',
        examples: ['He was associated with the Kagyu school.']
      }
    ];
  }

  /**
   * Family Relationship Patterns (8 patterns)
   */
  private getFamilyPatterns(): RelationshipPattern[] {
    return [
      // Parent-child
      {
        id: 'fam-001',
        predicate: 'parent_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+the\s+(?:father|mother|parent)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.94,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'child_of',
        examples: ['Sachen Kunga Nyingpo was the father of Sönam Tsemo.']
      },
      {
        id: 'fam-002',
        predicate: 'child_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+the\s+(?:son|daughter|child)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.94,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'parent_of',
        examples: ['Sönam Tsemo was the son of Sachen Kunga Nyingpo.']
      },
      {
        id: 'fam-003',
        predicate: 'parent_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)['']s\s+(?:son|daughter|child)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'child_of',
        examples: ["Sachen's son Sönam Tsemo"]
      },

      // Siblings
      {
        id: 'fam-004',
        predicate: 'sibling_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:and|&)\s+([A-Z][a-zA-Z\s'-]+)\s+were\s+(?:brothers|sisters|siblings)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.92,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'sibling_of',
        examples: ['Sönam Tsemo and Jetsün Drakpa Gyaltsen were brothers.']
      },
      {
        id: 'fam-005',
        predicate: 'sibling_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+the\s+(?:brother|sister)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'sibling_of',
        examples: ['Drakpa Gyaltsen was the brother of Sönam Tsemo.']
      },

      // Spouse
      {
        id: 'fam-006',
        predicate: 'spouse_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+(?:married|wed)\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.91,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'spouse_of',
        examples: ['King Trisong Detsen married Queen Tsepongza.']
      },
      {
        id: 'fam-007',
        predicate: 'spouse_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+(?:the\s+)?(?:wife|husband|spouse)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.93,
        category: 'family',
        bidirectional: true,
        inversePredicate: 'spouse_of',
        examples: ['She was the wife of the king.']
      },

      // Nephew/niece/uncle
      {
        id: 'fam-008',
        predicate: 'child_of',
        pattern: /([A-Z][a-zA-Z\s'-]+)\s+was\s+the\s+(?:nephew|niece)\s+of\s+([A-Z][a-zA-Z\s'-]+)/gi,
        subjectGroup: 1,
        objectGroup: 2,
        confidence: 0.88,
        category: 'family',
        notes: 'Creates child_of relationship; could be refined to nephew_of',
        examples: ['Sakya Pandita was the nephew of Jetsün Drakpa Gyaltsen.']
      }
    ];
  }
}

// ============================================================================
// Export
// ============================================================================

export default PatternExtractor;
