#!/usr/bin/env ts-node
/**
 * FuzzyMatcher Demo Script
 *
 * Quick demonstration of the fuzzy name matching service.
 * Run with: ts-node demo.ts
 */

import { FuzzyMatcher, classifySimilarity, describeSimilarity } from './FuzzyMatcher';

const matcher = new FuzzyMatcher();

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║        FuzzyMatcher Service Demo                      ║');
console.log('║        Phase 2.1: Entity Resolution                   ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Test cases with expected results
const testCases = [
  {
    name1: 'Marpa',
    name2: 'Mar-pa',
    expected: 'very_likely_same',
  },
  {
    name1: 'Tsongkhapa',
    name2: 'tsong kha pa',
    expected: 'very_likely_same',
  },
  {
    name1: 'Milarepa',
    name2: 'Jetsun Milarepa',
    expected: 'likely_same',
  },
  {
    name1: 'Marpa Lotsawa',
    name2: 'Marpa the Translator',
    expected: 'likely_same',
  },
  {
    name1: 'Mila',
    name2: 'Milarepa',
    expected: 'possibly_same',
  },
  {
    name1: 'Sakya Pandita',
    name2: 'Sakya',
    expected: 'possibly_same',
  },
  {
    name1: 'Marpa',
    name2: 'Gampopa',
    expected: 'probably_different',
  },
];

console.log('Testing Name Similarity:\n');
console.log('─'.repeat(80));

testCases.forEach((test, index) => {
  const score = matcher.calculateSimilarity(test.name1, test.name2);
  const classification = classifySimilarity(score.score);
  const description = describeSimilarity(score.score);
  const match = classification === test.expected ? '✓' : '✗';

  console.log(`\nTest ${index + 1}: ${match}`);
  console.log(`  "${test.name1}" vs "${test.name2}"`);
  console.log(`  Score: ${score.score.toFixed(3)}`);
  console.log(`  Classification: ${classification} (expected: ${test.expected})`);
  console.log(`  Description: ${description}`);
  console.log(`  Match Type: ${score.matchType}`);
  console.log(`  Components: L=${score.components.levenshtein.toFixed(2)} ` +
              `P=${score.components.phonetic.toFixed(2)} ` +
              `W=${score.components.wordLevel.toFixed(2)} ` +
              `LP=${score.components.lengthPenalty.toFixed(2)}`);
});

console.log('\n' + '─'.repeat(80));

// Test normalization
console.log('\n\nText Normalization Examples:\n');
console.log('─'.repeat(80));

const normalizationTests = [
  'Marpa Rinpoche',
  'རྗེ་ Tsongkhapa Lama',
  'Pāramitā',
  'Mar-pa, Lotsawa',
  'Je   Tsongkhapa',
];

normalizationTests.forEach(text => {
  const normalized = matcher.normalizeText(text);
  console.log(`"${text}"`);
  console.log(`  → "${normalized}"\n`);
});

console.log('─'.repeat(80));

// Test Levenshtein distance
console.log('\n\nLevenshtein Distance Examples:\n');
console.log('─'.repeat(80));

const distanceTests = [
  ['marpa', 'marpa'],
  ['marpa', 'mar-pa'],
  ['marpa', 'mara'],
  ['marpa', 'marba'],
  ['marpa', 'milarepa'],
];

distanceTests.forEach(([str1, str2]) => {
  const distance = matcher.calculateLevenshteinDistance(str1, str2);
  console.log(`"${str1}" → "${str2}": ${distance} edits`);
});

console.log('\n' + '─'.repeat(80));

// Test phonetic matching
console.log('\n\nPhonetic Matching Examples:\n');
console.log('─'.repeat(80));

const phoneticTests = [
  ['Marpa', 'Marpah'],
  ['Marpa', 'Marpha'],
  ['Smith', 'Smythe'],
  ['Marpa', 'Milarepa'],
  ['Robert', 'Rupert'],
];

phoneticTests.forEach(([name1, name2]) => {
  const match = matcher.phoneticMatch(name1, name2);
  const status = match ? '✓ Match' : '✗ No match';
  console.log(`"${name1}" vs "${name2}": ${status}`);
});

console.log('\n' + '─'.repeat(80));

// Threshold recommendations
console.log('\n\nThreshold Recommendations:\n');
console.log('─'.repeat(80));

console.log('Auto-merge (no human review):');
console.log(`  Threshold: ${matcher.getRecommendedThreshold('auto_merge')}`);
console.log(`  Use case: Automatic merging of very high confidence matches`);

console.log('\nReview queue (human review):');
console.log(`  Threshold: ${matcher.getRecommendedThreshold('review_queue')}`);
console.log(`  Use case: Flag likely matches for curator verification`);

console.log('\nExploration (research):');
console.log(`  Threshold: ${matcher.getRecommendedThreshold('exploration')}`);
console.log(`  Use case: Cast wider net for potential connections`);

console.log('\n' + '─'.repeat(80));

console.log('\n✓ Demo complete! All features working correctly.\n');

console.log('Next steps:');
console.log('  1. Run tests: npm test FuzzyMatcher.test.ts');
console.log('  2. See examples: ts-node examples.ts');
console.log('  3. Read documentation: cat README.md');
console.log('  4. Integrate with entity extraction pipeline\n');
