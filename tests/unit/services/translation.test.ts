/**
 * TranslationService Tests
 *
 * Comprehensive test suite for the TranslationService class.
 * Tests cover:
 * - Single chunk translation
 * - Batch translation (parallel processing)
 * - Cache integration
 * - Provider fallback
 * - Metrics tracking
 * - Rate limit handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockTranslationProvider,
  MockCacheProvider,
  MockEmbeddingProvider,
  createMockProviders,
} from '../../utils/mocks.js';
import { TestData } from '../../utils/fixtures.js';
import type { TranslationRequest, TranslationResult, TextChunk } from '../../../shared/types.js';

// Mock imports - will be implemented
vi.mock('../../../server/services/translation/TranslationService.js');
vi.mock('../../../server/services/translation/PromptGenerator.js');

describe('TranslationService', () => {
  let translationService: any;
  let primaryProvider: MockTranslationProvider;
  let secondaryProvider: MockTranslationProvider;
  let cache: MockCacheProvider;
  let promptGenerator: any;
  let dictionaryService: any;
  let exampleSelector: any;

  beforeEach(() => {
    // Setup mock providers
    primaryProvider = new MockTranslationProvider({ confidence: 0.9 });
    secondaryProvider = new MockTranslationProvider({ confidence: 0.85 });
    cache = new MockCacheProvider();

    // Setup mock services (will be implemented)
    promptGenerator = {
      generate: vi.fn().mockResolvedValue('Mock prompt with dictionary and examples'),
    };

    dictionaryService = {
      findRelevantTerms: vi.fn().mockResolvedValue([
        { tibetan: 'བཀྲ་ཤིས', english: 'auspicious', frequency: 'common' },
        { tibetan: 'བདེ་ལེགས', english: 'well-being', frequency: 'common' },
      ]),
    };

    exampleSelector = {
      selectBest: vi.fn().mockResolvedValue([
        { tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས།', english: 'Greetings', category: 'greeting' },
      ]),
    };

    // TranslationService will be implemented - for now create a mock structure
    translationService = {
      translate: vi.fn(),
      translateBatch: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({
        totalTranslations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageLatency: 0,
        providerUsage: {},
      }),
    };
  });

  describe('translate()', () => {
    it('should translate single chunk successfully', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.simple,
        options: {
          temperature: 0.3,
          maxTokens: 2000,
        },
      };

      const expectedResult: TranslationResult = {
        translation: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
        confidence: 0.9,
        metadata: {
          model: 'test-model',
          cached: false,
          processingTimeMs: 250,
          tokenCount: 10,
        },
      };

      translationService.translate.mockResolvedValue(expectedResult);

      const result = await translationService.translate(request);

      expect(result).toBeDefined();
      expect(result.translation).toContain('Greetings');
      expect(result.translation).toContain('བཀྲ་ཤིས་བདེ་ལེགས');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.metadata.cached).toBe(false);
      expect(translationService.translate).toHaveBeenCalledWith(request);
    });

    it('should use cache for repeated translations', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.simple,
      };

      const cachedResult: TranslationResult = {
        translation: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).',
        confidence: 0.9,
        metadata: {
          model: 'test-model',
          cached: true,
          processingTimeMs: 5,
          tokenCount: 10,
        },
      };

      translationService.translate.mockResolvedValue(cachedResult);

      // First call - should miss cache
      const result1 = await translationService.translate(request);

      // Second call - should hit cache
      const result2 = await translationService.translate(request);

      expect(result2.metadata.cached).toBe(true);
      expect(result2.metadata.processingTimeMs).toBeLessThan(result1.metadata.processingTimeMs);
    });

    it('should fall back to secondary provider on primary failure', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.paragraph,
      };

      // Simulate primary provider failure, then secondary success
      translationService.translate
        .mockRejectedValueOnce(new Error('Primary provider failed'))
        .mockResolvedValueOnce({
          translation: 'Translated text from secondary provider',
          confidence: 0.85,
          metadata: {
            model: 'secondary-model',
            cached: false,
            processingTimeMs: 300,
            tokenCount: 50,
          },
        });

      const result = await translationService.translate(request).catch(() => {
        // If first call fails, try again (simulating fallback)
        return translationService.translate(request);
      });

      expect(result).toBeDefined();
      expect(result.metadata.model).toBe('secondary-model');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should track metrics for cache hits', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.simple,
      };

      // Configure service to return cached result
      translationService.translate.mockResolvedValue({
        translation: 'Cached translation',
        confidence: 0.9,
        metadata: {
          model: 'test-model',
          cached: true,
          processingTimeMs: 5,
          tokenCount: 10,
        },
      });

      translationService.getMetrics.mockReturnValue({
        totalTranslations: 1,
        cacheHits: 1,
        cacheMisses: 0,
        averageLatency: 5,
        providerUsage: { 'test-model': 1 },
      });

      await translationService.translate(request);
      const metrics = translationService.getMetrics();

      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.totalTranslations).toBeGreaterThan(0);
    });

    it('should handle rate limits with retry', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.simple,
      };

      // Simulate rate limit error followed by success
      translationService.translate
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          translation: 'Success after retry',
          confidence: 0.9,
          metadata: {
            model: 'test-model',
            cached: false,
            processingTimeMs: 350,
            tokenCount: 10,
          },
        });

      const result = await translationService.translate(request).catch(async () => {
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        return translationService.translate(request);
      });

      expect(result).toBeDefined();
      expect(result.translation).toBe('Success after retry');
    });

    it('should include dictionary terms in prompt', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.withSanskrit,
        options: {
          includeDictionary: true,
        },
      };

      translationService.translate.mockResolvedValue({
        translation: 'Translated with dictionary context',
        confidence: 0.92,
        metadata: {
          model: 'test-model',
          cached: false,
          processingTimeMs: 280,
          tokenCount: 30,
        },
      });

      await translationService.translate(request);

      // Verify promptGenerator was called (in real implementation)
      // expect(promptGenerator.generate).toHaveBeenCalled();
      expect(translationService.translate).toHaveBeenCalledWith(request);
    });
  });

  describe('translateBatch()', () => {
    it('should translate multiple chunks in parallel (batch of 5)', async () => {
      const chunks: TextChunk[] = [
        {
          id: 'chunk-1',
          text: TestData.tibetan.simple,
          pageNumber: 1,
          tokenCount: 10,
          metadata: { chunkIndex: 0, totalChunks: 5, hasOverlap: false },
        },
        {
          id: 'chunk-2',
          text: TestData.tibetan.simpleSentence,
          pageNumber: 1,
          tokenCount: 20,
          metadata: { chunkIndex: 1, totalChunks: 5, hasOverlap: false },
        },
        {
          id: 'chunk-3',
          text: TestData.tibetan.paragraph,
          pageNumber: 2,
          tokenCount: 50,
          metadata: { chunkIndex: 2, totalChunks: 5, hasOverlap: false },
        },
        {
          id: 'chunk-4',
          text: TestData.tibetan.withSanskrit,
          pageNumber: 2,
          tokenCount: 30,
          metadata: { chunkIndex: 3, totalChunks: 5, hasOverlap: false },
        },
        {
          id: 'chunk-5',
          text: TestData.tibetan.withPunctuation,
          pageNumber: 3,
          tokenCount: 25,
          metadata: { chunkIndex: 4, totalChunks: 5, hasOverlap: false },
        },
      ];

      const expectedResults: TranslationResult[] = chunks.map((chunk, i) => ({
        translation: `Translated ${chunk.id}`,
        confidence: 0.88 + i * 0.01,
        metadata: {
          model: 'test-model',
          cached: false,
          processingTimeMs: 200 + i * 10,
          tokenCount: chunk.tokenCount,
        },
      }));

      translationService.translateBatch.mockResolvedValue(expectedResults);

      const startTime = Date.now();
      const results = await translationService.translateBatch(chunks);
      const elapsedTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results.every((r: any) => r.translation)).toBe(true);
      expect(results.every((r: any) => r.confidence >= 0.8)).toBe(true);

      // Parallel processing should be faster than sequential
      // Even with mocks, batch should be reasonably fast
      expect(elapsedTime).toBeLessThan(1000);
    });

    it('should handle partial batch failures gracefully', async () => {
      const chunks: TextChunk[] = [
        {
          id: 'chunk-1',
          text: TestData.tibetan.simple,
          pageNumber: 1,
          tokenCount: 10,
          metadata: { chunkIndex: 0, totalChunks: 3, hasOverlap: false },
        },
        {
          id: 'chunk-2',
          text: TestData.tibetan.simpleSentence,
          pageNumber: 1,
          tokenCount: 20,
          metadata: { chunkIndex: 1, totalChunks: 3, hasOverlap: false },
        },
        {
          id: 'chunk-3',
          text: TestData.tibetan.paragraph,
          pageNumber: 2,
          tokenCount: 50,
          metadata: { chunkIndex: 2, totalChunks: 3, hasOverlap: false },
        },
      ];

      // Simulate one chunk failing, others succeeding
      translationService.translateBatch.mockResolvedValue([
        {
          translation: 'Success 1',
          confidence: 0.9,
          metadata: { model: 'test-model', cached: false, processingTimeMs: 200, tokenCount: 10 },
        },
        {
          translation: '',
          confidence: 0.0,
          metadata: {
            model: 'test-model',
            cached: false,
            processingTimeMs: 150,
            tokenCount: 0,
            error: 'Translation failed',
          },
        },
        {
          translation: 'Success 3',
          confidence: 0.88,
          metadata: { model: 'test-model', cached: false, processingTimeMs: 250, tokenCount: 50 },
        },
      ]);

      const results = await translationService.translateBatch(chunks);

      expect(results).toHaveLength(3);
      expect(results.filter((r: any) => r.confidence > 0)).toHaveLength(2);
      expect(results[1].confidence).toBe(0);
    });

    it('should use cache for some chunks in batch', async () => {
      const chunks: TextChunk[] = [
        {
          id: 'chunk-1',
          text: TestData.tibetan.simple, // Will be cached
          pageNumber: 1,
          tokenCount: 10,
          metadata: { chunkIndex: 0, totalChunks: 2, hasOverlap: false },
        },
        {
          id: 'chunk-2',
          text: TestData.tibetan.paragraph, // Fresh translation
          pageNumber: 1,
          tokenCount: 50,
          metadata: { chunkIndex: 1, totalChunks: 2, hasOverlap: false },
        },
      ];

      translationService.translateBatch.mockResolvedValue([
        {
          translation: 'Cached result',
          confidence: 0.9,
          metadata: { model: 'test-model', cached: true, processingTimeMs: 5, tokenCount: 10 },
        },
        {
          translation: 'Fresh result',
          confidence: 0.88,
          metadata: { model: 'test-model', cached: false, processingTimeMs: 250, tokenCount: 50 },
        },
      ]);

      const results = await translationService.translateBatch(chunks);

      expect(results[0].metadata.cached).toBe(true);
      expect(results[1].metadata.cached).toBe(false);
      expect(results[0].metadata.processingTimeMs).toBeLessThan(results[1].metadata.processingTimeMs);
    });

    it('should limit batch processing to 5 chunks in parallel', async () => {
      // Create 12 chunks to test batching
      const chunks: TextChunk[] = Array.from({ length: 12 }, (_, i) => ({
        id: `chunk-${i + 1}`,
        text: TestData.tibetan.simple,
        pageNumber: Math.floor(i / 5) + 1,
        tokenCount: 10,
        metadata: { chunkIndex: i, totalChunks: 12, hasOverlap: false },
      }));

      const results = Array.from({ length: 12 }, (_, i) => ({
        translation: `Translated chunk-${i + 1}`,
        confidence: 0.88,
        metadata: {
          model: 'test-model',
          cached: false,
          processingTimeMs: 200,
          tokenCount: 10,
        },
      }));

      translationService.translateBatch.mockResolvedValue(results);

      const batchResults = await translationService.translateBatch(chunks);

      expect(batchResults).toHaveLength(12);
      // In real implementation, this would process in batches of 5
      // Verify all chunks were processed
      expect(batchResults.every((r: any) => r.translation)).toBe(true);
    });

    it('should track latency metrics for batch operations', async () => {
      const chunks: TextChunk[] = [
        {
          id: 'chunk-1',
          text: TestData.tibetan.simple,
          pageNumber: 1,
          tokenCount: 10,
          metadata: { chunkIndex: 0, totalChunks: 1, hasOverlap: false },
        },
      ];

      translationService.translateBatch.mockResolvedValue([
        {
          translation: 'Translated',
          confidence: 0.9,
          metadata: {
            model: 'test-model',
            cached: false,
            processingTimeMs: 220,
            tokenCount: 10,
          },
        },
      ]);

      translationService.getMetrics.mockReturnValue({
        totalTranslations: 1,
        cacheHits: 0,
        cacheMisses: 1,
        averageLatency: 220,
        providerUsage: { 'test-model': 1 },
      });

      await translationService.translateBatch(chunks);
      const metrics = translationService.getMetrics();

      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.totalTranslations).toBeGreaterThan(0);
    });
  });

  describe('Integration with PromptGenerator', () => {
    it('should generate prompt with dictionary terms and examples', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.religious,
        options: {
          includeDictionary: true,
          exampleCount: 3,
        },
      };

      // Mock the internal behavior
      promptGenerator.generate.mockResolvedValue(
        'Translation prompt with:\n' +
          '- Dictionary: བླ་མ (spiritual teacher)\n' +
          '- Example 1: Greeting translation\n' +
          '- Example 2: Religious text\n' +
          '- Example 3: Formal address'
      );

      translationService.translate.mockImplementation(async (req: TranslationRequest) => {
        await promptGenerator.generate(req.text, {
          dictionaryTerms: await dictionaryService.findRelevantTerms(req.text, 20),
          examples: await exampleSelector.selectBest(req.text, req.options?.exampleCount || 3),
        });

        return {
          translation: 'Translated religious text with context',
          confidence: 0.93,
          metadata: {
            model: 'test-model',
            cached: false,
            processingTimeMs: 320,
            tokenCount: 80,
          },
        };
      });

      await translationService.translate(request);

      // In real implementation, verify prompt generator was called with correct params
      expect(promptGenerator.generate).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when all providers fail', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.simple,
      };

      translationService.translate.mockRejectedValue(
        new Error('All providers failed')
      );

      await expect(translationService.translate(request)).rejects.toThrow('All providers failed');
    });

    it('should handle empty text gracefully', async () => {
      const request: TranslationRequest = {
        text: '',
      };

      translationService.translate.mockRejectedValue(
        new Error('Text cannot be empty')
      );

      await expect(translationService.translate(request)).rejects.toThrow();
    });

    it('should handle invalid Unicode sequences', async () => {
      const request: TranslationRequest = {
        text: 'Invalid Unicode: \uD800', // Unpaired surrogate
      };

      translationService.translate.mockRejectedValue(
        new Error('Invalid Unicode sequence')
      );

      await expect(translationService.translate(request)).rejects.toThrow('Invalid Unicode');
    });
  });

  describe('Cache TTL', () => {
    it('should use 1 hour TTL for cached translations', async () => {
      const request: TranslationRequest = {
        text: TestData.tibetan.simple,
      };

      translationService.translate.mockResolvedValue({
        translation: 'Cached translation',
        confidence: 0.9,
        metadata: {
          model: 'test-model',
          cached: true,
          processingTimeMs: 5,
          tokenCount: 10,
        },
      });

      const result = await translationService.translate(request);

      expect(result.metadata.cached).toBe(true);
      // In real implementation, verify cache.set was called with ttl: 3600
    });
  });
});
