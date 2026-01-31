/**
 * Relationship Extraction Service
 *
 * Exports pattern-based relationship extraction for Phase 3 of knowledge graph
 */

export { PatternExtractor, default as default } from './PatternExtractor';
export type {
  RelationshipPattern,
  PatternCategory,
  PatternMatch,
  ResolvedMatch,
  ExtractionStats
} from './PatternExtractor';
