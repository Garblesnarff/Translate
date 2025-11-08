/**
 * Examples demonstrating the Temporal Resolution Service
 *
 * Shows how to resolve various date formats found in Tibetan Buddhist texts
 */

import { temporalResolver, RABJUNG_CYCLES, ERAS } from './TemporalResolver';
import type { Entity } from '../../types/entities';

// ============================================================================
// Example 1: Direct Gregorian Dates
// ============================================================================

async function exampleDirectDates() {
  console.log('=== Example 1: Direct Gregorian Dates ===\n');

  // Simple year
  const date1 = await temporalResolver.resolveDate('1012');
  console.log('Input: "1012"');
  console.log('Result:', {
    year: date1.year,
    precision: date1.precision,
    confidence: date1.confidence,
    method: date1.resolutionMethod,
  });
  console.log();

  // Year with CE suffix
  const date2 = await temporalResolver.resolveDate('1097 CE');
  console.log('Input: "1097 CE"');
  console.log('Result:', {
    year: date2.year,
    precision: date2.precision,
    confidence: date2.confidence,
  });
  console.log();
}

// ============================================================================
// Example 2: Tibetan Calendar (Rabjung) Dates
// ============================================================================

async function exampleRabjungDates() {
  console.log('=== Example 2: Tibetan Calendar (Rabjung) Dates ===\n');

  // Full rabjung date with element and animal
  const date1 = await temporalResolver.resolveDate('fire-dragon year of the 14th rabjung');
  console.log('Input: "fire-dragon year of the 14th rabjung"');
  console.log('Result:', {
    year: date1.year,
    tibetanYear: date1.tibetanYear,
    precision: date1.precision,
    confidence: date1.confidence,
  });
  console.log('Explanation: Rabjung 14 spans 1807-1866. Fire-dragon year within this cycle is 1856.');
  console.log();

  // Just rabjung number (no element/animal)
  const date2 = await temporalResolver.resolveDate('12th rabjung');
  console.log('Input: "12th rabjung"');
  console.log('Result:', {
    year: date2.year,
    precision: date2.precision,
    confidence: date2.confidence,
  });
  console.log('Explanation: Without element/animal, we estimate mid-rabjung (lower confidence).');
  console.log();

  // Show rabjung cycle table
  console.log('Rabjung Cycle Reference:');
  Object.entries(RABJUNG_CYCLES).slice(0, 5).forEach(([num, cycle]) => {
    console.log(`  Rabjung ${num}: ${cycle.start}-${cycle.end}`);
  });
  console.log('  ...');
  console.log();
}

// ============================================================================
// Example 3: Element-Animal Dates
// ============================================================================

async function exampleElementAnimalDates() {
  console.log('=== Example 3: Element-Animal Dates ===\n');

  // Without context year
  const date1 = await temporalResolver.resolveDate('water-horse year');
  console.log('Input: "water-horse year"');
  console.log('Result:', {
    year: date1.year,
    tibetanYear: date1.tibetanYear,
    precision: date1.precision,
    confidence: date1.confidence,
  });
  console.log('Note: Without context, we pick a default occurrence in the cycle.');
  console.log();

  // With context year
  const date2 = await temporalResolver.resolveDate('fire-monkey year', {
    defaultYear: 1200,
  });
  console.log('Input: "fire-monkey year" (context: ~1200)');
  console.log('Result:', {
    year: date2.year,
    tibetanYear: date2.tibetanYear,
    precision: date2.precision,
    confidence: date2.confidence,
  });
  console.log('Note: With context year, we find the nearest 60-year cycle occurrence.');
  console.log();
}

// ============================================================================
// Example 4: Relative Dates
// ============================================================================

async function exampleRelativeDates() {
  console.log('=== Example 4: Relative Dates ===\n');

  // Create mock entity (Marpa)
  const marpa: Entity = {
    id: 'marpa-123',
    type: 'person',
    canonicalName: 'Marpa Lotsawa',
    names: {
      tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
      english: ['Marpa', 'Marpa the Translator'],
      phonetic: ['Marpa Lotsawa'],
      wylie: ['mar pa lo tsA ba'],
    },
    attributes: {
      roles: ['teacher', 'translator'],
      tradition: ['Kagyu'],
    },
    dates: {
      birth: {
        year: 1012,
        precision: 'circa',
        confidence: 0.8,
      },
      death: {
        year: 1097,
        precision: 'circa',
        confidence: 0.85,
      },
    },
    confidence: 0.9,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  // "after X died"
  const date1 = await temporalResolver.resolveDate('after Marpa died', {
    knownEntities: [marpa],
  });
  console.log('Input: "after Marpa died"');
  console.log('Result:', {
    year: date1.year,
    relative: date1.relative,
    referenceEntity: date1.referenceEntity,
    confidence: date1.confidence,
  });
  console.log('Explanation: Marpa died ~1097, so "after" = 1098');
  console.log();

  // "X years after Y died"
  const date2 = await temporalResolver.resolveDate('three years after Marpa died', {
    knownEntities: [marpa],
  });
  console.log('Input: "three years after Marpa died"');
  console.log('Result:', {
    year: date2.year,
    relative: date2.relative,
    confidence: date2.confidence,
  });
  console.log('Explanation: 1097 + 3 = 1100');
  console.log();

  // "at age X"
  const date3 = await temporalResolver.resolveDate('at age 40', {
    knownEntities: [marpa],
  });
  console.log('Input: "at age 40" (in context of Marpa)');
  console.log('Result:', {
    year: date3.year,
    relative: date3.relative,
    confidence: date3.confidence,
  });
  console.log('Explanation: Marpa born 1012, so age 40 = 1052');
  console.log();
}

// ============================================================================
// Example 5: Era-Based Dates
// ============================================================================

async function exampleEraDates() {
  console.log('=== Example 5: Era-Based Dates ===\n');

  // During a reign
  const date1 = await temporalResolver.resolveDate('during the reign of Songsten Gampo');
  console.log('Input: "during the reign of Songsten Gampo"');
  console.log('Result:', {
    year: date1.year,
    era: date1.era,
    precision: date1.precision,
    confidence: date1.confidence,
  });
  console.log();

  // Early/late period modifiers
  const date2 = await temporalResolver.resolveDate('early Sakya period');
  console.log('Input: "early Sakya period"');
  console.log('Result:', {
    year: date2.year,
    era: date2.era,
    precision: date2.precision,
    confidence: date2.confidence,
  });
  console.log();

  const date3 = await temporalResolver.resolveDate('late Phagmodrupa dynasty');
  console.log('Input: "late Phagmodrupa dynasty"');
  console.log('Result:', {
    year: date3.year,
    era: date3.era,
    precision: date3.precision,
    confidence: date3.confidence,
  });
  console.log();

  // Show some eras
  console.log('Sample Era Reference:');
  ERAS.slice(0, 5).forEach(era => {
    console.log(`  ${era.name}: ${era.startYear}-${era.endYear} (${era.type})`);
  });
  console.log('  ...');
  console.log();
}

// ============================================================================
// Example 6: Natural Language Dates
// ============================================================================

async function exampleNaturalLanguageDates() {
  console.log('=== Example 6: Natural Language Dates ===\n');

  // Season + year
  const date1 = await temporalResolver.resolveDate('summer of 1050');
  console.log('Input: "summer of 1050"');
  console.log('Result:', {
    year: date1.year,
    season: date1.season,
    precision: date1.precision,
    confidence: date1.confidence,
  });
  console.log();

  // Century-based
  const date2 = await temporalResolver.resolveDate('mid-11th century');
  console.log('Input: "mid-11th century"');
  console.log('Result:', {
    year: date2.year,
    precision: date2.precision,
    confidence: date2.confidence,
  });
  console.log();

  const date3 = await temporalResolver.resolveDate('early 12th century');
  console.log('Input: "early 12th century"');
  console.log('Result:', {
    year: date3.year,
    precision: date3.precision,
    confidence: date3.confidence,
  });
  console.log();
}

// ============================================================================
// Example 7: Tibetan Calendar Conversion
// ============================================================================

function exampleTibetanConversion() {
  console.log('=== Example 7: Tibetan Calendar Conversion ===\n');

  // Convert rabjung to Gregorian
  const gregorian1 = temporalResolver.convertTibetanToGregorian(
    14, // rabjung 14
    50, // year 50 within rabjung
    'fire',
    'dragon'
  );
  console.log('Rabjung 14, Year 50, Fire-Dragon:');
  console.log('Gregorian Year:', gregorian1);
  console.log();

  // Another example
  const gregorian2 = temporalResolver.convertTibetanToGregorian(
    1, // rabjung 1
    1, // year 1
    'wood',
    'rat'
  );
  console.log('Rabjung 1, Year 1, Wood-Rat:');
  console.log('Gregorian Year:', gregorian2);
  console.log('(This is the start of the rabjung system: 1027 CE)');
  console.log();
}

// ============================================================================
// Example 8: Calculate Age
// ============================================================================

function exampleCalculateAge() {
  console.log('=== Example 8: Calculate Age ===\n');

  const age1 = temporalResolver.calculateAge(1012, 1052);
  console.log('Birth: 1012, Event: 1052');
  console.log('Age:', age1);
  console.log();

  const age2 = temporalResolver.calculateAge(1012, 1097);
  console.log('Birth: 1012, Death: 1097');
  console.log('Age at death:', age2);
  console.log();
}

// ============================================================================
// Example 9: Era Date Ranges
// ============================================================================

function exampleEraDateRanges() {
  console.log('=== Example 9: Era Date Ranges ===\n');

  const range1 = temporalResolver.resolveEraDate('Sakya Period');
  console.log('Era: "Sakya Period"');
  console.log('Date Range:', range1);
  console.log();

  const range2 = temporalResolver.resolveEraDate('Reign of Fifth Dalai Lama');
  console.log('Era: "Reign of Fifth Dalai Lama"');
  console.log('Date Range:', range2);
  console.log();
}

// ============================================================================
// Example 10: Complex Real-World Scenario
// ============================================================================

async function exampleComplexScenario() {
  console.log('=== Example 10: Complex Real-World Scenario ===\n');

  // Scenario: Translating a biography that says:
  // "Milarepa received teachings from Marpa in the water-dragon year,
  //  when he was 38 years old, three years after meeting him at Lhodrak."

  const marpa: Entity = {
    id: 'marpa-123',
    type: 'person',
    canonicalName: 'Marpa Lotsawa',
    names: {
      tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
      english: ['Marpa'],
      phonetic: ['Marpa Lotsawa'],
      wylie: ['mar pa lo tsA ba'],
    },
    attributes: { roles: ['teacher'] },
    dates: {
      birth: { year: 1012, precision: 'circa', confidence: 0.8 },
      death: { year: 1097, precision: 'circa', confidence: 0.85 },
    },
    confidence: 0.9,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  const milarepa: Entity = {
    id: 'milarepa-456',
    type: 'person',
    canonicalName: 'Milarepa',
    names: {
      tibetan: ['མི་ལ་རས་པ།'],
      english: ['Milarepa', 'Mila Repa'],
      phonetic: ['Milarepa'],
      wylie: ['mi la ras pa'],
    },
    attributes: { roles: ['yogi', 'student'] },
    dates: {
      birth: { year: 1052, precision: 'circa', confidence: 0.85 },
      death: { year: 1135, precision: 'circa', confidence: 0.85 },
    },
    confidence: 0.95,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ai',
  };

  console.log('Scenario: Milarepa biography excerpt');
  console.log('Text: "Milarepa received teachings from Marpa in the water-dragon year,');
  console.log('       when he was 38 years old, three years after meeting him."');
  console.log();

  // Step 1: Resolve "water-dragon year" with context
  const teachingDate = await temporalResolver.resolveDate('water-dragon year', {
    defaultYear: 1070, // We know it's around when Milarepa studied
  });
  console.log('Step 1: "water-dragon year" (context: ~1070)');
  console.log('Resolved to:', teachingDate.year);
  console.log();

  // Step 2: Verify with "at age 38"
  const ageDate = await temporalResolver.resolveDate('at age 38', {
    knownEntities: [milarepa],
  });
  console.log('Step 2: "at age 38" (Milarepa born ~1052)');
  console.log('Resolved to:', ageDate.year);
  console.log();

  // Step 3: Cross-check
  console.log('Cross-check:');
  console.log('  Water-dragon year near 1070:', teachingDate.year);
  console.log('  Milarepa age 38:', ageDate.year);
  console.log('  Difference:', Math.abs(teachingDate.year - ageDate.year), 'years');
  console.log();

  if (Math.abs(teachingDate.year - ageDate.year) <= 2) {
    console.log('✓ Dates are consistent! High confidence in 1090 as the teaching year.');
  } else {
    console.log('⚠ Dates diverge. Need to reconcile sources or adjust birth year estimate.');
  }
  console.log();

  // Step 4: Infer meeting date
  console.log('Step 4: "three years after meeting him"');
  console.log('If teaching was in 1090, first meeting was ~1087');
  console.log();
}

// ============================================================================
// Run All Examples
// ============================================================================

export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Temporal Resolution Service - Examples                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();

  await exampleDirectDates();
  await exampleRabjungDates();
  await exampleElementAnimalDates();
  await exampleRelativeDates();
  await exampleEraDates();
  await exampleNaturalLanguageDates();
  exampleTibetanConversion();
  exampleCalculateAge();
  exampleEraDateRanges();
  await exampleComplexScenario();

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    Examples Complete                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
}

// Run if called directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
