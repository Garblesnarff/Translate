/**
 * LLM Relationship Extractor Examples
 *
 * Demonstrates the capabilities of LLM-based relationship extraction
 * for complex scenarios that pattern matching cannot handle.
 */

import { llmRelationshipExtractor } from './LLMRelationshipExtractor';
import type { Entity, PersonEntity } from '../../types/entities';

// ============================================================================
// Example 1: Complex Nested Sentences
// ============================================================================

export async function example1_ComplexNestedSentences() {
  console.log('\n=== Example 1: Complex Nested Sentences ===\n');

  const text = `
    The great translator Marpa, who had studied under Naropa in India for twelve years,
    returned to Tibet where he taught Milarepa, the yogi who would later become famous
    for his songs of realization, at his monastery in Lhodrak.
  `;

  // Known entities from previous extraction
  const knownEntities: Entity[] = [
    {
      id: 'person-001',
      type: 'person',
      canonicalName: 'Marpa Lotsawa',
      names: {
        tibetan: ['མར་པ་ལོ་ཙཱ་བ།'],
        english: ['Marpa', 'Marpa the Translator'],
        wylie: ['mar pa lo tsA ba'],
        phonetic: ['Mar-pa Lo-tsa-wa'],
      },
      attributes: {
        titles: ['Lotsawa'],
        roles: ['translator', 'teacher'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'person-002',
      type: 'person',
      canonicalName: 'Naropa',
      names: {
        tibetan: ['ནཱ་རོ་པ།'],
        english: ['Naropa'],
        wylie: ['nA ro pa'],
        phonetic: ['Na-ro-pa'],
        sanskrit: ['Nāropa'],
      },
      attributes: {
        roles: ['teacher', 'scholar'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'person-003',
      type: 'person',
      canonicalName: 'Milarepa',
      names: {
        tibetan: ['མི་ལ་རས་པ།'],
        english: ['Milarepa', 'Mila Repa'],
        wylie: ['mi la ras pa'],
        phonetic: ['Mi-la-re-pa'],
      },
      attributes: {
        roles: ['yogi', 'poet', 'student'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'place-001',
      type: 'place',
      canonicalName: 'Lhodrak',
      names: {
        tibetan: ['ལྷོ་བྲག'],
        english: ['Lhodrak', 'Lho-drak'],
        wylie: ['lho brag'],
        phonetic: ['Lho-drak'],
      },
      attributes: {
        placeType: 'region',
        region: 'Southern Tibet',
      },
      confidence: 0.9,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
  ];

  const context = {
    knownEntities,
    previousSentences: [],
    metadata: {
      documentId: 'doc-001',
      tradition: 'Kagyu',
      documentType: 'biography',
    },
  };

  const relationships = await llmRelationshipExtractor.extractRelationships(
    text,
    context,
    { minConfidence: 0.7 }
  );

  console.log('Extracted Relationships:');
  relationships.forEach(rel => {
    console.log(`- ${rel.subjectId} ${rel.predicate} ${rel.objectId} (confidence: ${rel.confidence})`);
    console.log(`  Quote: "${rel.sourceQuote}"`);
    console.log();
  });

  // Expected extractions:
  // 1. Marpa student_of Naropa (with duration: 12 years, location: India)
  // 2. Marpa teacher_of Milarepa (location: Lhodrak)
  // 3. Marpa lived_at Lhodrak

  return relationships;
}

// ============================================================================
// Example 2: Pronoun Resolution and Implicit Relationships
// ============================================================================

export async function example2_PronounResolution() {
  console.log('\n=== Example 2: Pronoun Resolution ===\n');

  const previousSentences = [
    "The great master Longchenpa was born in 1308.",
    "He began his studies at a young age at Samye Monastery.",
  ];

  const text = `
    After completing his preliminary training, he traveled to Sangphu to study
    logic and epistemology. The monastery was renowned for its scholarly tradition,
    and he spent five years there mastering the difficult texts.
  `;

  const knownEntities: Entity[] = [
    {
      id: 'person-101',
      type: 'person',
      canonicalName: 'Longchenpa',
      names: {
        tibetan: ['ཀློང་ཆེན་པ།'],
        english: ['Longchenpa', 'Longchen Rabjam'],
        wylie: ['klong chen pa'],
        phonetic: ['Long-chen-pa'],
      },
      attributes: {
        roles: ['scholar', 'teacher'],
        tradition: ['Nyingma'],
        gender: 'male',
      },
      dates: {
        birth: {
          year: 1308,
          precision: 'exact',
          confidence: 0.95,
        },
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'place-101',
      type: 'place',
      canonicalName: 'Sangphu Monastery',
      names: {
        tibetan: ['གསང་ཕུ།'],
        english: ['Sangphu', 'Sangpu'],
        wylie: ['gsang phu'],
        phonetic: ['Sang-pu'],
      },
      attributes: {
        placeType: 'monastery',
        region: 'Ü',
      },
      confidence: 0.9,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
  ];

  const context = {
    knownEntities,
    previousSentences,
    metadata: {
      documentId: 'doc-002',
      tradition: 'Nyingma',
    },
  };

  // First, demonstrate pronoun resolution
  const resolved = await llmRelationshipExtractor.disambiguatePronouns(text, context);

  console.log('Original text:');
  console.log(text);
  console.log('\nResolved text:');
  console.log(resolved.resolved);
  console.log('\nPronoun resolutions:');
  resolved.resolutions.forEach(r => {
    console.log(`- "${r.pronoun}" → "${r.resolvedTo}" (confidence: ${r.confidence})`);
  });

  // Then extract relationships
  const relationships = await llmRelationshipExtractor.extractRelationships(
    text,
    context,
    { resolvePronounReferences: true }
  );

  console.log('\nExtracted Relationships:');
  relationships.forEach(rel => {
    console.log(`- ${rel.subjectId} ${rel.predicate} ${rel.objectId}`);
  });

  // Expected:
  // - "he" resolves to Longchenpa
  // - "the monastery" resolves to Sangphu Monastery
  // - Longchenpa visited Sangphu Monastery (duration: 5 years)

  return { resolved, relationships };
}

// ============================================================================
// Example 3: Authorship and Translation Relationships
// ============================================================================

export async function example3_AuthorshipRelationships() {
  console.log('\n=== Example 3: Authorship Relationships ===\n');

  const text = `
    At the request of his disciples, Tsongkhapa composed the Lamrim Chenmo,
    his great treatise on the stages of the path to enlightenment, which was
    based on Atisha's earlier work, the Bodhipathapradipa. He completed the
    text in 1402 at Ganden Monastery.
  `;

  const knownEntities: Entity[] = [
    {
      id: 'person-201',
      type: 'person',
      canonicalName: 'Tsongkhapa',
      names: {
        tibetan: ['ཙོང་ཁ་པ།'],
        english: ['Tsongkhapa', 'Je Tsongkhapa'],
        wylie: ['tsong kha pa'],
        phonetic: ['Tsong-ka-pa'],
      },
      attributes: {
        roles: ['teacher', 'scholar', 'founder'],
        tradition: ['Gelug'],
        gender: 'male',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'person-202',
      type: 'person',
      canonicalName: 'Atisha',
      names: {
        tibetan: ['ཇོ་བོ་རྗེ་ཨ་ཏི་ཤ།'],
        english: ['Atisha', 'Jowo Atisha'],
        wylie: ['a ti sha'],
        phonetic: ['A-ti-sha'],
        sanskrit: ['Atiśa'],
      },
      attributes: {
        roles: ['teacher', 'translator'],
        tradition: ['Kadam'],
        gender: 'male',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'text-201',
      type: 'text',
      canonicalName: 'Lamrim Chenmo',
      names: {
        tibetan: ['ལམ་རིམ་ཆེན་མོ།'],
        english: ['Lamrim Chenmo', 'The Great Treatise on the Stages of the Path'],
        wylie: ['lam rim chen mo'],
        phonetic: ['Lam-rim Chen-mo'],
      },
      attributes: {
        textType: 'philosophical_treatise',
        language: 'Tibetan',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
    {
      id: 'text-202',
      type: 'text',
      canonicalName: 'Bodhipathapradipa',
      names: {
        tibetan: ['བྱང་ཆུབ་ལམ་གྱི་སྒྲོན་མ།'],
        english: ['Bodhipathapradipa', 'Lamp for the Path to Enlightenment'],
        wylie: ['byang chub lam gyi sgron ma'],
        phonetic: ['Chang-chub Lam-gyi Dron-ma'],
        sanskrit: ['Bodhipathapradīpa'],
      },
      attributes: {
        textType: 'philosophical_treatise',
        language: 'Sanskrit',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
    {
      id: 'place-201',
      type: 'place',
      canonicalName: 'Ganden Monastery',
      names: {
        tibetan: ['དགའ་ལྡན།'],
        english: ['Ganden', 'Gaden'],
        wylie: ['dga\' ldan'],
        phonetic: ['Gan-den'],
      },
      attributes: {
        placeType: 'monastery',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
  ];

  const context = {
    knownEntities,
    previousSentences: [],
    metadata: {
      documentId: 'doc-003',
      tradition: 'Gelug',
    },
  };

  const relationships = await llmRelationshipExtractor.extractRelationships(
    text,
    context,
    { relationshipTypes: ['wrote', 'commentary_on'], minConfidence: 0.7 }
  );

  console.log('Extracted Relationships:');
  relationships.forEach(rel => {
    console.log(`- ${rel.subjectId} ${rel.predicate} ${rel.objectId}`);
    console.log(`  Properties:`, JSON.stringify(rel.properties, null, 2));
    console.log();
  });

  // Expected:
  // 1. Tsongkhapa wrote Lamrim Chenmo (date: 1402, location: Ganden Monastery)
  // 2. Lamrim Chenmo commentary_on Bodhipathapradipa
  // 3. Atisha wrote Bodhipathapradipa (implicit)

  return relationships;
}

// ============================================================================
// Example 4: Temporal and Contextual Relationships
// ============================================================================

export async function example4_TemporalRelationships() {
  console.log('\n=== Example 4: Temporal Relationships ===\n');

  const text = `
    After Marpa's death in 1097, Milarepa spent many years in solitary retreat.
    During this period, while the master was meditating in the cave of Drakar Taso,
    he composed many of his famous songs. These verses, which later became known
    as the Hundred Thousand Songs, expressed the profound realization he had
    attained through his practice.
  `;

  const knownEntities: Entity[] = [
    {
      id: 'person-301',
      type: 'person',
      canonicalName: 'Marpa Lotsawa',
      names: {
        tibetan: ['མར་པ།'],
        english: ['Marpa'],
        wylie: ['mar pa'],
        phonetic: ['Mar-pa'],
      },
      attributes: {
        roles: ['teacher', 'translator'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      dates: {
        death: {
          year: 1097,
          precision: 'exact',
          confidence: 0.9,
        },
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'person-302',
      type: 'person',
      canonicalName: 'Milarepa',
      names: {
        tibetan: ['མི་ལ་རས་པ།'],
        english: ['Milarepa'],
        wylie: ['mi la ras pa'],
        phonetic: ['Mi-la-re-pa'],
      },
      attributes: {
        roles: ['yogi', 'poet'],
        tradition: ['Kagyu'],
        gender: 'male',
      },
      confidence: 0.95,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    } as PersonEntity,
    {
      id: 'place-301',
      type: 'place',
      canonicalName: 'Drakar Taso',
      names: {
        tibetan: ['བྲག་དཀར་རྟ་སོ།'],
        english: ['Drakar Taso', 'White Rock Horse Tooth'],
        wylie: ['brag dkar rta so'],
        phonetic: ['Dra-kar Ta-so'],
      },
      attributes: {
        placeType: 'cave',
      },
      confidence: 0.9,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
    {
      id: 'text-301',
      type: 'text',
      canonicalName: 'Hundred Thousand Songs',
      names: {
        tibetan: ['མགུར་འབུམ།'],
        english: ['Hundred Thousand Songs', 'The Collected Songs of Milarepa'],
        wylie: ['mgur \'bum'],
        phonetic: ['Gur-bum'],
      },
      attributes: {
        textType: 'poetry',
        language: 'Tibetan',
      },
      confidence: 0.9,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'ai',
    },
  ];

  const previousSentences = [
    "Milarepa was the foremost student of Marpa the Translator.",
    "He underwent many trials and hardships during his training.",
  ];

  const context = {
    knownEntities,
    previousSentences,
    metadata: {
      documentId: 'doc-004',
      tradition: 'Kagyu',
    },
  };

  const relationships = await llmRelationshipExtractor.extractRelationships(
    text,
    context,
    { minConfidence: 0.6, resolvePronounReferences: true }
  );

  console.log('Extracted Relationships:');
  relationships.forEach(rel => {
    console.log(`- ${rel.subjectId} ${rel.predicate} ${rel.objectId}`);
    console.log(`  Confidence: ${rel.confidence}`);
    if (rel.properties?.date) {
      console.log(`  Date:`, JSON.stringify(rel.properties.date));
    }
    console.log();
  });

  // Expected:
  // 1. "the master" → resolves to Milarepa (most recent person with role containing meditation practice)
  // 2. Milarepa lived_at Drakar Taso (cave) - with temporal context "after 1097"
  // 3. Milarepa wrote Hundred Thousand Songs
  // 4. Temporal relationship: events occurred "after Marpa's death"

  return relationships;
}

// ============================================================================
// Example 5: Integration with Pattern Extractor
// ============================================================================

export async function example5_PatternLLMIntegration() {
  console.log('\n=== Example 5: Pattern + LLM Integration ===\n');

  // This example shows when to use pattern matching vs LLM

  const simpleText = "Marpa studied under Naropa.";
  const complexText = `
    While Marpa, who had already received teachings from Maitripa,
    was studying in India, he also sought out Naropa, eventually
    spending twelve years under his guidance before returning home.
  `;

  console.log('Simple sentence (use pattern matching):');
  console.log(simpleText);
  console.log('→ Pattern: "X studied under Y" → student_of relationship\n');

  console.log('Complex sentence (use LLM):');
  console.log(complexText);
  console.log('→ Too complex for patterns:');
  console.log('  - Nested clauses ("who had already received...")');
  console.log('  - Multiple relationships (Marpa-Maitripa, Marpa-Naropa)');
  console.log('  - Temporal information ("eventually", "twelve years")');
  console.log('  - Requires context awareness\n');

  // Pattern extractor would identify this as complex and delegate to LLM
  // See PatternExtractor.stub.ts for integration approach

  return {
    strategy: 'Use patterns for simple cases, LLM for complex',
    patternCase: simpleText,
    llmCase: complexText,
  };
}

// ============================================================================
// Run All Examples
// ============================================================================

export async function runAllExamples() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  LLM Relationship Extractor - Comprehensive Examples        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    await example1_ComplexNestedSentences();
    await example2_PronounResolution();
    await example3_AuthorshipRelationships();
    await example4_TemporalRelationships();
    await example5_PatternLLMIntegration();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
  }
}

// Uncomment to run examples:
// runAllExamples();
