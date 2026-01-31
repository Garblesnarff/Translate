/**
 * FuzzyMatcher Usage Examples
 *
 * Practical examples demonstrating how to use the FuzzyMatcher service
 * for entity resolution in the Tibetan Buddhist knowledge graph.
 */

import { fuzzyMatcher } from './FuzzyMatcher';
import type { Entity, PersonEntity } from '../../types/entities';

// ============================================================================
// Example 1: Basic Name Comparison
// ============================================================================

export function example1_BasicComparison() {
  console.log('=== Example 1: Basic Name Comparison ===\n');

  const name1 = 'Marpa Lotsawa';
  const name2 = 'Mar-pa the Translator';

  const score = fuzzyMatcher.calculateSimilarity(name1, name2);

  console.log(`Comparing: "${name1}" vs "${name2}"`);
  console.log(`Score: ${score.score.toFixed(3)}`);
  console.log(`Match Type: ${score.matchType}`);
  console.log(`Reason: ${score.reason}`);
  console.log(`Confidence: ${score.confidence.toFixed(3)}`);
  console.log('\nComponent Scores:');
  console.log(`  Levenshtein: ${score.components.levenshtein.toFixed(3)}`);
  console.log(`  Phonetic:    ${score.components.phonetic.toFixed(3)}`);
  console.log(`  Word Level:  ${score.components.wordLevel.toFixed(3)}`);
  console.log(`  Length Penalty: ${score.components.lengthPenalty.toFixed(3)}`);
}

// ============================================================================
// Example 2: Finding Similar Names in Database
// ============================================================================

export function example2_FindSimilarNames() {
  console.log('\n=== Example 2: Finding Similar Names ===\n');

  // Simulate database of existing entities
  const existingEntities: PersonEntity[] = [
    {
      id: '1',
      type: 'person',
      canonicalName: 'Marpa Lotsawa',
      names: {
        tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
        english: ['Marpa', 'Marpa Lotsawa', 'Marpa the Translator'],
        wylie: ['mar pa lo tsā ba'],
        phonetic: ['Marpa'],
      },
      confidence: 0.95,
      verified: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 'human',
      attributes: {
        roles: ['translator'],
        tradition: ['Kagyu'],
      },
    },
    {
      id: '2',
      type: 'person',
      canonicalName: 'Milarepa',
      names: {
        tibetan: ['མི་ལ་རས་པ།'],
        english: ['Milarepa', 'Jetsun Milarepa', 'Mila Repa'],
        wylie: ['mi la ras pa'],
        phonetic: ['Milarepa', 'Mila'],
      },
      confidence: 0.98,
      verified: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 'human',
      attributes: {
        roles: ['yogi'],
        tradition: ['Kagyu'],
      },
    },
    {
      id: '3',
      type: 'person',
      canonicalName: 'Gampopa',
      names: {
        tibetan: ['སྒམ་པོ་པ།'],
        english: ['Gampopa', 'Dakpo Lhaje', 'Sönam Rinchen'],
        wylie: ['sgam po pa'],
        phonetic: ['Gampopa'],
      },
      confidence: 0.92,
      verified: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      createdBy: 'human',
      attributes: {
        roles: ['teacher'],
        tradition: ['Kagyu'],
      },
    },
  ];

  // New entity from document extraction
  const newName = 'Mar-pa';

  console.log(`Searching for similar names to: "${newName}"\n`);

  // Find matches with threshold 0.85 (review queue threshold)
  const matches = fuzzyMatcher.findSimilarNames(newName, existingEntities, {
    threshold: 0.85,
    limit: 5,
  });

  if (matches.length === 0) {
    console.log('No similar names found above threshold.');
  } else {
    console.log(`Found ${matches.length} similar name(s):\n`);
    matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.candidate.canonicalName}`);
      console.log(`   Matched variant: "${match.matchedName}"`);
      console.log(`   Similarity: ${match.score.score.toFixed(3)}`);
      console.log(`   Type: ${match.score.matchType}`);
      console.log(`   Confidence: ${match.score.confidence.toFixed(3)}`);
      console.log(`   Reason: ${match.score.reason}`);
      console.log('');
    });
  }

  // Suggest action based on score
  if (matches.length > 0) {
    const bestMatch = matches[0];
    if (bestMatch.score.score >= 0.95) {
      console.log(
        `✓ Recommendation: AUTO-MERGE with "${bestMatch.candidate.canonicalName}"`
      );
      console.log('  (Very high confidence match)');
    } else if (bestMatch.score.score >= 0.85) {
      console.log(
        `⚠ Recommendation: HUMAN REVIEW needed for "${bestMatch.candidate.canonicalName}"`
      );
      console.log('  (Likely match but requires verification)');
    } else {
      console.log('ℹ Recommendation: CREATE NEW ENTITY');
      console.log('  (No strong matches found)');
    }
  }
}

// ============================================================================
// Example 3: Comparing Two Complete Entities
// ============================================================================

export function example3_CompareEntities() {
  console.log('\n=== Example 3: Comparing Complete Entities ===\n');

  const entity1: PersonEntity = {
    id: '1',
    type: 'person',
    canonicalName: 'Marpa',
    names: {
      tibetan: ['མར་པ།', 'མར་པ་ལོ་ཙཱ་བ།'],
      english: ['Marpa', 'Marpa Lotsawa'],
      wylie: ['mar pa', 'mar pa lo tsā ba'],
      phonetic: ['Marpa', 'Marpha'],
    },
    confidence: 0.9,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
    attributes: {
      roles: ['translator'],
    },
  };

  const entity2: PersonEntity = {
    id: '2',
    type: 'person',
    canonicalName: 'Mar-pa the Translator',
    names: {
      tibetan: ['མར་པ།'],
      english: ['Mar-pa', 'Marpa the Translator'],
      wylie: ['mar pa'],
      phonetic: ['Marpa'],
    },
    confidence: 0.85,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
    attributes: {
      roles: ['translator'],
    },
  };

  console.log(`Entity 1: ${entity1.canonicalName}`);
  console.log(`  Name variants: ${Object.values(entity1.names).flat().length}`);
  console.log(`\nEntity 2: ${entity2.canonicalName}`);
  console.log(`  Name variants: ${Object.values(entity2.names).flat().length}`);

  const bestScore = fuzzyMatcher.compareEntities(entity1, entity2);

  console.log('\nBest Match Score:');
  console.log(`  Overall: ${bestScore.score.toFixed(3)}`);
  console.log(`  Type: ${bestScore.matchType}`);
  console.log(`  Confidence: ${bestScore.confidence.toFixed(3)}`);
  console.log(`  Reason: ${bestScore.reason}`);

  if (bestScore.score >= 0.95) {
    console.log('\n✓ These are very likely the same entity!');
    console.log('  Recommend: Automatic merge');
  } else if (bestScore.score >= 0.85) {
    console.log('\n⚠ These are likely the same entity.');
    console.log('  Recommend: Human review before merging');
  } else {
    console.log('\nℹ These might be different entities.');
    console.log('  Recommend: Keep separate unless other evidence confirms match');
  }
}

// ============================================================================
// Example 4: Handling Tibetan Name Variants
// ============================================================================

export function example4_TibetanVariants() {
  console.log('\n=== Example 4: Tibetan Name Variants ===\n');

  const testCases = [
    ['mar pa', 'marpa', 'Wylie vs Phonetic'],
    ['tsong kha pa', 'tsongkhapa', 'Wylie vs Standard'],
    ['pad+ma', 'padma', 'Sanskrit variant'],
    ['sa skya', 'sakya', 'Wylie vs Phonetic'],
    ['bka\' brgyud', 'kagyu', 'Tradition name'],
    ['rnying ma', 'nyingma', 'Tradition name'],
    ['Marpa Rinpoche', 'Marpa', 'With honorific'],
    ['Je Tsongkhapa', 'Tsongkhapa', 'With honorific'],
  ];

  console.log('Testing known Tibetan transliteration variants:\n');

  testCases.forEach(([variant1, variant2, description]) => {
    const score = fuzzyMatcher.calculateSimilarity(variant1, variant2);
    const status = score.score >= 0.85 ? '✓' : '✗';
    console.log(`${status} ${description}`);
    console.log(`  "${variant1}" vs "${variant2}"`);
    console.log(`  Score: ${score.score.toFixed(3)} (${score.matchType})`);
    console.log('');
  });
}

// ============================================================================
// Example 5: Batch Processing Pipeline
// ============================================================================

export async function example5_BatchProcessingPipeline(
  newEntities: Entity[],
  existingEntities: Entity[]
) {
  console.log('\n=== Example 5: Batch Processing Pipeline ===\n');

  const results = {
    autoMerged: [] as Array<{ newEntity: Entity; existingEntity: Entity; score: number }>,
    needsReview: [] as Array<{ newEntity: Entity; existingEntity: Entity; score: number }>,
    newEntities: [] as Entity[],
  };

  console.log(`Processing ${newEntities.length} new entities...\n`);

  for (const newEntity of newEntities) {
    // Find similar names
    const matches = fuzzyMatcher.findSimilarNames(
      newEntity.canonicalName,
      existingEntities,
      {
        threshold: 0.85,
        limit: 1, // Only need best match
        preferSameType: true,
      }
    );

    if (matches.length === 0) {
      // No matches found - this is a new entity
      results.newEntities.push(newEntity);
      console.log(`✓ NEW: ${newEntity.canonicalName}`);
    } else {
      const bestMatch = matches[0];

      if (bestMatch.score.score >= 0.95) {
        // High confidence - auto-merge
        results.autoMerged.push({
          newEntity,
          existingEntity: bestMatch.candidate,
          score: bestMatch.score.score,
        });
        console.log(
          `✓ MERGE: ${newEntity.canonicalName} → ${bestMatch.candidate.canonicalName} (${bestMatch.score.score.toFixed(3)})`
        );
      } else {
        // Medium confidence - needs human review
        results.needsReview.push({
          newEntity,
          existingEntity: bestMatch.candidate,
          score: bestMatch.score.score,
        });
        console.log(
          `⚠ REVIEW: ${newEntity.canonicalName} ≈ ${bestMatch.candidate.canonicalName} (${bestMatch.score.score.toFixed(3)})`
        );
      }
    }
  }

  console.log('\n=== Processing Summary ===');
  console.log(`Auto-merged:  ${results.autoMerged.length}`);
  console.log(`Needs review: ${results.needsReview.length}`);
  console.log(`New entities: ${results.newEntities.length}`);

  return results;
}

// ============================================================================
// Example 6: Real-World Test Cases
// ============================================================================

export function example6_RealWorldTests() {
  console.log('\n=== Example 6: Real-World Test Cases ===\n');

  const testCases = [
    {
      name1: 'Dalai Lama',
      name2: "tā la'i bla ma",
      expected: 'high',
    },
    {
      name1: 'Atisha',
      name2: 'Jo bo rje Atisha',
      expected: 'medium-high',
    },
    {
      name1: 'Sakya Pandita',
      name2: 'Sakya',
      expected: 'medium',
    },
    {
      name1: 'Milarepa',
      name2: 'Jetsun Milarepa',
      expected: 'high',
    },
    {
      name1: 'Tsongkhapa',
      name2: 'Lobsang Drakpa',
      expected: 'low', // Birth name vs. ordained name
    },
  ];

  console.log('Testing real-world name pairs:\n');

  testCases.forEach(({ name1, name2, expected }) => {
    const score = fuzzyMatcher.calculateSimilarity(name1, name2);

    let category: string;
    if (score.score >= 0.95) category = 'very-high';
    else if (score.score >= 0.85) category = 'high';
    else if (score.score >= 0.75) category = 'medium-high';
    else if (score.score >= 0.60) category = 'medium';
    else category = 'low';

    const match = category.includes(expected) ? '✓' : '✗';

    console.log(`${match} "${name1}" vs "${name2}"`);
    console.log(`   Score: ${score.score.toFixed(3)} (${category}, expected: ${expected})`);
    console.log(`   Type: ${score.matchType}`);
    console.log('');
  });
}

// ============================================================================
// Run All Examples
// ============================================================================

export function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   FuzzyMatcher Usage Examples                         ║');
  console.log('║   Phase 2.1: Entity Resolution                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  example1_BasicComparison();
  example2_FindSimilarNames();
  example3_CompareEntities();
  example4_TibetanVariants();
  example6_RealWorldTests();

  console.log('\n✓ All examples completed!\n');
}

// Run examples if called directly
if (require.main === module) {
  runAllExamples();
}
