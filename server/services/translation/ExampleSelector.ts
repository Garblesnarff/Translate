import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Translation example structure with embedding support
 */
export interface TranslationExample {
  id: string;
  tibetan: string;
  english: string;
  category: string;
  subcategory?: string;
  complexity: 'simple' | 'medium' | 'complex';
  length: 'short' | 'medium' | 'long';
  keywords?: string[];
  embedding?: number[]; // Semantic vector from Gemini
}

/**
 * Example library with embeddings stored
 */
interface ExampleLibrary {
  examples: TranslationExample[];
  embeddingModel?: string;
  lastUpdated?: string;
}

/**
 * Selection options for filtering and ranking
 */
export interface SelectionOptions {
  count?: number; // Number of examples to return (default: 3)
  categoryFilter?: string; // Filter by category
  ensureDiversity?: boolean; // Ensure diverse categories (default: true)
  minSimilarity?: number; // Minimum similarity threshold (default: 0.3)
  preferCategory?: string; // Prefer examples from this category
}

/**
 * ExampleSelector manages a library of translation examples and selects
 * the most relevant ones for a given input using embedding-based similarity
 */
export class ExampleSelector {
  private examples: TranslationExample[] = [];
  private embeddingModel: GoogleGenerativeAI | null = null;
  private examplesFilePath: string;
  private embeddingsFilePath: string;
  private initialized: boolean = false;

  constructor(apiKey?: string) {
    // Initialize paths
    this.examplesFilePath = path.join(__dirname, '../../data/translation-examples.json');
    this.embeddingsFilePath = path.join(__dirname, '../../data/translation-examples-embeddings.json');

    // Initialize Gemini embedding model if API key provided
    if (apiKey) {
      try {
        this.embeddingModel = new GoogleGenerativeAI(apiKey);
      } catch (error) {
        console.warn('[ExampleSelector] Failed to initialize embedding model:', error);
      }
    }
  }

  /**
   * Initialize the example selector by loading examples and embeddings
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load examples from JSON
      const examplesData = fs.readFileSync(this.examplesFilePath, 'utf-8');
      const parsedExamples: TranslationExample[] = JSON.parse(examplesData);

      // Try to load pre-computed embeddings
      if (fs.existsSync(this.embeddingsFilePath)) {
        const embeddingsData = fs.readFileSync(this.embeddingsFilePath, 'utf-8');
        const library: ExampleLibrary = JSON.parse(embeddingsData);

        // Merge embeddings with examples
        this.examples = parsedExamples.map(example => {
          const withEmbedding = library.examples.find(e => e.id === example.id);
          return {
            ...example,
            embedding: withEmbedding?.embedding
          };
        });

        console.log(`[ExampleSelector] Loaded ${this.examples.length} examples with embeddings`);
      } else {
        // No embeddings file, use examples without embeddings
        this.examples = parsedExamples;
        console.log(`[ExampleSelector] Loaded ${this.examples.length} examples without embeddings`);
        console.log('[ExampleSelector] Run generateEmbeddings() to create embeddings for better selection');
      }

      this.initialized = true;
    } catch (error) {
      console.error('[ExampleSelector] Failed to initialize:', error);
      throw new Error('Failed to load translation examples');
    }
  }

  /**
   * Generate embeddings for all examples using Gemini API
   * This is a one-time operation to populate the embeddings file
   */
  public async generateEmbeddings(apiKey?: string, batchSize: number = 10): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Use provided API key or existing model
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : this.embeddingModel;
    if (!genAI) {
      throw new Error('No API key provided for embedding generation');
    }

    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    console.log(`[ExampleSelector] Generating embeddings for ${this.examples.length} examples...`);
    const startTime = Date.now();
    let processedCount = 0;

    // Process examples in batches to avoid rate limits
    for (let i = 0; i < this.examples.length; i += batchSize) {
      const batch = this.examples.slice(i, i + batchSize);

      await Promise.all(batch.map(async (example) => {
        if (example.embedding) {
          console.log(`[ExampleSelector] Skipping ${example.id} (already has embedding)`);
          return;
        }

        try {
          // Create a rich text representation for embedding
          const textForEmbedding = this.createEmbeddingText(example);

          const result = await embeddingModel.embedContent(textForEmbedding);
          example.embedding = result.embedding.values;

          processedCount++;
          console.log(`[ExampleSelector] Generated embedding for ${example.id} (${processedCount}/${this.examples.length})`);
        } catch (error) {
          console.error(`[ExampleSelector] Failed to generate embedding for ${example.id}:`, error);
        }
      }));

      // Small delay between batches to avoid rate limits
      if (i + batchSize < this.examples.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Save embeddings to file
    const library: ExampleLibrary = {
      examples: this.examples,
      embeddingModel: "text-embedding-004",
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(this.embeddingsFilePath, JSON.stringify(library, null, 2), 'utf-8');

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ExampleSelector] Generated ${processedCount} embeddings in ${elapsedTime}s`);
    console.log(`[ExampleSelector] Saved embeddings to ${this.embeddingsFilePath}`);
  }

  /**
   * Select the most relevant examples for a given input text
   * Uses embedding-based similarity if available, falls back to keyword matching
   */
  public async selectExamples(
    inputText: string,
    options: SelectionOptions = {}
  ): Promise<TranslationExample[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      count = 3,
      categoryFilter,
      ensureDiversity = true,
      minSimilarity = 0.3,
      preferCategory
    } = options;

    // Pre-filter by category if specified
    let candidateExamples = this.examples;
    if (categoryFilter) {
      candidateExamples = candidateExamples.filter(ex => ex.category === categoryFilter);
    }

    if (candidateExamples.length === 0) {
      console.warn(`[ExampleSelector] No examples found for category: ${categoryFilter}`);
      candidateExamples = this.examples;
    }

    // Check if we have embeddings available
    const hasEmbeddings = candidateExamples.some(ex => ex.embedding && ex.embedding.length > 0);

    if (hasEmbeddings && this.embeddingModel) {
      // Use embedding-based selection
      return await this.selectByEmbedding(inputText, candidateExamples, count, ensureDiversity, minSimilarity, preferCategory);
    } else {
      // Fall back to keyword-based selection
      return this.selectByKeywords(inputText, candidateExamples, count, ensureDiversity, preferCategory);
    }
  }

  /**
   * Select examples using embedding-based similarity
   */
  private async selectByEmbedding(
    inputText: string,
    candidates: TranslationExample[],
    count: number,
    ensureDiversity: boolean,
    minSimilarity: number,
    preferCategory?: string
  ): Promise<TranslationExample[]> {
    const startTime = Date.now();

    try {
      // Get embedding for input text
      if (!this.embeddingModel) {
        throw new Error('Embedding model not initialized');
      }

      const embeddingModel = this.embeddingModel.getGenerativeModel({ model: "text-embedding-004" });
      const result = await embeddingModel.embedContent(inputText);
      const inputEmbedding = result.embedding.values;

      // Calculate similarity scores for all candidates
      const scoredExamples = candidates
        .filter(ex => ex.embedding && ex.embedding.length > 0)
        .map(example => {
          const similarity = this.cosineSimilarity(inputEmbedding, example.embedding!);

          // Boost score if it's in the preferred category
          let adjustedSimilarity = similarity;
          if (preferCategory && example.category === preferCategory) {
            adjustedSimilarity *= 1.2; // 20% boost
          }

          return {
            example,
            similarity: adjustedSimilarity,
            originalSimilarity: similarity
          };
        })
        .filter(scored => scored.originalSimilarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity);

      if (scoredExamples.length === 0) {
        console.warn('[ExampleSelector] No examples met similarity threshold, falling back to keywords');
        return this.selectByKeywords(inputText, candidates, count, ensureDiversity, preferCategory);
      }

      // Select examples with diversity if requested
      let selectedExamples: TranslationExample[];
      if (ensureDiversity) {
        selectedExamples = this.selectDiverseExamples(scoredExamples, count);
      } else {
        selectedExamples = scoredExamples.slice(0, count).map(scored => scored.example);
      }

      const elapsedTime = Date.now() - startTime;
      console.log(`[ExampleSelector] Selected ${selectedExamples.length} examples using embeddings in ${elapsedTime}ms`);

      return selectedExamples;
    } catch (error) {
      console.error('[ExampleSelector] Embedding-based selection failed:', error);
      // Fall back to keyword-based selection
      return this.selectByKeywords(inputText, candidates, count, ensureDiversity, preferCategory);
    }
  }

  /**
   * Select examples using keyword matching (fallback method)
   */
  private selectByKeywords(
    inputText: string,
    candidates: TranslationExample[],
    count: number,
    ensureDiversity: boolean,
    preferCategory?: string
  ): TranslationExample[] {
    const startTime = Date.now();

    // Extract keywords from input (simple approach: use all significant words)
    const inputKeywords = this.extractKeywords(inputText);

    // Score examples based on keyword overlap
    const scoredExamples = candidates.map(example => {
      const exampleKeywords = example.keywords || this.extractKeywords(example.tibetan);
      const overlap = inputKeywords.filter(kw => exampleKeywords.includes(kw)).length;
      const score = overlap / Math.max(inputKeywords.length, 1);

      // Boost score if it's in the preferred category
      let adjustedScore = score;
      if (preferCategory && example.category === preferCategory) {
        adjustedScore *= 1.2;
      }

      return {
        example,
        similarity: adjustedScore,
        originalSimilarity: score
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

    // Select examples with diversity if requested
    let selectedExamples: TranslationExample[];
    if (ensureDiversity) {
      selectedExamples = this.selectDiverseExamples(scoredExamples, count);
    } else {
      selectedExamples = scoredExamples.slice(0, count).map(scored => scored.example);
    }

    // If no good matches, select diverse examples from different categories
    if (selectedExamples.length === 0 || scoredExamples[0].similarity === 0) {
      selectedExamples = this.selectDefaultExamples(candidates, count);
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`[ExampleSelector] Selected ${selectedExamples.length} examples using keywords in ${elapsedTime}ms`);

    return selectedExamples;
  }

  /**
   * Select diverse examples from scored list
   * Ensures not all examples come from the same category
   */
  private selectDiverseExamples(
    scoredExamples: Array<{ example: TranslationExample; similarity: number }>,
    count: number
  ): TranslationExample[] {
    const selected: TranslationExample[] = [];
    const usedCategories = new Set<string>();
    const maxPerCategory = Math.ceil(count / 2); // Allow at most half from same category

    // First pass: select top examples with diversity constraint
    for (const scored of scoredExamples) {
      if (selected.length >= count) break;

      const categoryCount = selected.filter(ex => ex.category === scored.example.category).length;
      if (categoryCount < maxPerCategory) {
        selected.push(scored.example);
        usedCategories.add(scored.example.category);
      }
    }

    // Second pass: fill remaining slots if needed
    if (selected.length < count) {
      for (const scored of scoredExamples) {
        if (selected.length >= count) break;
        if (!selected.find(ex => ex.id === scored.example.id)) {
          selected.push(scored.example);
        }
      }
    }

    return selected;
  }

  /**
   * Select default examples when no good matches found
   * Returns diverse examples from different categories
   */
  private selectDefaultExamples(
    candidates: TranslationExample[],
    count: number
  ): TranslationExample[] {
    const categories = [...new Set(candidates.map(ex => ex.category))];
    const selected: TranslationExample[] = [];

    // Select one example from each category (round-robin)
    for (let i = 0; i < count && categories.length > 0; i++) {
      const category = categories[i % categories.length];
      const example = candidates.find(ex => ex.category === category && !selected.includes(ex));
      if (example) {
        selected.push(example);
      }
    }

    return selected;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Extract keywords from text for keyword-based matching
   */
  private extractKeywords(text: string): string[] {
    // Simple approach: extract Tibetan words and common English terms
    // In a production system, this would use proper tokenization

    // Extract Tibetan syllables (separated by tsek ་)
    const tibetanWords = text
      .split(/[་།\s]+/)
      .filter(word => word.trim().length > 0 && /[\u0F00-\u0FFF]/.test(word));

    return tibetanWords;
  }

  /**
   * Create rich text representation for embedding
   * Includes Tibetan, English, category, and keywords
   */
  private createEmbeddingText(example: TranslationExample): string {
    const parts = [
      `Tibetan: ${example.tibetan}`,
      `English: ${example.english}`,
      `Category: ${example.category}`,
    ];

    if (example.subcategory) {
      parts.push(`Subcategory: ${example.subcategory}`);
    }

    if (example.keywords && example.keywords.length > 0) {
      parts.push(`Keywords: ${example.keywords.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Get statistics about the example library
   */
  public getStatistics(): {
    totalExamples: number;
    examplesWithEmbeddings: number;
    categoryCounts: Record<string, number>;
    complexityCounts: Record<string, number>;
  } {
    const categoryCounts: Record<string, number> = {};
    const complexityCounts: Record<string, number> = {};

    for (const example of this.examples) {
      categoryCounts[example.category] = (categoryCounts[example.category] || 0) + 1;
      complexityCounts[example.complexity] = (complexityCounts[example.complexity] || 0) + 1;
    }

    return {
      totalExamples: this.examples.length,
      examplesWithEmbeddings: this.examples.filter(ex => ex.embedding).length,
      categoryCounts,
      complexityCounts
    };
  }

  /**
   * Get all examples (for testing/debugging)
   */
  public getAllExamples(): TranslationExample[] {
    return [...this.examples];
  }
}
