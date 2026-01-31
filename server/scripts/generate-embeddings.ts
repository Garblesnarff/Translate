#!/usr/bin/env tsx

/**
 * Script to generate embeddings for all translation examples
 * Run with: npx tsx server/scripts/generate-embeddings.ts
 *
 * Requires GEMINI_API_KEY environment variable
 */

import { ExampleSelector } from '../services/translation/ExampleSelector';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('=== Translation Example Embeddings Generator ===\n');

  // Get API key from environment
  const apiKey = process.env.GEMINI_API_KEY_ODD || process.env.GEMINI_API_KEY_EVEN;

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY_ODD or GEMINI_API_KEY_EVEN environment variable required');
    console.error('Usage: GEMINI_API_KEY_ODD=your_key npx tsx server/scripts/generate-embeddings.ts');
    process.exit(1);
  }

  try {
    // Initialize selector
    console.log('Initializing ExampleSelector...');
    const selector = new ExampleSelector(apiKey);
    await selector.initialize();

    // Display current statistics
    const stats = selector.getStatistics();
    console.log('\nCurrent Statistics:');
    console.log(`- Total examples: ${stats.totalExamples}`);
    console.log(`- Examples with embeddings: ${stats.examplesWithEmbeddings}`);
    console.log(`- Missing embeddings: ${stats.totalExamples - stats.examplesWithEmbeddings}`);
    console.log('\nExamples by category:');
    Object.entries(stats.categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });

    // Generate embeddings if needed
    if (stats.examplesWithEmbeddings < stats.totalExamples) {
      console.log('\n' + '='.repeat(50));
      console.log('Generating embeddings for examples...');
      console.log('This may take several minutes depending on the number of examples.');
      console.log('='.repeat(50) + '\n');

      await selector.generateEmbeddings(apiKey, 5); // Process 5 at a time to avoid rate limits

      // Display updated statistics
      const updatedStats = selector.getStatistics();
      console.log('\n' + '='.repeat(50));
      console.log('Generation Complete!');
      console.log('='.repeat(50));
      console.log(`\nTotal examples: ${updatedStats.totalExamples}`);
      console.log(`Examples with embeddings: ${updatedStats.examplesWithEmbeddings}`);
      console.log(`Success rate: ${((updatedStats.examplesWithEmbeddings / updatedStats.totalExamples) * 100).toFixed(1)}%`);
    } else {
      console.log('\n✓ All examples already have embeddings!');
    }

    console.log('\nDone! The embeddings have been saved to:');
    console.log('  server/data/translation-examples-embeddings.json');

  } catch (error) {
    console.error('\n✗ Error generating embeddings:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
