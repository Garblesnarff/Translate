/**
 * Duplicate Detection Service - Example Usage
 *
 * This file demonstrates how to use the DuplicateDetector service
 * to find and resolve duplicate entities across documents.
 *
 * Phase 2.2: Entity Resolution - Duplicate Detection
 */

import { DuplicateDetector } from './DuplicateDetector';
import { FuzzyMatcher } from './FuzzyMatcher';
import type { PersonEntity, PlaceEntity } from '../../types/entities';

// ============================================================================
// Example: Detecting Duplicate People
// ============================================================================

async function example1_FindDuplicatePersons() {
  console.log('=== Example 1: Finding Duplicate Persons ===\n');

  const fuzzyMatcher = new FuzzyMatcher();
  const detector = new DuplicateDetector(fuzzyMatcher);

  // Example: Multiple extractions of "Marpa"
  const marpa1: PersonEntity = {
    id: 'person_001',
    type: 'person',
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
      affiliations: ['Sakya Monastery'],
      gender: 'male',
    },
    dates: {
      birth: {
        year: 1012,
        precision: 'estimated',
        confidence: 0.8,
      },
      death: {
        year: 1097,
        precision: 'estimated',
        confidence: 0.8,
      },
    },
    confidence: 0.85,
    verified: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    createdBy: 'ai',
  };

  const marpa2: PersonEntity = {
    id: 'person_002',
    type: 'person',
    canonicalName: 'Mar-pa',
    names: {
      tibetan: ['མར་པ།'],
      english: ['Marpa'],
      phonetic: ['Marpah'],
      wylie: ['mar pa'],
    },
    attributes: {
      roles: ['teacher', 'yogi'],
      tradition: ['Kagyu'],
      affiliations: ['Sakya Monastery'],
      gender: 'male',
    },
    dates: {
      birth: {
        year: 1015, // Slightly different year
        precision: 'circa',
        confidence: 0.7,
      },
      death: {
        year: 1099, // Slightly different year
        precision: 'circa',
        confidence: 0.7,
      },
    },
    confidence: 0.75,
    verified: false,
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-02'),
    createdBy: 'ai',
  };

  const milarepa: PersonEntity = {
    id: 'person_003',
    type: 'person',
    canonicalName: 'Milarepa',
    names: {
      tibetan: ['མི་ལ་རས་པ།'],
      english: ['Milarepa', 'Mila'],
      phonetic: ['Milarepa'],
      wylie: ['mi la ras pa'],
    },
    attributes: {
      roles: ['yogi', 'poet'],
      tradition: ['Kagyu'],
      affiliations: [],
      gender: 'male',
    },
    dates: {
      birth: {
        year: 1052,
        precision: 'estimated',
        confidence: 0.8,
      },
      death: {
        year: 1135,
        precision: 'estimated',
        confidence: 0.8,
      },
    },
    confidence: 0.9,
    verified: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    createdBy: 'ai',
  };

  // Find duplicates for marpa1
  const duplicates = await detector.findDuplicates(
    marpa1,
    [marpa2, milarepa],
    { threshold: 0.70, limit: 10 }
  );

  console.log(`Found ${duplicates.length} potential duplicates for ${marpa1.canonicalName}:\n`);

  duplicates.forEach((pair, idx) => {
    console.log(`Match ${idx + 1}:`);
    console.log(`  Entity: ${pair.entity2.canonicalName}`);
    console.log(`  Overall Score: ${(pair.score.overall * 100).toFixed(1)}%`);
    console.log(`  Confidence Level: ${pair.score.confidenceLevel}`);
    console.log(`  Recommendation: ${pair.recommendation}`);
    console.log(`  Reason: ${pair.score.reason}`);
    console.log('\n  Signal Breakdown:');
    console.log(`    Name: ${(pair.score.signals.nameSimilarity * 100).toFixed(1)}%`);
    console.log(`    Date: ${(pair.score.signals.dateSimilarity * 100).toFixed(1)}%`);
    console.log(`    Location: ${(pair.score.signals.locationSimilarity * 100).toFixed(1)}%`);
    console.log(`    Relationships: ${(pair.score.signals.relationshipSimilarity * 100).toFixed(1)}%`);
    console.log(`    Attributes: ${(pair.score.signals.attributeSimilarity * 100).toFixed(1)}%`);

    if (pair.score.warnings.length > 0) {
      console.log('\n  Warnings:');
      pair.score.warnings.forEach(w => console.log(`    - ${w}`));
    }
    console.log('\n' + '='.repeat(60) + '\n');
  });
}

// ============================================================================
// Example: Detecting All Duplicates in a Collection
// ============================================================================

async function example2_DetectAllDuplicates() {
  console.log('=== Example 2: Detecting All Duplicates ===\n');

  const fuzzyMatcher = new FuzzyMatcher();
  const detector = new DuplicateDetector(fuzzyMatcher);

  // Simulate a collection with duplicates
  const entities: PersonEntity[] = [
    // Marpa - 3 variants
    {
      id: 'person_001',
      type: 'person',
      canonicalName: 'Marpa Lotsawa',
      names: {
        tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
        english: ['Marpa the Translator'],
        phonetic: ['Marpa Lotsawa'],
        wylie: ['mar pa lo tsA ba'],
      },
      attributes: {
        roles: ['translator'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      dates: {
        birth: { year: 1012, precision: 'estimated', confidence: 0.8 },
      },
      confidence: 0.85,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
    {
      id: 'person_002',
      type: 'person',
      canonicalName: 'Mar-pa',
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
        birth: { year: 1015, precision: 'circa', confidence: 0.7 },
      },
      confidence: 0.75,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
    {
      id: 'person_003',
      type: 'person',
      canonicalName: 'Marpa',
      names: {
        tibetan: ['མར་པ།'],
        english: ['Marpa'],
        phonetic: ['Marpa'],
        wylie: ['mar pa'],
      },
      attributes: {
        roles: ['yogi'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      dates: {
        birth: { year: 1010, precision: 'estimated', confidence: 0.6 },
      },
      confidence: 0.7,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
    // Milarepa - unique
    {
      id: 'person_004',
      type: 'person',
      canonicalName: 'Milarepa',
      names: {
        tibetan: ['མི་ལ་རས་པ།'],
        english: ['Milarepa'],
        phonetic: ['Milarepa'],
        wylie: ['mi la ras pa'],
      },
      attributes: {
        roles: ['yogi'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      dates: {
        birth: { year: 1052, precision: 'estimated', confidence: 0.8 },
      },
      confidence: 0.9,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
  ];

  // Detect all duplicates
  const groups = await detector.detectAllDuplicates(entities, {
    threshold: 0.70,
    sameTypeOnly: true,
  });

  console.log(`Found ${groups.length} duplicate groups:\n`);

  groups.forEach((group, idx) => {
    console.log(`Group ${idx + 1}:`);
    console.log(`  Entities in cluster: ${group.cluster.entities.length}`);
    console.log(`  Average similarity: ${(group.groupConfidence * 100).toFixed(1)}%`);
    console.log(`  Merge strategy: ${group.mergeStrategy}`);
    console.log(`  Suggested canonical: ${group.cluster.suggestedCanonical?.canonicalName || 'None'}`);
    console.log('\n  Entities:');

    group.cluster.entities.forEach(entity => {
      console.log(`    - ${entity.canonicalName} (${entity.id}, confidence: ${entity.confidence})`);
    });

    console.log('\n  Connections:');
    group.cluster.connections.forEach(conn => {
      const e1 = group.cluster.entities.find(e => e.id === conn.entity1Id);
      const e2 = group.cluster.entities.find(e => e.id === conn.entity2Id);
      console.log(`    ${e1?.canonicalName} ↔ ${e2?.canonicalName}: ${(conn.similarity * 100).toFixed(1)}%`);
    });

    console.log('\n' + '='.repeat(60) + '\n');
  });
}

// ============================================================================
// Example: Edge Case Detection
// ============================================================================

async function example3_EdgeCases() {
  console.log('=== Example 3: Edge Case Detection ===\n');

  const fuzzyMatcher = new FuzzyMatcher();
  const detector = new DuplicateDetector(fuzzyMatcher);

  // Same name, different time periods (reincarnation)
  const dalaiLama13: PersonEntity = {
    id: 'person_005',
    type: 'person',
    canonicalName: 'Thubten Gyatso',
    names: {
      tibetan: ['ཐུབ་བསྟན་རྒྱ་མཚོ།'],
      english: ['Thubten Gyatso', '13th Dalai Lama'],
      phonetic: ['Thubten Gyatso'],
      wylie: ['thub bstan rgya mtsho'],
    },
    attributes: {
      roles: ['teacher', 'king'],
      tradition: ['Gelug'],
      gender: 'male',
    },
    dates: {
      birth: { year: 1876, precision: 'exact', confidence: 1.0 },
      death: { year: 1933, precision: 'exact', confidence: 1.0 },
    },
    confidence: 0.95,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  const dalaiLama14: PersonEntity = {
    id: 'person_006',
    type: 'person',
    canonicalName: 'Tenzin Gyatso',
    names: {
      tibetan: ['བསྟན་འཛིན་རྒྱ་མཚོ།'],
      english: ['Tenzin Gyatso', '14th Dalai Lama'],
      phonetic: ['Tenzin Gyatso'],
      wylie: ['bstan \'dzin rgya mtsho'],
    },
    attributes: {
      roles: ['teacher'],
      tradition: ['Gelug'],
      gender: 'male',
    },
    dates: {
      birth: { year: 1935, precision: 'exact', confidence: 1.0 },
    },
    confidence: 0.98,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  // Calculate duplicate probability
  const score = detector.calculateDuplicateProbability(dalaiLama13, dalaiLama14);

  console.log('Comparing 13th and 14th Dalai Lamas:\n');
  console.log(`Overall Score: ${(score.overall * 100).toFixed(1)}%`);
  console.log(`Confidence Level: ${score.confidenceLevel}`);
  console.log(`Reason: ${score.reason}`);
  console.log('\nSignal Breakdown:');
  console.log(`  Name: ${(score.signals.nameSimilarity * 100).toFixed(1)}%`);
  console.log(`  Date: ${(score.signals.dateSimilarity * 100).toFixed(1)}%`);
  console.log(`  Location: ${(score.signals.locationSimilarity * 100).toFixed(1)}%`);
  console.log(`  Relationships: ${(score.signals.relationshipSimilarity * 100).toFixed(1)}%`);
  console.log(`  Attributes: ${(score.signals.attributeSimilarity * 100).toFixed(1)}%`);

  if (score.warnings.length > 0) {
    console.log('\nWarnings:');
    score.warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('\nExpected: Should flag as potential reincarnation lineage, not duplicate!');
  console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================================================
// Example: Place Duplicate Detection
// ============================================================================

async function example4_PlaceDuplicates() {
  console.log('=== Example 4: Place Duplicate Detection ===\n');

  const fuzzyMatcher = new FuzzyMatcher();
  const detector = new DuplicateDetector(fuzzyMatcher);

  const sakya1: PlaceEntity = {
    id: 'place_001',
    type: 'place',
    canonicalName: 'Sakya Monastery',
    names: {
      tibetan: ['ས་སྐྱ་དགོན་པ།'],
      english: ['Sakya Monastery', 'Sa-skya Monastery'],
      phonetic: ['Sakya Gonpa'],
      wylie: ['sa skya dgon pa'],
    },
    attributes: {
      placeType: 'monastery',
      region: 'Tsang',
      modernCountry: 'Tibet',
    },
    dates: {
      founded: { year: 1073, precision: 'exact', confidence: 0.9 },
    },
    confidence: 0.9,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  const sakya2: PlaceEntity = {
    id: 'place_002',
    type: 'place',
    canonicalName: 'Sa-skya',
    names: {
      tibetan: ['ས་སྐྱ།'],
      english: ['Sakya'],
      phonetic: ['Sakya'],
      wylie: ['sa skya'],
    },
    attributes: {
      placeType: 'monastery',
      region: 'Tsang',
      modernCountry: 'Tibet',
    },
    dates: {
      founded: { year: 1073, precision: 'estimated', confidence: 0.85 },
    },
    confidence: 0.85,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  const score = detector.calculateDuplicateProbability(sakya1, sakya2);

  console.log('Comparing Sakya Monastery variants:\n');
  console.log(`Overall Score: ${(score.overall * 100).toFixed(1)}%`);
  console.log(`Confidence Level: ${score.confidenceLevel}`);
  console.log(`Recommendation: ${score.confidenceLevel === 'very_high' ? 'AUTO-MERGE' : 'REVIEW'}`);
  console.log(`Reason: ${score.reason}`);

  console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  await example1_FindDuplicatePersons();
  await example2_DetectAllDuplicates();
  await example3_EdgeCases();
  await example4_PlaceDuplicates();

  console.log('All examples completed!');
}

// Export for testing
export {
  example1_FindDuplicatePersons,
  example2_DetectAllDuplicates,
  example3_EdgeCases,
  example4_PlaceDuplicates,
  runAllExamples,
};
