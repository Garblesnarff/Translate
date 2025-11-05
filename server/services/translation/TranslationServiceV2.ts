/**
 * TranslationService V2
 *
 * Core translation service that orchestrates the translation workflow:
 * - Check cache for existing translations
 * - Generate enhanced prompts with dictionary and examples
 * - Try providers in priority order
 * - Cache successful results
 * - Batch processing with parallelization
 *
 * @module server/services/translation/TranslationServiceV2
 */

import { hashText } from '../../core/cache/keys.js';
import type {
  TranslationRequest,
  TranslationResult,
  TextChunk,
} from '../../../shared/types.js';
import type {
  TranslationProvider,
  CacheProvider,
} from '../../../tests/utils/mocks.js';

/**
 * Configuration for TranslationService
 */
export interface TranslationServiceConfig {
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  cacheTTL?: number;
  /** Maximum chunks to process in parallel (default: 5) */
  maxParallelChunks?: number;
  /** Enable metrics tracking (default: true) */
  enableMetrics?: boolean;
}

/**
 * Metrics tracked by the service
 */
export interface TranslationMetrics {
  totalTranslations: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number;
  providerUsage: Record<string, number>;
}

/**
 * Dependencies for TranslationService
 */
export interface TranslationServiceDependencies {
  /** Prompt generator service */
  promptGenerator: PromptGeneratorInterface;
  /** Dictionary service */
  dictionaryService?: DictionaryServiceInterface;
  /** Example selector service */
  exampleSelector?: ExampleSelectorInterface;
  /** Translation memory */
  translationMemory?: TranslationMemoryInterface;
}

/**
 * Interface for PromptGenerator
 */
export interface PromptGeneratorInterface {
  generate(
    text: string,
    options?: {
      dictionaryTerms?: any[];
      examples?: any[];
    }
  ): Promise<string>;
}

/**
 * Interface for DictionaryService
 */
export interface DictionaryServiceInterface {
  findRelevantTerms(text: string, limit?: number): Promise<any[]>;
}

/**
 * Interface for ExampleSelector
 */
export interface ExampleSelectorInterface {
  selectBest(text: string, count: number): Promise<any[]>;
}

/**
 * Interface for TranslationMemory
 */
export interface TranslationMemoryInterface {
  findSimilar(text: string, threshold?: number): Promise<TranslationResult | null>;
  save(request: TranslationRequest, result: TranslationResult): Promise<string>;
}

/**
 * TranslationService orchestrates the translation workflow.
 *
 * Flow:
 * 1. Check translation memory (95%+ similarity)
 * 2. Check cache (exact match)
 * 3. Generate enhanced prompt
 * 4. Try providers in priority order
 * 5. Cache successful result
 * 6. Store in translation memory
 *
 * @example
 * ```typescript
 * const service = new TranslationService(
 *   [geminiProvider, claudeProvider],
 *   cache,
 *   {
 *     promptGenerator,
 *     dictionaryService,
 *     exampleSelector,
 *     translationMemory
 *   },
 *   { cacheTTL: 3600, maxParallelChunks: 5 }
 * );
 *
 * const result = await service.translate({
 *   text: "བཀྲ་ཤིས་བདེ་ལེགས།",
 *   options: { temperature: 0.3 }
 * });
 * ```
 */
export class TranslationService {
  private providers: TranslationProvider[];
  private cache: CacheProvider;
  private deps: TranslationServiceDependencies;
  private config: Required<TranslationServiceConfig>;
  private metrics: TranslationMetrics;

  /**
   * Create a new TranslationService
   *
   * @param providers - Array of translation providers (ordered by priority)
   * @param cache - Cache provider for storing results
   * @param dependencies - Service dependencies (prompt generator, dictionary, etc.)
   * @param config - Service configuration
   */
  constructor(
    providers: TranslationProvider[],
    cache: CacheProvider,
    dependencies: TranslationServiceDependencies,
    config: TranslationServiceConfig = {}
  ) {
    this.providers = providers;
    this.cache = cache;
    this.deps = dependencies;
    this.config = {
      cacheTTL: config.cacheTTL ?? 3600,
      maxParallelChunks: config.maxParallelChunks ?? 5,
      enableMetrics: config.enableMetrics ?? true,
    };

    this.metrics = {
      totalTranslations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      providerUsage: {},
    };
  }

  /**
   * Translate a single text request.
   *
   * Flow:
   * 1. Check translation memory (95%+ similarity)
   * 2. Check cache (exact match using text hash)
   * 3. Generate prompt with dictionary terms and examples
   * 4. Try providers in priority order until success
   * 5. Cache result with 1-hour TTL
   * 6. Store in translation memory
   * 7. Update metrics
   *
   * @param request - Translation request with text and options
   * @returns Translation result with confidence and metadata
   * @throws Error if all providers fail
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      // 1. Check translation memory for similar translations (95%+ similarity)
      if (this.deps.translationMemory) {
        const similarTranslation = await this.deps.translationMemory.findSimilar(
          request.text,
          0.95
        );
        if (similarTranslation) {
          this.updateMetrics(startTime, 'memory', true);
          return {
            ...similarTranslation,
            metadata: {
              ...similarTranslation.metadata,
              fromMemory: true,
              cached: true,
              processingTimeMs: Date.now() - startTime,
            },
          };
        }
      }

      // 2. Check cache for exact match
      const cacheKey = this.generateCacheKey(request);
      const cached = await this.cache.get<TranslationResult>(cacheKey);

      if (cached && request.options?.useCache !== false) {
        this.updateMetrics(startTime, cached.metadata.model, true);
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cached: true,
            processingTimeMs: Date.now() - startTime,
          },
        };
      }

      // 3. Generate enhanced prompt
      const prompt = await this.generatePrompt(request);

      // 4. Try providers in priority order
      let lastError: Error | null = null;
      for (const provider of this.providers) {
        try {
          const result = await provider.translate(request.text, prompt);

          // Convert to our standard format
          const translationResult: TranslationResult = {
            translation: result.translation,
            confidence: result.confidence,
            metadata: {
              model: result.metadata?.model || 'unknown',
              cached: false,
              processingTimeMs: Date.now() - startTime,
              tokenCount: this.estimateTokenCount(request.text),
              ...result.metadata,
            },
          };

          // 5. Cache successful result
          await this.cache.set(cacheKey, translationResult, this.config.cacheTTL);

          // 6. Store in translation memory
          if (this.deps.translationMemory) {
            await this.deps.translationMemory.save(request, translationResult);
          }

          // 7. Update metrics
          this.updateMetrics(startTime, translationResult.metadata.model, false);

          return translationResult;
        } catch (error) {
          lastError = error as Error;
          console.error(`Provider failed:`, error);
          continue; // Try next provider
        }
      }

      // All providers failed
      throw new Error(
        `All providers failed. Last error: ${lastError?.message || 'Unknown error'}`
      );
    } catch (error) {
      this.updateMetrics(startTime, 'error', false);
      throw error;
    }
  }

  /**
   * Translate multiple chunks in parallel (batches of 5).
   *
   * Processes chunks in batches to avoid overwhelming the API:
   * - Batch size: 5 chunks (configurable)
   * - Parallel processing within each batch
   * - Cache checking for each chunk
   * - Graceful handling of partial failures
   *
   * @param chunks - Array of text chunks to translate
   * @returns Array of translation results (same order as input)
   */
  async translateBatch(chunks: TextChunk[]): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    const batchSize = this.config.maxParallelChunks;

    // Process in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(chunk =>
        this.translate({
          text: chunk.text,
          metadata: {
            pageNumber: chunk.pageNumber,
            source: `chunk-${chunk.id}`,
          },
        }).catch(error => {
          // Handle individual chunk failures gracefully
          console.error(`Failed to translate chunk ${chunk.id}:`, error);
          return {
            translation: '',
            confidence: 0,
            metadata: {
              model: 'error',
              cached: false,
              processingTimeMs: 0,
              tokenCount: 0,
              error: error.message,
            },
          };
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate an enhanced prompt with dictionary terms and examples.
   *
   * @param request - Translation request
   * @returns Formatted prompt string
   */
  private async generatePrompt(request: TranslationRequest): Promise<string> {
    const options = request.options || {};

    // Get dictionary terms if enabled
    let dictionaryTerms: any[] = [];
    if (options.includeDictionary !== false && this.deps.dictionaryService) {
      dictionaryTerms = await this.deps.dictionaryService.findRelevantTerms(
        request.text,
        20
      );
    }

    // Get relevant examples if enabled
    let examples: any[] = [];
    if (this.deps.exampleSelector) {
      const exampleCount = options.exampleCount ?? 3;
      examples = await this.deps.exampleSelector.selectBest(
        request.text,
        exampleCount
      );
    }

    // Generate prompt using PromptGenerator
    return this.deps.promptGenerator.generate(request.text, {
      dictionaryTerms,
      examples,
    });
  }

  /**
   * Generate a cache key for a translation request.
   *
   * Key includes text and options that affect translation.
   *
   * @param request - Translation request
   * @returns Cache key string
   */
  private generateCacheKey(request: TranslationRequest): string {
    const keyData = {
      text: request.text,
      model: request.options?.model,
      temperature: request.options?.temperature,
      maxTokens: request.options?.maxTokens,
    };

    return `trans:${hashText(JSON.stringify(keyData))}`;
  }

  /**
   * Estimate token count for text (rough approximation).
   *
   * @param text - Input text
   * @returns Estimated token count
   */
  private estimateTokenCount(text: string): number {
    // Rough estimate: ~1 token per 4 characters for Tibetan
    return Math.ceil(text.length / 4);
  }

  /**
   * Update metrics after translation.
   *
   * @param startTime - Translation start timestamp
   * @param model - Model or provider used
   * @param cached - Whether result was cached
   */
  private updateMetrics(
    startTime: number,
    model: string,
    cached: boolean
  ): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalTranslations++;
    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Update average latency
    const latency = Date.now() - startTime;
    const total = this.metrics.totalTranslations;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (total - 1) + latency) / total;

    // Track provider usage
    this.metrics.providerUsage[model] =
      (this.metrics.providerUsage[model] || 0) + 1;
  }

  /**
   * Get current metrics.
   *
   * @returns Current metrics snapshot
   */
  getMetrics(): TranslationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing).
   */
  resetMetrics(): void {
    this.metrics = {
      totalTranslations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      providerUsage: {},
    };
  }
}
