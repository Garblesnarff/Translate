/**
 * Entity Resolution Services
 *
 * Phase 2: Entity Resolution
 *
 * This module provides services for detecting and resolving duplicate entities
 * across documents in the Tibetan Buddhist knowledge graph.
 */

export {
  FuzzyMatcher,
  fuzzyMatcher,
  type SimilarityScore,
  type NameMatch,
  type MatchOptions,
  type MatchType,
  classifySimilarity,
  describeSimilarity,
} from './FuzzyMatcher';

// Phase 2.2 - Duplicate Detection Service ✅
export {
  DuplicateDetector,
  duplicateDetector,
  type DuplicatePair,
  type DuplicateScore,
  type SignalScores,
  type ConfidenceLevel,
} from './DuplicateDetector';

// Phase 2.3 - Entity Merger Service ✅
export {
  EntityMerger,
  entityMerger,
  type MergeOptions,
  type MergeResult,
  type MergePreview,
  type Conflict,
  type ConflictResolution,
  type CombinedEntity,
  type MergeHistory,
} from './EntityMerger';

// TODO: Phase 2.4 - Review Queue Service
// export { ReviewQueue } from './ReviewQueue';
