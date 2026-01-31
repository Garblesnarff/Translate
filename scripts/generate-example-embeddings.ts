#!/usr/bin/env node
/**
 * Example Embeddings Generator
 *
 * Generates embeddings for translation examples to enable semantic similarity search.
 * Processes examples in batches and saves to a new JSON file with embeddings.
 *
 * Usage:
 *   npm run generate-embeddings
 *   node scripts/generate-example-embeddings.ts
 *
 * Input:  data/translation-examples.json
 * Output: data/translation-examples-with-embeddings.json
 *
 * Input JSON Format:
 * [
 *   {
 *     "id": "ex-1",
 *     "tibetan": "བཀྲ་ཤིས་བདེ་ལེགས།",
 *     "english": "Greetings",
 *     "category": "greeting"
 *   },
 *   ...
 * ]
 *
 * Output JSON Format (adds 'embedding' field):
 * [
 *   {
 *     "id": "ex-1",
 *     "tibetan": "བཀྲ་ཤིས་བདེ་ལེགས།",
 *     "english": "Greetings",
 *     "category": "greeting",
 *     "embedding": [0.123, -0.456, 0.789, ...]  // 768-dimensional vector
 *   },
 *   ...
 * ]
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Mock embedding provider interface for demonstration
interface EmbeddingProvider {
  getEmbedding(text: string): Promise<number[]>;
  getBatchEmbeddings(texts: string[]): Promise<number[][]>;
  dimension: number;
}

interface TranslationExample {
  id: string;
  tibetan: string;
  english: string;
  category: string;
  embedding?: number[];
}

/**
 * Mock embedding provider for testing
 * In production, replace with actual Gemini/OpenAI embedding API
 */
class MockEmbeddingProvider implements EmbeddingProvider {
  dimension = 768;

  async getEmbedding(text: string): Promise<number[]> {
    // Generate deterministic fake embedding for demonstration
    const hash = this.hashString(text);
    return Array(this.dimension)
      .fill(0)
      .map((_, i) => Math.sin((i + 1) * hash) * 0.5 + 0.5);
  }

  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.getEmbedding(text)));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) / Math.pow(2, 31);
  }
}

/**
 * Generate embeddings for all examples
 */
async function generateEmbeddings(
  inputPath: string,
  outputPath: string,
  provider: EmbeddingProvider
): Promise<void> {
  console.log('Translation Example Embeddings Generator');
  console.log('='.repeat(60));
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log('='.repeat(60));
  console.log();

  try {
    // Read input file
    console.log('Reading input file...');
    const content = await fs.readFile(inputPath, 'utf-8');
    const examples: TranslationExample[] = JSON.parse(content);

    if (!Array.isArray(examples)) {
      throw new Error('Input file must contain an array of examples');
    }

    console.log(`Found ${examples.length} examples`);
    console.log();

    // Group by category for stats
    const byCategory: Record<string, number> = {};
    examples.forEach(ex => {
      byCategory[ex.category] = (byCategory[ex.category] || 0) + 1;
    });

    console.log('Category Distribution:');
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
    console.log();

    // Process in batches
    const BATCH_SIZE = 10;
    const examplesWithEmbeddings: TranslationExample[] = [];
    let processed = 0;

    console.log(`Generating embeddings (batch size: ${BATCH_SIZE})...`);
    console.log();

    for (let i = 0; i < examples.length; i += BATCH_SIZE) {
      const batch = examples.slice(i, i + BATCH_SIZE);
      const texts = batch.map(ex => ex.tibetan);

      // Generate embeddings for batch
      const embeddings = await provider.getBatchEmbeddings(texts);

      // Add embeddings to examples
      batch.forEach((example, index) => {
        examplesWithEmbeddings.push({
          ...example,
          embedding: embeddings[index],
        });
      });

      processed += batch.length;
      const percent = ((processed / examples.length) * 100).toFixed(1);
      process.stdout.write(`  Progress: ${processed}/${examples.length} (${percent}%)\r`);
    }

    console.log();
    console.log();

    // Verify embeddings
    const withEmbeddings = examplesWithEmbeddings.filter(ex => ex.embedding);
    console.log('Verification:');
    console.log(`  ✓ Examples with embeddings: ${withEmbeddings.length}`);
    console.log(`  ✓ Embedding dimension: ${provider.dimension}`);
    console.log();

    // Save to output file
    console.log('Writing output file...');
    await fs.writeFile(
      outputPath,
      JSON.stringify(examplesWithEmbeddings, null, 2),
      'utf-8'
    );

    // File size comparison
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    console.log();
    console.log('File Size:');
    console.log(`  Input:  ${formatBytes(inputStats.size)}`);
    console.log(`  Output: ${formatBytes(outputStats.size)}`);
    console.log(`  Ratio:  ${(outputStats.size / inputStats.size).toFixed(1)}x`);
    console.log();

    // Sample embedding
    console.log('Sample Example (with embedding):');
    const sample = examplesWithEmbeddings[0];
    console.log(`  ID: ${sample.id}`);
    console.log(`  Tibetan: ${sample.tibetan}`);
    console.log(`  English: ${sample.english}`);
    console.log(`  Category: ${sample.category}`);
    console.log(`  Embedding: [${sample.embedding!.slice(0, 5).map(v => v.toFixed(3)).join(', ')}, ...]`);
    console.log(`  Embedding length: ${sample.embedding!.length}`);
    console.log();

    console.log('='.repeat(60));
    console.log('✓ Embeddings generated successfully');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n✗ Error generating embeddings:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main entry point
 */
async function main() {
  // Default paths
  const dataDir = path.resolve(process.cwd(), 'data');
  const inputPath = path.join(dataDir, 'translation-examples.json');
  const outputPath = path.join(dataDir, 'translation-examples-with-embeddings.json');

  // Check if input file exists
  const exists = await fs
    .access(inputPath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    console.error(`Error: Input file not found: ${inputPath}`);
    console.error();
    console.error('Please create a translation examples file at:');
    console.error(`  ${inputPath}`);
    console.error();
    console.error('Example format:');
    console.error(`[
  {
    "id": "ex-1",
    "tibetan": "བཀྲ་ཤིས་བདེ་ལེགས།",
    "english": "Greetings",
    "category": "greeting"
  },
  {
    "id": "ex-2",
    "tibetan": "ཐུགས་རྗེ་ཆེ།",
    "english": "Thank you",
    "category": "greeting"
  }
]`);
    process.exit(1);
  }

  // Create mock embedding provider
  // TODO: Replace with actual embedding provider (Gemini, OpenAI, etc.)
  const provider = new MockEmbeddingProvider();

  console.log('NOTE: Using mock embedding provider for demonstration.');
  console.log('In production, replace with actual Gemini/OpenAI API.');
  console.log();

  await generateEmbeddings(inputPath, outputPath, provider);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateEmbeddings, MockEmbeddingProvider };
