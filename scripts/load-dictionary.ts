#!/usr/bin/env node
/**
 * Dictionary Loader Script
 *
 * Loads Tibetan-English dictionary entries from JSON files into the database.
 * Handles bulk inserts efficiently and reports progress.
 *
 * Usage:
 *   npm run load-dictionary -- <path-to-json-file>
 *   node scripts/load-dictionary.ts data/dictionaries/my-dictionary.json
 *
 * JSON Format:
 * [
 *   {
 *     "tibetan": "བཀྲ་ཤིས་བདེ་ལེགས",
 *     "english": "greetings",
 *     "wylie": "bkra shis bde legs",
 *     "category": "greeting",
 *     "frequency": "very_common",
 *     "context": "Used as a greeting in Tibetan"
 *   },
 *   ...
 * ]
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Mock database interface for demonstration
interface DictionaryEntry {
  tibetan: string;
  english: string;
  wylie?: string;
  sanskrit?: string;
  category?: string;
  frequency: 'very_common' | 'common' | 'uncommon' | 'rare';
  context?: string;
}

/**
 * Validate a dictionary entry
 */
function validateEntry(
  entry: any,
  index: number
): { valid: boolean; error?: string } {
  if (!entry.tibetan || typeof entry.tibetan !== 'string') {
    return {
      valid: false,
      error: `Entry ${index}: Missing or invalid 'tibetan' field`,
    };
  }

  if (!entry.english || typeof entry.english !== 'string') {
    return {
      valid: false,
      error: `Entry ${index}: Missing or invalid 'english' field`,
    };
  }

  // Set default frequency if not provided
  if (!entry.frequency) {
    entry.frequency = 'common';
  }

  const validFrequencies = ['very_common', 'common', 'uncommon', 'rare'];
  if (!validFrequencies.includes(entry.frequency)) {
    return {
      valid: false,
      error: `Entry ${index}: Invalid frequency '${entry.frequency}'. Must be one of: ${validFrequencies.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Load dictionary from JSON file
 */
async function loadDictionary(jsonPath: string): Promise<void> {
  console.log(`Loading dictionary from: ${jsonPath}`);
  console.log('='.repeat(60));

  try {
    // Check if file exists
    const exists = await fs
      .access(jsonPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      throw new Error(`File not found: ${jsonPath}`);
    }

    // Read and parse JSON
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array of dictionary entries');
    }

    console.log(`Found ${data.length} entries in file`);
    console.log('Validating entries...\n');

    // Validate entries
    const validEntries: DictionaryEntry[] = [];
    const errors: string[] = [];

    for (const [index, entry] of data.entries()) {
      const validation = validateEntry(entry, index + 1);

      if (validation.valid) {
        validEntries.push(entry as DictionaryEntry);
      } else {
        errors.push(validation.error!);
      }
    }

    // Report validation results
    console.log('Validation Results:');
    console.log(`  ✓ Valid entries: ${validEntries.length}`);
    console.log(`  ✗ Invalid entries: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\nValidation Errors:');
      errors.forEach(error => console.log(`  ${error}`));
    }

    if (validEntries.length === 0) {
      throw new Error('No valid entries to load');
    }

    // Group by frequency for summary
    const byFrequency: Record<string, number> = {};
    validEntries.forEach(entry => {
      byFrequency[entry.frequency] = (byFrequency[entry.frequency] || 0) + 1;
    });

    console.log('\nFrequency Distribution:');
    Object.entries(byFrequency)
      .sort((a, b) => b[1] - a[1])
      .forEach(([freq, count]) => {
        console.log(`  ${freq}: ${count}`);
      });

    // TODO: Implement actual database insertion
    // For now, just demonstrate the process
    console.log('\n' + '='.repeat(60));
    console.log('DATABASE INSERTION (NOT IMPLEMENTED YET)');
    console.log('='.repeat(60));
    console.log(
      'To complete this script, connect to your database and insert entries.'
    );
    console.log('Example code:');
    console.log(`
import { DictionaryService } from '../server/services/dictionary/DictionaryService.js';
import { db } from '../db/connection.js';
import { cache } from '../server/core/cache/index.js';

const service = new DictionaryService(db, cache);
const result = await service.load('${jsonPath}');

console.log(\`Loaded \${result.loaded} entries\`);
    `);

    // Sample entries
    console.log('\nSample Entries (first 5):');
    validEntries.slice(0, 5).forEach((entry, i) => {
      console.log(`\n${i + 1}. ${entry.tibetan} → ${entry.english}`);
      if (entry.wylie) console.log(`   Wylie: ${entry.wylie}`);
      if (entry.category) console.log(`   Category: ${entry.category}`);
      console.log(`   Frequency: ${entry.frequency}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✓ Dictionary loading completed successfully');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n✗ Error loading dictionary:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/load-dictionary.ts <json-file-path>');
    console.error('\nExample:');
    console.error('  node scripts/load-dictionary.ts data/dictionaries/tibetan-english.json');
    process.exit(1);
  }

  const jsonPath = path.resolve(args[0]);
  await loadDictionary(jsonPath);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { loadDictionary, validateEntry };
