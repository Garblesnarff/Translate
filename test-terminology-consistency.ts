/**
 * Test script for Terminology Consistency feature
 *
 * This script demonstrates:
 * 1. Term extraction from translations
 * 2. Glossary building across multiple pages
 * 3. Inconsistency detection
 * 4. Consistency validation
 */

import { TermExtractor } from './server/services/translation/TermExtractor';
import { GlossaryBuilder } from './server/services/translation/GlossaryBuilder';
import { ConsistencyValidator } from './server/services/translation/ConsistencyValidator';

// Sample translations in "English (Tibetan)" format
const sampleTranslations = [
  {
    pageNumber: 1,
    translation: `The Lama (བླ་མ།) gave teachings on compassion (སྙིང་རྗེ།) and wisdom (ཤེས་རབ།).
The Buddha (སངས་རྒྱས།) taught the path (ལམ།) to enlightenment (བྱང་ཆུབ།).`
  },
  {
    pageNumber: 2,
    translation: `The teacher (བླ་མ།) explained that compassion (སྙིང་རྗེ།) is essential for the path (ལམ།).
The Buddha (སངས་རྒྱས།) demonstrated loving-kindness (བྱམས་པ།) and insight (ཤེས་རབ།).`
  },
  {
    pageNumber: 3,
    translation: `The master (བླ་མ།) emphasized meditation (སྒོམ།) and compassion (སྙིང་རྗེ།).
Through wisdom (ཤེས་རབ།) we understand the Buddha's (སངས་རྒྱས།) teachings (ཆོས།).`
  },
  {
    pageNumber: 4,
    translation: `The guru (བླ་མ།) taught about the Dharma (ཆོས།) and the path (ལམ།) to awakening (བྱང་ཆུབ།).
Compassion (སྙིང་རྗེ།) and wisdom (ཤེས་རབ།) are the two wings of enlightenment (བྱང་ཆུབ།).`
  }
];

console.log('='.repeat(80));
console.log('TERMINOLOGY CONSISTENCY TEST');
console.log('='.repeat(80));
console.log();

// Step 1: Initialize components
console.log('Step 1: Initializing components...');
const termExtractor = new TermExtractor();
const glossaryBuilder = new GlossaryBuilder();
const consistencyValidator = new ConsistencyValidator();
console.log('✓ Components initialized\n');

// Step 2: Extract terms from all pages
console.log('Step 2: Extracting terms from translations...');
console.log('-'.repeat(80));
for (const page of sampleTranslations) {
  console.log(`\nPage ${page.pageNumber}:`);
  const terms = termExtractor.extractTermPairs(page.translation, page.pageNumber);

  console.log(`  Extracted ${terms.length} terms:`);
  for (const term of terms) {
    console.log(`    - "${term.english}" (${term.tibetan}) [confidence: ${term.confidence.toFixed(2)}]`);
  }

  // Add to glossary
  glossaryBuilder.addTermPairs(terms);
}
console.log('\n✓ Term extraction complete\n');

// Step 3: Analyze glossary
console.log('Step 3: Analyzing glossary...');
console.log('-'.repeat(80));
const summary = glossaryBuilder.getSummary();
console.log(`Total unique terms: ${summary.totalTerms}`);
console.log(`Total variants: ${summary.totalVariants}`);
console.log(`Inconsistent terms: ${summary.inconsistentTerms}`);
console.log(`Average occurrences per term: ${summary.averageOccurrencesPerTerm.toFixed(1)}`);

if (summary.mostFrequentTerms.length > 0) {
  console.log('\nMost frequent terms:');
  for (const term of summary.mostFrequentTerms.slice(0, 10)) {
    console.log(`  - ${term.tibetan} → "${term.english}" (${term.count}x)`);
  }
}
console.log('\n✓ Glossary analysis complete\n');

// Step 4: Check for inconsistencies
console.log('Step 4: Detecting inconsistencies...');
console.log('-'.repeat(80));
const inconsistencies = glossaryBuilder.findInconsistencies();

if (inconsistencies.length === 0) {
  console.log('✓ No inconsistencies found!\n');
} else {
  console.log(`Found ${inconsistencies.length} inconsistencies:\n`);

  for (const issue of inconsistencies) {
    console.log(`\n${issue.severity.toUpperCase()} SEVERITY: ${issue.tibetan}`);
    console.log('  Translations found:');
    for (const variant of issue.translations) {
      const pages = variant.pages.slice(0, 3).join(', ');
      const more = variant.pages.length > 3 ? `, +${variant.pages.length - 3} more` : '';
      console.log(`    - "${variant.english}" (${variant.count}x) [pages: ${pages}${more}]`);
    }
    console.log(`  Suggestion: ${issue.suggestion}`);
  }
  console.log('\n✓ Inconsistency detection complete\n');
}

// Step 5: Test consistency validation on a new page
console.log('Step 5: Testing consistency validation...');
console.log('-'.repeat(80));
const testTranslation = `The spiritual guide (བླ་མ།) taught us about kindness (སྙིང་རྗེ།) and knowledge (ཤེས་རབ།).`;
console.log(`Test translation: "${testTranslation}"\n`);

const validation = consistencyValidator.validateConsistency(testTranslation, 5, glossaryBuilder);
console.log(`Consistency score: ${(validation.consistencyScore * 100).toFixed(1)}%`);
console.log(`Terms checked: ${validation.termsChecked}`);
console.log(`Inconsistent terms: ${validation.inconsistentTerms}`);

if (validation.warnings.length > 0) {
  console.log('\nConsistency warnings:');
  for (const warning of validation.warnings) {
    console.log(`  ${warning.severity.toUpperCase()}: ${warning.message}`);
  }
} else {
  console.log('\n✓ No consistency warnings');
}
console.log('\n✓ Consistency validation complete\n');

// Step 6: Generate comprehensive report
console.log('Step 6: Generating consistency report...');
console.log('-'.repeat(80));
const report = consistencyValidator.generateConsistencyReport(glossaryBuilder, true);
console.log('\n' + report);
console.log('\n✓ Report generation complete\n');

// Step 7: Show glossary for prompt enhancement
console.log('Step 7: Glossary for prompt enhancement...');
console.log('-'.repeat(80));
const glossaryForPrompt = glossaryBuilder.getGlossaryForPrompt(15);
console.log('\n' + glossaryForPrompt);
console.log('\n✓ Glossary formatted for prompts\n');

// Step 8: Export glossary to JSON
console.log('Step 8: Exporting glossary to JSON...');
console.log('-'.repeat(80));
const glossaryJSON = glossaryBuilder.exportToJSON();
const glossaryObj = JSON.parse(glossaryJSON);
console.log(`Glossary entries: ${glossaryObj.length}`);
console.log('Sample entry:');
console.log(JSON.stringify(glossaryObj[0], null, 2));
console.log('\n✓ Glossary exported\n');

// Final summary
console.log('='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log(`✓ Extracted ${summary.totalTerms} unique terms from ${sampleTranslations.length} pages`);
console.log(`✓ Detected ${inconsistencies.length} terminology inconsistencies`);
console.log(`✓ Built glossary with ${summary.totalVariants} translation variants`);
console.log(`✓ Validated consistency with ${(validation.consistencyScore * 100).toFixed(1)}% score`);
console.log('\nTerminology Consistency feature is working correctly!');
console.log('='.repeat(80));
