/**
 * Duplicate Entity Detection Service
 *
 * Multi-signal duplicate detection system for identifying potential duplicate entities
 * across documents using name similarity, date overlap, location overlap, relationship
 * overlap, and attribute similarity.
 *
 * Phase 2.2: Entity Resolution - Duplicate Detection
 *
 * @algorithm Multi-Signal Scoring
 * - Name similarity: 50% weight (via FuzzyMatcher)
 * - Date overlap: 20% weight (birth/death date comparison)
 * - Location overlap: 15% weight (lived_at, founded_at relationships)
 * - Relationship overlap: 10% weight (shared teachers, students, etc.)
 * - Attribute similarity: 5% weight (roles, traditions, titles)
 *
 * @algorithm Clustering - Transitive Closure
 * - If A=B and B=C, then A=C
 * - Groups entities that are likely the same person/place
 * - Handles multi-way merges
 *
 * @confidence_thresholds
 * - 0.90+: Very high confidence (auto-merge candidate)
 * - 0.80-0.90: High confidence (human review recommended)
 * - 0.70-0.80: Medium confidence (curator decision needed)
 * - <0.70: Low confidence (probably different entities)
 *
 * @example
 * const detector = new DuplicateDetector(fuzzyMatcher);
 * const duplicates = await detector.findDuplicates(entity, candidatePool);
 * // Returns: [{entity1, entity2, score: 0.92, signals: {...}}]
 *
 * @see /roadmaps/knowledge-graph/PHASES_SUMMARY.md (Phase 2, lines 18-23)
 */

import { FuzzyMatcher, type SimilarityScore } from './FuzzyMatcher';
import type {
  Entity,
  PersonEntity,
  PlaceEntity,
  DateInfo,
  Relationship,
} from '../../types/entities';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Confidence level for duplicate detection
 */
export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low';

/**
 * Individual signal scores for duplicate detection
 */
export interface SignalScores {
  /** Name similarity score (0.0-1.0) from FuzzyMatcher */
  nameSimilarity: number;

  /** Date overlap score (0.0-1.0) - birth/death/founded dates */
  dateSimilarity: number;

  /** Location overlap score (0.0-1.0) - shared locations */
  locationSimilarity: number;

  /** Relationship overlap score (0.0-1.0) - shared connections */
  relationshipSimilarity: number;

  /** Attribute similarity score (0.0-1.0) - roles, traditions, etc. */
  attributeSimilarity: number;
}

/**
 * Detailed duplicate score with signal breakdown
 */
export interface DuplicateScore {
  /** Overall similarity score (0.0-1.0) */
  overall: number;

  /** Confidence level classification */
  confidenceLevel: ConfidenceLevel;

  /** Individual signal scores */
  signals: SignalScores;

  /** Weighted components showing contribution to overall score */
  weights: {
    name: number;
    date: number;
    location: number;
    relationship: number;
    attribute: number;
  };

  /** Human-readable explanation */
  reason: string;

  /** Warning flags for edge cases */
  warnings: string[];
}

/**
 * A pair of potentially duplicate entities
 */
export interface DuplicatePair {
  /** First entity */
  entity1: Entity;

  /** Second entity */
  entity2: Entity;

  /** Similarity score details */
  score: DuplicateScore;

  /** Recommended action */
  recommendation: 'auto_merge' | 'review' | 'manual_decision' | 'probably_different';

  /** Detection timestamp */
  detectedAt: Date;
}

/**
 * A cluster of related entities that may be duplicates
 */
export interface EntityCluster {
  /** Cluster ID */
  id: string;

  /** All entities in this cluster */
  entities: Entity[];

  /** Average similarity score within cluster */
  avgSimilarity: number;

  /** Connections between entities in cluster */
  connections: Array<{
    entity1Id: string;
    entity2Id: string;
    similarity: number;
  }>;

  /** Suggested canonical entity (highest confidence) */
  suggestedCanonical?: Entity;
}

/**
 * A duplicate group with merge candidate
 */
export interface DuplicateGroup {
  /** Cluster information */
  cluster: EntityCluster;

  /** All duplicate pairs in this group */
  pairs: DuplicatePair[];

  /** Recommended merge strategy */
  mergeStrategy: 'single_canonical' | 'manual_review' | 'no_merge';

  /** Confidence in this grouping */
  groupConfidence: number;
}

/**
 * Options for duplicate detection
 */
export interface DetectionOptions {
  /** Minimum overall score to consider (default: 0.70) */
  threshold?: number;

  /** Maximum results to return */
  limit?: number;

  /** Only compare within same entity type (default: true) */
  sameTypeOnly?: boolean;

  /** Include low-confidence matches for exploration */
  includeAllMatches?: boolean;

  /** Use strict date matching (must have overlapping lifespans) */
  strictDateMatching?: boolean;

  /** Minimum name similarity to even consider (default: 0.60) */
  minNameSimilarity?: number;
}

// ============================================================================
// Scoring Weights Configuration
// ============================================================================

/**
 * Signal weights for overall score calculation
 * Must sum to 1.0
 */
const SIGNAL_WEIGHTS = {
  name: 0.50,        // Name similarity is primary signal
  date: 0.20,        // Date overlap is secondary
  location: 0.15,    // Location overlap is tertiary
  relationship: 0.10, // Shared relationships help
  attribute: 0.05,   // Attributes provide minor signal
} as const;

/**
 * Confidence thresholds for classification
 */
const CONFIDENCE_THRESHOLDS = {
  very_high: 0.90,  // Auto-merge candidate
  high: 0.80,       // Human review recommended
  medium: 0.70,     // Curator decision needed
  low: 0.0,         // Probably different entities
} as const;

// ============================================================================
// Duplicate Detector Service
// ============================================================================

/**
 * Duplicate entity detection service
 *
 * Finds potential duplicate entities across documents using multiple signals.
 * Combines name matching, date overlap, location overlap, relationship overlap,
 * and attribute similarity for robust duplicate detection.
 */
export class DuplicateDetector {
  private fuzzyMatcher: FuzzyMatcher;

  constructor(fuzzyMatcher: FuzzyMatcher) {
    this.fuzzyMatcher = fuzzyMatcher;
  }

  /**
   * Find duplicate candidates for a single entity
   *
   * Compares the target entity against a pool of candidates using all
   * available signals. Returns matches sorted by similarity score.
   *
   * @param entity - Target entity to find duplicates for
   * @param candidatePool - Pool of potential duplicate candidates
   * @param options - Detection options
   * @returns Array of duplicate pairs sorted by score (highest first)
   *
   * @example
   * const duplicates = detector.findDuplicates(
   *   marpaEntity,
   *   allPersonEntities,
   *   { threshold: 0.85, limit: 10 }
   * );
   */
  async findDuplicates(
    entity: Entity,
    candidatePool: Entity[],
    options: DetectionOptions = {}
  ): Promise<DuplicatePair[]> {
    const {
      threshold = 0.70,
      limit,
      sameTypeOnly = true,
      includeAllMatches = false,
      minNameSimilarity = 0.60,
    } = options;

    const duplicates: DuplicatePair[] = [];

    // Filter candidates by type if requested
    const candidates = sameTypeOnly
      ? candidatePool.filter(c => c.type === entity.type && c.id !== entity.id)
      : candidatePool.filter(c => c.id !== entity.id);

    for (const candidate of candidates) {
      // Calculate duplicate score
      const score = this.calculateDuplicateProbability(entity, candidate, options);

      // Apply threshold filters
      const meetsThreshold = includeAllMatches || score.overall >= threshold;
      const meetsNameThreshold = score.signals.nameSimilarity >= minNameSimilarity;

      if (meetsThreshold && meetsNameThreshold) {
        // Determine recommendation based on confidence level
        let recommendation: DuplicatePair['recommendation'];
        if (score.confidenceLevel === 'very_high') {
          recommendation = 'auto_merge';
        } else if (score.confidenceLevel === 'high') {
          recommendation = 'review';
        } else if (score.confidenceLevel === 'medium') {
          recommendation = 'manual_decision';
        } else {
          recommendation = 'probably_different';
        }

        duplicates.push({
          entity1: entity,
          entity2: candidate,
          score,
          recommendation,
          detectedAt: new Date(),
        });
      }
    }

    // Sort by overall score (highest first)
    duplicates.sort((a, b) => b.score.overall - a.score.overall);

    // Apply limit if specified
    return limit ? duplicates.slice(0, limit) : duplicates;
  }

  /**
   * Detect all duplicates across a full entity set
   *
   * Performs pairwise comparison of all entities and groups duplicates
   * into clusters using transitive closure.
   *
   * @param entities - All entities to check for duplicates
   * @param options - Detection options
   * @returns Array of duplicate groups
   *
   * @example
   * const groups = await detector.detectAllDuplicates(allEntities);
   * // Returns: [{ cluster: {...}, pairs: [...], mergeStrategy: '...' }]
   */
  async detectAllDuplicates(
    entities: Entity[],
    options: DetectionOptions = {}
  ): Promise<DuplicateGroup[]> {
    const {
      threshold = 0.70,
      sameTypeOnly = true,
    } = options;

    // Find all duplicate pairs
    const allPairs: DuplicatePair[] = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      // Compare against remaining entities to avoid duplicate comparisons
      const candidatePool = entities.slice(i + 1);

      const pairs = await this.findDuplicates(entity, candidatePool, {
        ...options,
        limit: undefined, // Get all matches for clustering
      });

      allPairs.push(...pairs);
    }

    // Cluster similar entities using transitive closure
    const clusters = this.clusterSimilarEntities(entities, allPairs);

    // Convert clusters to duplicate groups
    const groups: DuplicateGroup[] = clusters.map(cluster => {
      // Get all pairs involving entities in this cluster
      const clusterEntityIds = new Set(cluster.entities.map(e => e.id));
      const clusterPairs = allPairs.filter(
        pair =>
          clusterEntityIds.has(pair.entity1.id) &&
          clusterEntityIds.has(pair.entity2.id)
      );

      // Determine merge strategy
      let mergeStrategy: DuplicateGroup['mergeStrategy'];
      const hasVeryHighConfidence = clusterPairs.some(
        p => p.score.confidenceLevel === 'very_high'
      );
      const hasHighConfidence = clusterPairs.some(
        p => p.score.confidenceLevel === 'high'
      );

      if (hasVeryHighConfidence && cluster.entities.length === 2) {
        mergeStrategy = 'single_canonical';
      } else if (hasHighConfidence) {
        mergeStrategy = 'manual_review';
      } else {
        mergeStrategy = 'no_merge';
      }

      return {
        cluster,
        pairs: clusterPairs,
        mergeStrategy,
        groupConfidence: cluster.avgSimilarity,
      };
    });

    // Sort groups by confidence (highest first)
    groups.sort((a, b) => b.groupConfidence - a.groupConfidence);

    return groups;
  }

  /**
   * Calculate duplicate probability between two entities
   *
   * Combines all signals using a normalized weighted scoring formula.
   * Signals with no data (returning 0.5) are given less weight to prevent
   * them from diluting strong signals like name matches.
   */
  calculateDuplicateProbability(
    entity1: Entity,
    entity2: Entity,
    options: DetectionOptions = {}
  ): DuplicateScore {
    const signals = this.scoreBySignal(entity1, entity2, options);
    const warnings: string[] = [];

    // Calculate weighted overall score using normalized weights
    // If a signal is "neutral" (0.5), we reduce its influence if other signals are strong
    let weightedSum = 0;
    let weightTotal = 0;

    // Name is always included
    weightedSum += signals.nameSimilarity * SIGNAL_WEIGHTS.name;
    weightTotal += SIGNAL_WEIGHTS.name;

    // For other signals, if they are neutral (0.5), they contribute less to the total 
    // weight if we have a strong name match, to avoid dilution.
    const otherSignals: Array<[keyof typeof SIGNAL_WEIGHTS, number]> = [
      ['date', signals.dateSimilarity],
      ['location', signals.locationSimilarity],
      ['relationship', signals.relationshipSimilarity],
      ['attribute', signals.attributeSimilarity]
    ];

    for (const [key, score] of otherSignals) {
      const weight = SIGNAL_WEIGHTS[key];
      
      // If signal has actual data (not 0.5), or if we want to include it anyway
      if (score !== 0.5) {
        weightedSum += score * weight;
        weightTotal += weight;
      } else {
        // Neutral signal - we include it with half weight to provide some "gravity" 
        // towards the center, but allow strong matches to shine through.
        weightedSum += score * (weight * 0.5);
        weightTotal += (weight * 0.5);
      }
    }

    const overall = weightedSum / weightTotal;

    // Special case: Exact name match with no conflicting data should be very high
    let finalScore = overall;
    if (signals.nameSimilarity > 0.98 && overall < 0.9) {
      const hasConflicts = signals.dateSimilarity < 0.3 || signals.locationSimilarity < 0.3;
      if (!hasConflicts) {
        finalScore = Math.max(finalScore, 0.92); // Boost to "High" confidence
      }
    }

    // Determine confidence level
    let confidenceLevel: ConfidenceLevel;
    if (finalScore >= CONFIDENCE_THRESHOLDS.very_high) {
      confidenceLevel = 'very_high';
    } else if (finalScore >= CONFIDENCE_THRESHOLDS.high) {
      confidenceLevel = 'high';
    } else if (finalScore >= CONFIDENCE_THRESHOLDS.medium) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    // Generate explanation
    const reason = this.generateDuplicateReason(signals, finalScore, confidenceLevel);

    // Check for edge cases and add warnings
    this.detectEdgeCases(entity1, entity2, signals, warnings);

    // Calculate actual weighted contributions for reporting
    const weights = {
      name: (signals.nameSimilarity * SIGNAL_WEIGHTS.name) / weightTotal,
      date: (signals.dateSimilarity * SIGNAL_WEIGHTS.date) / weightTotal,
      location: (signals.locationSimilarity * SIGNAL_WEIGHTS.location) / weightTotal,
      relationship: (signals.relationshipSimilarity * SIGNAL_WEIGHTS.relationship) / weightTotal,
      attribute: (signals.attributeSimilarity * SIGNAL_WEIGHTS.attribute) / weightTotal,
    };

    return {
      overall: finalScore,
      confidenceLevel,
      signals,
      weights,
      reason,
      warnings,
    };
  }

  /**
   * Calculate individual signal scores
   *
   * Computes each signal independently: name, date, location, relationship, attribute.
   *
   * @param entity1 - First entity
   * @param entity2 - Second entity
   * @param options - Detection options
   * @returns Individual signal scores
   */
  scoreBySignal(
    entity1: Entity,
    entity2: Entity,
    options: DetectionOptions = {}
  ): SignalScores {
    return {
      nameSimilarity: this.calculateNameSimilarity(entity1, entity2),
      dateSimilarity: this.calculateDateSimilarity(entity1, entity2, options),
      locationSimilarity: this.calculateLocationSimilarity(entity1, entity2),
      relationshipSimilarity: this.calculateRelationshipSimilarity(entity1, entity2),
      attributeSimilarity: this.calculateAttributeSimilarity(entity1, entity2),
    };
  }

  /**
   * Cluster similar entities using transitive closure
   *
   * Groups entities into clusters where if A=B and B=C, then A=C.
   * Handles multi-way merges and creates connected components.
   *
   * @param entities - All entities
   * @param pairs - All duplicate pairs found
   * @returns Array of entity clusters
   *
   * @algorithm Union-Find (Disjoint Set Union)
   * - Each entity starts in its own set
   * - Pairs are merged based on similarity threshold
   * - Transitive closure groups all connected entities
   */
  clusterSimilarEntities(
    entities: Entity[],
    pairs: DuplicatePair[]
  ): EntityCluster[] {
    // Build adjacency map for clustering
    const adjacency = new Map<string, Set<string>>();
    const entityMap = new Map<string, Entity>();

    // Initialize maps
    entities.forEach(entity => {
      adjacency.set(entity.id, new Set());
      entityMap.set(entity.id, entity);
    });

    // Build connections from pairs (only medium+ confidence)
    pairs.forEach(pair => {
      if (pair.score.confidenceLevel !== 'low') {
        adjacency.get(pair.entity1.id)?.add(pair.entity2.id);
        adjacency.get(pair.entity2.id)?.add(pair.entity1.id);
      }
    });

    // Find connected components using DFS
    const visited = new Set<string>();
    const clusters: EntityCluster[] = [];

    function dfs(entityId: string, currentCluster: Set<string>) {
      if (visited.has(entityId)) return;
      visited.add(entityId);
      currentCluster.add(entityId);

      const neighbors = adjacency.get(entityId) || new Set();
      neighbors.forEach(neighborId => {
        dfs(neighborId, currentCluster);
      });
    }

    // Create clusters from connected components
    entities.forEach(entity => {
      if (!visited.has(entity.id)) {
        const clusterEntityIds = new Set<string>();
        dfs(entity.id, clusterEntityIds);

        // Only create cluster if it has multiple entities
        if (clusterEntityIds.size > 1) {
          const clusterEntities = Array.from(clusterEntityIds)
            .map(id => entityMap.get(id)!)
            .filter(e => e !== undefined);

          // Get connections within this cluster
          const connections: EntityCluster['connections'] = [];
          const clusterIdSet = new Set(clusterEntityIds);

          pairs.forEach(pair => {
            if (
              clusterIdSet.has(pair.entity1.id) &&
              clusterIdSet.has(pair.entity2.id)
            ) {
              connections.push({
                entity1Id: pair.entity1.id,
                entity2Id: pair.entity2.id,
                similarity: pair.score.overall,
              });
            }
          });

          // Calculate average similarity
          const avgSimilarity =
            connections.length > 0
              ? connections.reduce((sum, conn) => sum + conn.similarity, 0) /
                connections.length
              : 0;

          // Suggest canonical entity (highest confidence score)
          const suggestedCanonical = clusterEntities.reduce((best, current) =>
            current.confidence > best.confidence ? current : best
          );

          clusters.push({
            id: `cluster_${clusters.length + 1}`,
            entities: clusterEntities,
            avgSimilarity,
            connections,
            suggestedCanonical,
          });
        }
      }
    });

    return clusters;
  }

  // ============================================================================
  // Private Helper Methods - Individual Signal Calculations
  // ============================================================================

  /**
   * Calculate name similarity using FuzzyMatcher
   */
  private calculateNameSimilarity(entity1: Entity, entity2: Entity): number {
    const fuzzyScore = this.fuzzyMatcher.compareEntities(entity1, entity2);
    return fuzzyScore.score;
  }

  /**
   * Calculate date overlap similarity
   *
   * Compares birth/death dates for people, founded/dissolved for places, etc.
   * Handles different precision levels and missing dates.
   *
   * @returns 0.0-1.0 score (1.0 = perfect overlap, 0.0 = no overlap/conflict)
   */
  private calculateDateSimilarity(
    entity1: Entity,
    entity2: Entity,
    options: DetectionOptions = {}
  ): number {
    const { strictDateMatching = false } = options;

    // If no dates on either entity, return neutral score
    if (!entity1.dates || !entity2.dates) {
      return 0.5; // Neutral - can't confirm or deny
    }

    // Extract relevant date pairs based on entity type
    const datePairs = this.extractRelevantDatePairs(entity1, entity2);

    if (datePairs.length === 0) {
      return 0.5; // No comparable dates
    }

    // Calculate similarity for each date pair
    const similarities = datePairs.map(([date1, date2]) =>
      this.compareDates(date1, date2, strictDateMatching)
    );

    // Return average similarity across all date pairs
    return similarities.reduce((sum, score) => sum + score, 0) / similarities.length;
  }

  /**
   * Extract relevant date pairs for comparison based on entity type
   */
  private extractRelevantDatePairs(
    entity1: Entity,
    entity2: Entity
  ): Array<[DateInfo | undefined, DateInfo | undefined]> {
    const pairs: Array<[DateInfo | undefined, DateInfo | undefined]> = [];

    if (entity1.type === 'person' && entity2.type === 'person') {
      const e1 = entity1 as PersonEntity;
      const e2 = entity2 as PersonEntity;

      if (e1.dates?.birth && e2.dates?.birth) {
        pairs.push([e1.dates.birth, e2.dates.birth]);
      }
      if (e1.dates?.death && e2.dates?.death) {
        pairs.push([e1.dates.death, e2.dates.death]);
      }
    } else if (entity1.type === 'place' && entity2.type === 'place') {
      const e1 = entity1 as PlaceEntity;
      const e2 = entity2 as PlaceEntity;

      if (e1.dates?.founded && e2.dates?.founded) {
        pairs.push([e1.dates.founded, e2.dates.founded]);
      }
    }
    // Add more entity types as needed

    return pairs;
  }

  /**
   * Compare two DateInfo objects
   *
   * @returns 0.0-1.0 score (1.0 = same date, 0.0 = definitely different)
   */
  private compareDates(
    date1: DateInfo | undefined,
    date2: DateInfo | undefined,
    strict: boolean
  ): number {
    if (!date1 || !date2) return 0.5;

    // If both have exact years
    if (date1.year && date2.year) {
      const yearDiff = Math.abs(date1.year - date2.year);

      // Exact match
      if (yearDiff === 0) return 1.0;

      // Close match (within 5 years) - could be same person with date uncertainty
      if (yearDiff <= 5 && !strict) return 0.85;

      // Reasonable match (within 10 years) - possible with approximate dates
      if (yearDiff <= 10 && !strict) return 0.7;

      // Far apart (within 20 years) - unlikely but possible
      if (yearDiff <= 20 && !strict) return 0.5;

      // Very far apart - probably different entities
      return 0.0;
    }

    // If we only have Tibetan dates
    if (date1.tibetanYear && date2.tibetanYear) {
      const rabjungDiff = Math.abs(
        date1.tibetanYear.rabjung - date2.tibetanYear.rabjung
      );
      const yearDiff = Math.abs(date1.tibetanYear.year - date2.tibetanYear.year);

      // Same rabjung and year
      if (rabjungDiff === 0 && yearDiff === 0) return 1.0;

      // Same rabjung, close year
      if (rabjungDiff === 0 && yearDiff <= 5) return 0.85;

      // Different rabjung - likely different entities
      if (rabjungDiff >= 1) return 0.0;
    }

    // Only have precision/confidence information
    if (date1.precision === 'unknown' || date2.precision === 'unknown') {
      return 0.5; // Can't determine
    }

    // Default: some uncertainty
    return 0.6;
  }

  /**
   * Calculate location overlap similarity
   *
   * Checks for shared locations in lived_at, born_in, died_in relationships.
   * Requires access to relationship data.
   *
   * @returns 0.0-1.0 score based on location overlap
   */
  private calculateLocationSimilarity(entity1: Entity, entity2: Entity): number {
    // For person entities, check location attributes
    if (entity1.type === 'person' && entity2.type === 'person') {
      const e1 = entity1 as PersonEntity;
      const e2 = entity2 as PersonEntity;

      // Check affiliations (monastery names, etc.)
      const affiliations1 = new Set(e1.attributes.affiliations || []);
      const affiliations2 = new Set(e2.attributes.affiliations || []);

      if (affiliations1.size === 0 && affiliations2.size === 0) {
        return 0.5; // No data
      }

      const overlap = new Set(
        Array.from(affiliations1).filter(a => affiliations2.has(a))
      );

      const union = new Set([...Array.from(affiliations1), ...Array.from(affiliations2)]);

      // Jaccard similarity
      return union.size > 0 ? overlap.size / union.size : 0.0;
    }

    // For place entities, check parent hierarchy
    if (entity1.type === 'place' && entity2.type === 'place') {
      const e1 = entity1 as PlaceEntity;
      const e2 = entity2 as PlaceEntity;

      // Same region is a strong signal
      if (e1.attributes.region && e2.attributes.region) {
        if (e1.attributes.region === e2.attributes.region) {
          return 0.8;
        }
      }

      // Same modern country is weaker signal
      if (e1.attributes.modernCountry && e2.attributes.modernCountry) {
        if (e1.attributes.modernCountry === e2.attributes.modernCountry) {
          return 0.6;
        }
      }
    }

    return 0.5; // Default neutral
  }

  /**
   * Calculate relationship overlap similarity
   *
   * Checks for shared teachers, students, or other relationships.
   * This requires relationship data to be passed in or queried.
   *
   * @returns 0.0-1.0 score based on relationship overlap
   */
  private calculateRelationshipSimilarity(entity1: Entity, entity2: Entity): number {
    // This is a placeholder - actual implementation would need to:
    // 1. Query relationships table for both entities
    // 2. Compare shared teachers/students/etc.
    // 3. Calculate Jaccard similarity of relationship sets

    // For now, return neutral score
    // TODO: Implement relationship comparison when relationship data is available
    return 0.5;
  }

  /**
   * Calculate attribute similarity
   *
   * Compares roles, traditions, titles, and other entity-specific attributes.
   *
   * @returns 0.0-1.0 score based on attribute overlap
   */
  private calculateAttributeSimilarity(entity1: Entity, entity2: Entity): number {
    // Type-specific attribute comparison
    if (entity1.type === 'person' && entity2.type === 'person') {
      return this.comparePersonAttributes(
        entity1 as PersonEntity,
        entity2 as PersonEntity
      );
    }

    if (entity1.type === 'place' && entity2.type === 'place') {
      return this.comparePlaceAttributes(
        entity1 as PlaceEntity,
        entity2 as PlaceEntity
      );
    }

    // Default for other types
    return 0.5;
  }

  /**
   * Compare person-specific attributes
   */
  private comparePersonAttributes(person1: PersonEntity, person2: PersonEntity): number {
    let totalScore = 0;
    let factors = 0;

    // Compare gender (strong signal if both known)
    if (person1.attributes.gender && person2.attributes.gender) {
      totalScore += person1.attributes.gender === person2.attributes.gender ? 1.0 : 0.0;
      factors++;
    }

    // Compare traditions (Jaccard similarity)
    const traditions1 = new Set(person1.attributes.tradition || []);
    const traditions2 = new Set(person2.attributes.tradition || []);

    if (traditions1.size > 0 || traditions2.size > 0) {
      const overlap = new Set(Array.from(traditions1).filter(t => traditions2.has(t)));
      const union = new Set([...Array.from(traditions1), ...Array.from(traditions2)]);
      totalScore += union.size > 0 ? overlap.size / union.size : 0;
      factors++;
    }

    // Compare roles
    const roles1 = new Set(person1.attributes.roles || []);
    const roles2 = new Set(person2.attributes.roles || []);

    if (roles1.size > 0 || roles2.size > 0) {
      const overlap = new Set(Array.from(roles1).filter(r => roles2.has(r)));
      const union = new Set([...Array.from(roles1), ...Array.from(roles2)]);
      totalScore += union.size > 0 ? overlap.size / union.size : 0;
      factors++;
    }

    return factors > 0 ? totalScore / factors : 0.5;
  }

  /**
   * Compare place-specific attributes
   */
  private comparePlaceAttributes(place1: PlaceEntity, place2: PlaceEntity): number {
    let totalScore = 0;
    let factors = 0;

    // Compare place type (strong signal)
    if (place1.attributes.placeType && place2.attributes.placeType) {
      totalScore += place1.attributes.placeType === place2.attributes.placeType ? 1.0 : 0.0;
      factors++;
    }

    // Compare region
    if (place1.attributes.region && place2.attributes.region) {
      totalScore += place1.attributes.region === place2.attributes.region ? 1.0 : 0.0;
      factors++;
    }

    return factors > 0 ? totalScore / factors : 0.5;
  }

  // ============================================================================
  // Edge Case Detection
  // ============================================================================

  /**
   * Detect edge cases that might affect duplicate detection
   *
   * Adds warnings for:
   * - Same name, different time periods (reincarnations)
   * - Same name, different locations (homonyms)
   * - Incomplete data (missing birth dates)
   */
  private detectEdgeCases(
    entity1: Entity,
    entity2: Entity,
    signals: SignalScores,
    warnings: string[]
  ): void {
    // High name similarity but low date similarity = possible reincarnation
    if (
      signals.nameSimilarity > 0.85 &&
      signals.dateSimilarity < 0.3 &&
      entity1.type === 'person'
    ) {
      warnings.push(
        'High name similarity but different time periods - may be reincarnation lineage'
      );
    }

    // High name similarity but different locations = possible homonym
    if (
      signals.nameSimilarity > 0.85 &&
      signals.locationSimilarity < 0.3 &&
      signals.locationSimilarity !== 0.5 // 0.5 means no data
    ) {
      warnings.push(
        'High name similarity but different locations - may be different people with same name'
      );
    }

    // Missing date information
    if (signals.dateSimilarity === 0.5 && entity1.type === 'person') {
      warnings.push('Missing birth/death date information - cannot verify time period');
    }

    // Missing location information
    if (signals.locationSimilarity === 0.5) {
      warnings.push('Missing location information - cannot verify geographic context');
    }

    // Very high confidence but low verified status
    if (signals.nameSimilarity > 0.95 && !entity1.verified && !entity2.verified) {
      warnings.push('High confidence match but neither entity is verified');
    }
  }

  /**
   * Generate human-readable explanation for duplicate score
   */
  private generateDuplicateReason(
    signals: SignalScores,
    overall: number,
    confidenceLevel: ConfidenceLevel
  ): string {
    const parts: string[] = [];

    // Name similarity contribution
    if (signals.nameSimilarity >= 0.95) {
      parts.push('very similar names');
    } else if (signals.nameSimilarity >= 0.85) {
      parts.push('similar names');
    } else if (signals.nameSimilarity >= 0.70) {
      parts.push('moderately similar names');
    }

    // Date contribution
    if (signals.dateSimilarity >= 0.85 && signals.dateSimilarity !== 0.5) {
      parts.push('matching time periods');
    } else if (signals.dateSimilarity < 0.3 && signals.dateSimilarity !== 0.5) {
      parts.push('different time periods');
    }

    // Location contribution
    if (signals.locationSimilarity >= 0.7 && signals.locationSimilarity !== 0.5) {
      parts.push('shared locations');
    }

    // Relationship contribution
    if (signals.relationshipSimilarity >= 0.7 && signals.relationshipSimilarity !== 0.5) {
      parts.push('shared relationships');
    }

    // Attribute contribution
    if (signals.attributeSimilarity >= 0.7) {
      parts.push('similar attributes');
    }

    const reason = parts.length > 0 ? parts.join(', ') : 'based on available data';

    // Add confidence description
    const confidenceDesc = {
      very_high: 'Very likely the same entity',
      high: 'Likely the same entity',
      medium: 'Possibly the same entity',
      low: 'Probably different entities',
    }[confidenceLevel];

    return `${confidenceDesc} (${reason})`;
  }

  /**
   * Get confidence level from score
   *
   * Helper method to classify scores into confidence levels.
   */
  getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= CONFIDENCE_THRESHOLDS.very_high) return 'very_high';
    if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
    if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  /**
   * Get recommended threshold for different use cases
   */
  getRecommendedThreshold(
    useCase: 'auto_merge' | 'review_queue' | 'exploration'
  ): number {
    switch (useCase) {
      case 'auto_merge':
        return CONFIDENCE_THRESHOLDS.very_high; // 0.90
      case 'review_queue':
        return CONFIDENCE_THRESHOLDS.high; // 0.80
      case 'exploration':
        return CONFIDENCE_THRESHOLDS.medium; // 0.70
      default:
        return CONFIDENCE_THRESHOLDS.high;
    }
  }
}

// Export singleton instance for convenience
export const duplicateDetector = new DuplicateDetector(
  new FuzzyMatcher()
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format duplicate score for display
 */
export function formatDuplicateScore(score: DuplicateScore): string {
  const lines = [
    `Overall: ${(score.overall * 100).toFixed(1)}% (${score.confidenceLevel})`,
    `Name: ${(score.signals.nameSimilarity * 100).toFixed(1)}%`,
    `Date: ${(score.signals.dateSimilarity * 100).toFixed(1)}%`,
    `Location: ${(score.signals.locationSimilarity * 100).toFixed(1)}%`,
    `Relationships: ${(score.signals.relationshipSimilarity * 100).toFixed(1)}%`,
    `Attributes: ${(score.signals.attributeSimilarity * 100).toFixed(1)}%`,
  ];

  if (score.warnings.length > 0) {
    lines.push('', 'Warnings:');
    score.warnings.forEach(w => lines.push(`  - ${w}`));
  }

  return lines.join('\n');
}

/**
 * Convert DuplicatePair to database record format
 */
export function duplicatePairToDbRecord(pair: DuplicatePair): {
  entity1Id: string;
  entity2Id: string;
  similarityScore: string;
  nameSimilarity: string;
  dateSimilarity: string;
  locationSimilarity: string;
  relationshipSimilarity: string;
  attributeSimilarity: string;
  confidenceLevel: ConfidenceLevel;
  detectedAt: Date;
} {
  return {
    entity1Id: pair.entity1.id,
    entity2Id: pair.entity2.id,
    similarityScore: pair.score.overall.toString(),
    nameSimilarity: pair.score.signals.nameSimilarity.toString(),
    dateSimilarity: pair.score.signals.dateSimilarity.toString(),
    locationSimilarity: pair.score.signals.locationSimilarity.toString(),
    relationshipSimilarity: pair.score.signals.relationshipSimilarity.toString(),
    attributeSimilarity: pair.score.signals.attributeSimilarity.toString(),
    confidenceLevel: pair.score.confidenceLevel,
    detectedAt: pair.detectedAt,
  };
}
