/**
 * Duplicate Detector Tests
 *
 * Comprehensive test suite for the DuplicateDetector service.
 * Tests multi-signal duplicate detection, clustering, and edge cases.
 *
 * Phase 2.2: Entity Resolution
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DuplicateDetector, duplicatePairToDbRecord } from '../DuplicateDetector';
import { FuzzyMatcher } from '../FuzzyMatcher';
import type { PersonEntity, PlaceEntity, Entity } from '../../../types/entities';

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;
  let fuzzyMatcher: FuzzyMatcher;

  beforeEach(() => {
    fuzzyMatcher = new FuzzyMatcher();
    detector = new DuplicateDetector(fuzzyMatcher);
  });

  // ============================================================================
  // Test Data Factories
  // ============================================================================

  const createPersonEntity = (overrides: Partial<PersonEntity>): PersonEntity => ({
    id: 'person_test_001',
    type: 'person',
    canonicalName: 'Test Person',
    names: {
      tibetan: [],
      english: ['Test Person'],
      phonetic: [],
      wylie: [],
    },
    attributes: {},
    confidence: 0.8,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
    ...overrides,
  });

  const createPlaceEntity = (overrides: Partial<PlaceEntity>): PlaceEntity => ({
    id: 'place_test_001',
    type: 'place',
    canonicalName: 'Test Place',
    names: {
      tibetan: [],
      english: ['Test Place'],
      phonetic: [],
      wylie: [],
    },
    attributes: {
      placeType: 'monastery',
    },
    confidence: 0.8,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
    ...overrides,
  });

  // ============================================================================
  // Signal Calculation Tests
  // ============================================================================

  describe('scoreBySignal', () => {
    it('should calculate name similarity correctly', () => {
      const marpa1 = createPersonEntity({
        id: 'person_001',
        canonicalName: 'Marpa Lotsawa',
        names: {
          tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
          english: ['Marpa the Translator'],
          phonetic: ['Marpa Lotsawa'],
          wylie: ['mar pa lo tsA ba'],
        },
      });

      const marpa2 = createPersonEntity({
        id: 'person_002',
        canonicalName: 'Marpa',
        names: {
          tibetan: ['མར་པ།'],
          english: ['Marpa'],
          phonetic: ['Marpa'],
          wylie: ['mar pa'],
        },
      });

      const signals = detector.scoreBySignal(marpa1, marpa2);

      expect(signals.nameSimilarity).toBeGreaterThan(0.85);
      expect(signals.nameSimilarity).toBeLessThanOrEqual(1.0);
    });

    it('should calculate date similarity for matching birth years', () => {
      const person1 = createPersonEntity({
        id: 'person_001',
        dates: {
          birth: { year: 1012, precision: 'estimated', confidence: 0.8 },
        },
      });

      const person2 = createPersonEntity({
        id: 'person_002',
        dates: {
          birth: { year: 1012, precision: 'exact', confidence: 0.9 },
        },
      });

      const signals = detector.scoreBySignal(person1, person2);

      expect(signals.dateSimilarity).toBe(1.0); // Exact match
    });

    it('should penalize widely different birth years', () => {
      const person1 = createPersonEntity({
        id: 'person_001',
        dates: {
          birth: { year: 1012, precision: 'estimated', confidence: 0.8 },
        },
      });

      const person2 = createPersonEntity({
        id: 'person_002',
        dates: {
          birth: { year: 1100, precision: 'estimated', confidence: 0.8 },
        },
      });

      const signals = detector.scoreBySignal(person1, person2);

      expect(signals.dateSimilarity).toBeLessThan(0.3); // Very different
    });

    it('should return neutral score for missing dates', () => {
      const person1 = createPersonEntity({
        id: 'person_001',
        // No dates
      });

      const person2 = createPersonEntity({
        id: 'person_002',
        dates: {
          birth: { year: 1100, precision: 'estimated', confidence: 0.8 },
        },
      });

      const signals = detector.scoreBySignal(person1, person2);

      expect(signals.dateSimilarity).toBe(0.5); // Neutral
    });

    it('should calculate attribute similarity for matching traditions', () => {
      const person1 = createPersonEntity({
        id: 'person_001',
        attributes: {
          tradition: ['Kagyu', 'Nyingma'],
          roles: ['teacher'],
          gender: 'male',
        },
      });

      const person2 = createPersonEntity({
        id: 'person_002',
        attributes: {
          tradition: ['Kagyu'],
          roles: ['teacher', 'translator'],
          gender: 'male',
        },
      });

      const signals = detector.scoreBySignal(person1, person2);

      expect(signals.attributeSimilarity).toBeGreaterThan(0.6);
    });

    it('should penalize different genders', () => {
      const person1 = createPersonEntity({
        id: 'person_001',
        attributes: {
          gender: 'male',
        },
      });

      const person2 = createPersonEntity({
        id: 'person_002',
        attributes: {
          gender: 'female',
        },
      });

      const signals = detector.scoreBySignal(person1, person2);

      // Different gender should lower attribute similarity
      expect(signals.attributeSimilarity).toBeLessThan(0.5);
    });
  });

  // ============================================================================
  // Duplicate Probability Tests
  // ============================================================================

  describe('calculateDuplicateProbability', () => {
    it('should return very high confidence for near-identical entities', () => {
      const marpa1 = createPersonEntity({
        id: 'person_001',
        canonicalName: 'Marpa Lotsawa',
        names: {
          tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
          english: ['Marpa the Translator'],
          phonetic: ['Marpa Lotsawa'],
          wylie: ['mar pa lo tsA ba'],
        },
        attributes: {
          roles: ['translator', 'teacher'],
          tradition: ['Kagyu'],
          gender: 'male',
        },
        dates: {
          birth: { year: 1012, precision: 'estimated', confidence: 0.8 },
          death: { year: 1097, precision: 'estimated', confidence: 0.8 },
        },
      });

      const marpa2 = createPersonEntity({
        id: 'person_002',
        canonicalName: 'Marpa',
        names: {
          tibetan: ['མར་པ།'],
          english: ['Marpa'],
          phonetic: ['Marpa'],
          wylie: ['mar pa'],
        },
        attributes: {
          roles: ['teacher'],
          tradition: ['Kagyu'],
          gender: 'male',
        },
        dates: {
          birth: { year: 1012, precision: 'estimated', confidence: 0.8 },
          death: { year: 1097, precision: 'estimated', confidence: 0.8 },
        },
      });

      const score = detector.calculateDuplicateProbability(marpa1, marpa2);

      expect(score.overall).toBeGreaterThan(0.85);
      expect(score.confidenceLevel).toMatch(/very_high|high/);
      expect(score.reason).toBeTruthy();
      expect(score.warnings).toBeDefined();
    });

    it('should detect reincarnation edge case', () => {
      const dalaiLama13 = createPersonEntity({
        id: 'person_001',
        canonicalName: 'Thubten Gyatso',
        names: {
          tibetan: ['ཐུབ་བསྟན་རྒྱ་མཚོ།'],
          english: ['Thubten Gyatso'],
          phonetic: ['Thubten Gyatso'],
          wylie: ['thub bstan rgya mtsho'],
        },
        attributes: {
          tradition: ['Gelug'],
          gender: 'male',
        },
        dates: {
          birth: { year: 1876, precision: 'exact', confidence: 1.0 },
          death: { year: 1933, precision: 'exact', confidence: 1.0 },
        },
      });

      const dalaiLama14 = createPersonEntity({
        id: 'person_002',
        canonicalName: 'Tenzin Gyatso',
        names: {
          tibetan: ['བསྟན་འཛིན་རྒྱ་མཚོ།'],
          english: ['Tenzin Gyatso'],
          phonetic: ['Tenzin Gyatso'],
          wylie: ['bstan \'dzin rgya mtsho'],
        },
        attributes: {
          tradition: ['Gelug'],
          gender: 'male',
        },
        dates: {
          birth: { year: 1935, precision: 'exact', confidence: 1.0 },
        },
      });

      const score = detector.calculateDuplicateProbability(dalaiLama13, dalaiLama14);

      // Should have warning about different time periods
      expect(score.warnings.length).toBeGreaterThan(0);
      expect(score.warnings.some(w => w.includes('time period'))).toBe(true);

      // Overall score should be medium or low due to date mismatch
      expect(score.confidenceLevel).toMatch(/medium|low/);
    });

    it('should provide detailed signal breakdown', () => {
      const entity1 = createPersonEntity({ id: 'person_001' });
      const entity2 = createPersonEntity({ id: 'person_002' });

      const score = detector.calculateDuplicateProbability(entity1, entity2);

      expect(score.signals).toBeDefined();
      expect(score.signals.nameSimilarity).toBeGreaterThanOrEqual(0);
      expect(score.signals.nameSimilarity).toBeLessThanOrEqual(1);
      expect(score.signals.dateSimilarity).toBeGreaterThanOrEqual(0);
      expect(score.signals.dateSimilarity).toBeLessThanOrEqual(1);
      expect(score.signals.locationSimilarity).toBeGreaterThanOrEqual(0);
      expect(score.signals.locationSimilarity).toBeLessThanOrEqual(1);
      expect(score.signals.relationshipSimilarity).toBeGreaterThanOrEqual(0);
      expect(score.signals.relationshipSimilarity).toBeLessThanOrEqual(1);
      expect(score.signals.attributeSimilarity).toBeGreaterThanOrEqual(0);
      expect(score.signals.attributeSimilarity).toBeLessThanOrEqual(1);
    });

    it('should calculate weighted contributions correctly', () => {
      const entity1 = createPersonEntity({ id: 'person_001' });
      const entity2 = createPersonEntity({ id: 'person_002' });

      const score = detector.calculateDuplicateProbability(entity1, entity2);

      // Sum of weights should equal overall score (within floating point precision)
      const sumOfWeights =
        score.weights.name +
        score.weights.date +
        score.weights.location +
        score.weights.relationship +
        score.weights.attribute;

      expect(Math.abs(sumOfWeights - score.overall)).toBeLessThan(0.001);
    });
  });

  // ============================================================================
  // Find Duplicates Tests
  // ============================================================================

  describe('findDuplicates', () => {
    it('should find duplicate entities above threshold', async () => {
      const target = createPersonEntity({
        id: 'person_001',
        canonicalName: 'Marpa',
        names: {
          tibetan: ['མར་པ།'],
          english: ['Marpa'],
          phonetic: ['Marpa'],
          wylie: ['mar pa'],
        },
      });

      const candidates = [
        createPersonEntity({
          id: 'person_002',
          canonicalName: 'Mar-pa',
          names: {
            tibetan: ['མར་པ།'],
            english: ['Marpa'],
            phonetic: ['Marpa'],
            wylie: ['mar pa'],
          },
        }),
        createPersonEntity({
          id: 'person_003',
          canonicalName: 'Milarepa', // Different person
          names: {
            tibetan: ['མི་ལ་རས་པ།'],
            english: ['Milarepa'],
            phonetic: ['Milarepa'],
            wylie: ['mi la ras pa'],
          },
        }),
      ];

      const duplicates = await detector.findDuplicates(target, candidates, {
        threshold: 0.70,
      });

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].entity2.id).toBe('person_002'); // Should match Marpa variant
    });

    it('should respect limit parameter', async () => {
      const target = createPersonEntity({ id: 'person_001' });
      const candidates = Array.from({ length: 10 }, (_, i) =>
        createPersonEntity({ id: `person_${i + 2}` })
      );

      const duplicates = await detector.findDuplicates(target, candidates, {
        threshold: 0.50,
        limit: 3,
      });

      expect(duplicates.length).toBeLessThanOrEqual(3);
    });

    it('should filter by entity type when sameTypeOnly is true', async () => {
      const personTarget = createPersonEntity({ id: 'person_001' });
      const candidates: Entity[] = [
        createPersonEntity({ id: 'person_002' }),
        createPlaceEntity({ id: 'place_001' }),
      ];

      const duplicates = await detector.findDuplicates(personTarget, candidates, {
        sameTypeOnly: true,
        threshold: 0.50,
      });

      // Should only find person duplicates
      expect(duplicates.every(d => d.entity2.type === 'person')).toBe(true);
    });

    it('should exclude self from candidate pool', async () => {
      const target = createPersonEntity({ id: 'person_001' });
      const candidates = [
        target, // Same entity
        createPersonEntity({ id: 'person_002' }),
      ];

      const duplicates = await detector.findDuplicates(target, candidates, {
        threshold: 0.50,
      });

      // Should not match with itself
      expect(duplicates.every(d => d.entity2.id !== target.id)).toBe(true);
    });

    it('should sort results by score descending', async () => {
      const target = createPersonEntity({
        id: 'person_001',
        canonicalName: 'Test',
      });

      const candidates = [
        createPersonEntity({
          id: 'person_002',
          canonicalName: 'Test', // Exact match
        }),
        createPersonEntity({
          id: 'person_003',
          canonicalName: 'Test Person', // Partial match
        }),
        createPersonEntity({
          id: 'person_004',
          canonicalName: 'Different', // Low match
        }),
      ];

      const duplicates = await detector.findDuplicates(target, candidates, {
        threshold: 0.30,
      });

      // Should be sorted by score descending
      for (let i = 1; i < duplicates.length; i++) {
        expect(duplicates[i - 1].score.overall).toBeGreaterThanOrEqual(
          duplicates[i].score.overall
        );
      }
    });

    it('should assign correct recommendations', async () => {
      const target = createPersonEntity({ id: 'person_001' });
      const highMatch = createPersonEntity({
        id: 'person_002',
        canonicalName: target.canonicalName, // Same name
      });

      const duplicates = await detector.findDuplicates(target, [highMatch], {
        threshold: 0.70,
      });

      expect(duplicates.length).toBeGreaterThan(0);
      expect(['auto_merge', 'review', 'manual_decision', 'probably_different']).toContain(
        duplicates[0].recommendation
      );
    });
  });

  // ============================================================================
  // Clustering Tests
  // ============================================================================

  describe('clusterSimilarEntities', () => {
    it('should cluster transitive duplicates (A=B, B=C => A=C)', () => {
      const entities = [
        createPersonEntity({ id: 'person_001', canonicalName: 'Marpa' }),
        createPersonEntity({ id: 'person_002', canonicalName: 'Mar-pa' }),
        createPersonEntity({ id: 'person_003', canonicalName: 'Marpa Lotsawa' }),
      ];

      // Create pairs with high similarity
      const pairs = [
        {
          entity1: entities[0],
          entity2: entities[1],
          score: {
            overall: 0.92,
            confidenceLevel: 'very_high' as const,
            signals: {
              nameSimilarity: 0.95,
              dateSimilarity: 0.9,
              locationSimilarity: 0.5,
              relationshipSimilarity: 0.5,
              attributeSimilarity: 0.8,
            },
            weights: { name: 0.5, date: 0.2, location: 0.15, relationship: 0.1, attribute: 0.05 },
            reason: 'Test',
            warnings: [],
          },
          recommendation: 'auto_merge' as const,
          detectedAt: new Date(),
        },
        {
          entity1: entities[1],
          entity2: entities[2],
          score: {
            overall: 0.88,
            confidenceLevel: 'high' as const,
            signals: {
              nameSimilarity: 0.9,
              dateSimilarity: 0.85,
              locationSimilarity: 0.5,
              relationshipSimilarity: 0.5,
              attributeSimilarity: 0.75,
            },
            weights: { name: 0.5, date: 0.2, location: 0.15, relationship: 0.1, attribute: 0.05 },
            reason: 'Test',
            warnings: [],
          },
          recommendation: 'review' as const,
          detectedAt: new Date(),
        },
      ];

      const clusters = detector.clusterSimilarEntities(entities, pairs);

      expect(clusters.length).toBe(1); // All three should be in one cluster
      expect(clusters[0].entities.length).toBe(3);
    });

    it('should create separate clusters for unconnected entities', () => {
      const entities = [
        createPersonEntity({ id: 'person_001', canonicalName: 'Marpa' }),
        createPersonEntity({ id: 'person_002', canonicalName: 'Mar-pa' }),
        createPersonEntity({ id: 'person_003', canonicalName: 'Milarepa' }),
        createPersonEntity({ id: 'person_004', canonicalName: 'Mila' }),
      ];

      const pairs = [
        {
          entity1: entities[0],
          entity2: entities[1],
          score: {
            overall: 0.92,
            confidenceLevel: 'very_high' as const,
            signals: {
              nameSimilarity: 0.95,
              dateSimilarity: 0.9,
              locationSimilarity: 0.5,
              relationshipSimilarity: 0.5,
              attributeSimilarity: 0.8,
            },
            weights: { name: 0.5, date: 0.2, location: 0.15, relationship: 0.1, attribute: 0.05 },
            reason: 'Test',
            warnings: [],
          },
          recommendation: 'auto_merge' as const,
          detectedAt: new Date(),
        },
        {
          entity1: entities[2],
          entity2: entities[3],
          score: {
            overall: 0.88,
            confidenceLevel: 'high' as const,
            signals: {
              nameSimilarity: 0.9,
              dateSimilarity: 0.85,
              locationSimilarity: 0.5,
              relationshipSimilarity: 0.5,
              attributeSimilarity: 0.75,
            },
            weights: { name: 0.5, date: 0.2, location: 0.15, relationship: 0.1, attribute: 0.05 },
            reason: 'Test',
            warnings: [],
          },
          recommendation: 'review' as const,
          detectedAt: new Date(),
        },
      ];

      const clusters = detector.clusterSimilarEntities(entities, pairs);

      expect(clusters.length).toBe(2); // Two separate clusters
    });

    it('should suggest canonical entity with highest confidence', () => {
      const entities = [
        createPersonEntity({
          id: 'person_001',
          canonicalName: 'Marpa',
          confidence: 0.7,
        }),
        createPersonEntity({
          id: 'person_002',
          canonicalName: 'Marpa Lotsawa',
          confidence: 0.95, // Highest confidence
        }),
      ];

      const pairs = [
        {
          entity1: entities[0],
          entity2: entities[1],
          score: {
            overall: 0.92,
            confidenceLevel: 'very_high' as const,
            signals: {
              nameSimilarity: 0.95,
              dateSimilarity: 0.9,
              locationSimilarity: 0.5,
              relationshipSimilarity: 0.5,
              attributeSimilarity: 0.8,
            },
            weights: { name: 0.5, date: 0.2, location: 0.15, relationship: 0.1, attribute: 0.05 },
            reason: 'Test',
            warnings: [],
          },
          recommendation: 'auto_merge' as const,
          detectedAt: new Date(),
        },
      ];

      const clusters = detector.clusterSimilarEntities(entities, pairs);

      expect(clusters[0].suggestedCanonical?.id).toBe('person_002');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('detectAllDuplicates', () => {
    it('should detect all duplicate groups in a collection', async () => {
      const entities = [
        // Marpa group (3 entities)
        createPersonEntity({
          id: 'person_001',
          canonicalName: 'Marpa',
          names: {
            tibetan: ['མར་པ།'],
            english: ['Marpa'],
            phonetic: ['Marpa'],
            wylie: ['mar pa'],
          },
        }),
        createPersonEntity({
          id: 'person_002',
          canonicalName: 'Mar-pa',
          names: {
            tibetan: ['མར་པ།'],
            english: ['Marpa'],
            phonetic: ['Marpa'],
            wylie: ['mar pa'],
          },
        }),
        createPersonEntity({
          id: 'person_003',
          canonicalName: 'Marpa Lotsawa',
          names: {
            tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
            english: ['Marpa the Translator'],
            phonetic: ['Marpa Lotsawa'],
            wylie: ['mar pa lo tsA ba'],
          },
        }),
        // Unique entity
        createPersonEntity({
          id: 'person_004',
          canonicalName: 'Milarepa',
          names: {
            tibetan: ['མི་ལ་རས་པ།'],
            english: ['Milarepa'],
            phonetic: ['Milarepa'],
            wylie: ['mi la ras pa'],
          },
        }),
      ];

      const groups = await detector.detectAllDuplicates(entities, {
        threshold: 0.70,
      });

      // Should find at least one group (Marpa variants)
      expect(groups.length).toBeGreaterThan(0);

      // Largest group should be Marpa variants
      const largestGroup = groups.reduce((max, group) =>
        group.cluster.entities.length > max.cluster.entities.length ? group : max
      );

      expect(largestGroup.cluster.entities.length).toBeGreaterThan(1);
    });

    it('should assign appropriate merge strategies', async () => {
      const entities = [
        createPersonEntity({ id: 'person_001', canonicalName: 'Test' }),
        createPersonEntity({ id: 'person_002', canonicalName: 'Test' }),
      ];

      const groups = await detector.detectAllDuplicates(entities, {
        threshold: 0.70,
      });

      if (groups.length > 0) {
        expect(['single_canonical', 'manual_review', 'no_merge']).toContain(
          groups[0].mergeStrategy
        );
      }
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('Helper Functions', () => {
    it('duplicatePairToDbRecord should convert pair to database format', () => {
      const pair = {
        entity1: createPersonEntity({ id: 'person_001' }),
        entity2: createPersonEntity({ id: 'person_002' }),
        score: {
          overall: 0.92,
          confidenceLevel: 'very_high' as const,
          signals: {
            nameSimilarity: 0.95,
            dateSimilarity: 0.9,
            locationSimilarity: 0.85,
            relationshipSimilarity: 0.8,
            attributeSimilarity: 0.75,
          },
          weights: { name: 0.5, date: 0.2, location: 0.15, relationship: 0.1, attribute: 0.05 },
          reason: 'Test',
          warnings: [],
        },
        recommendation: 'auto_merge' as const,
        detectedAt: new Date(),
      };

      const dbRecord = duplicatePairToDbRecord(pair);

      expect(dbRecord.entity1Id).toBe('person_001');
      expect(dbRecord.entity2Id).toBe('person_002');
      expect(dbRecord.similarityScore).toBe('0.92');
      expect(dbRecord.confidenceLevel).toBe('very_high');
      expect(dbRecord.detectedAt).toBeInstanceOf(Date);
    });

    it('getConfidenceLevel should classify scores correctly', () => {
      expect(detector.getConfidenceLevel(0.95)).toBe('very_high');
      expect(detector.getConfidenceLevel(0.85)).toBe('high');
      expect(detector.getConfidenceLevel(0.75)).toBe('medium');
      expect(detector.getConfidenceLevel(0.65)).toBe('low');
    });

    it('getRecommendedThreshold should return correct thresholds', () => {
      expect(detector.getRecommendedThreshold('auto_merge')).toBe(0.90);
      expect(detector.getRecommendedThreshold('review_queue')).toBe(0.80);
      expect(detector.getRecommendedThreshold('exploration')).toBe(0.70);
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle entities with minimal data', () => {
      const minimal1 = createPersonEntity({
        id: 'person_001',
        canonicalName: 'Unknown',
        names: {
          tibetan: [],
          english: [],
          phonetic: [],
          wylie: [],
        },
        attributes: {},
      });

      const minimal2 = createPersonEntity({
        id: 'person_002',
        canonicalName: 'Unknown',
        names: {
          tibetan: [],
          english: [],
          phonetic: [],
          wylie: [],
        },
        attributes: {},
      });

      const score = detector.calculateDuplicateProbability(minimal1, minimal2);

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    });

    it('should handle empty candidate pools', async () => {
      const target = createPersonEntity({ id: 'person_001' });
      const duplicates = await detector.findDuplicates(target, [], {
        threshold: 0.70,
      });

      expect(duplicates).toEqual([]);
    });

    it('should handle single entity in clustering', () => {
      const entities = [createPersonEntity({ id: 'person_001' })];
      const clusters = detector.clusterSimilarEntities(entities, []);

      expect(clusters.length).toBe(0); // No clusters with single entity
    });
  });
});
