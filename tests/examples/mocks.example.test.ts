// File: tests/examples/mocks.example.test.ts
// Example tests demonstrating mock provider usage

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockTranslationProvider,
  MockEmbeddingProvider,
  MockCacheProvider,
  MockStorageProvider,
  createMockProviders,
  createSpyProviders,
} from '../utils';

describe('Mock Providers Examples', () => {
  describe('MockTranslationProvider', () => {
    let provider: MockTranslationProvider;

    beforeEach(() => {
      provider = new MockTranslationProvider();
    });

    it('should translate text with predictable results', async () => {
      const result = await provider.translate('བཀྲ་ཤིས་བདེ་ལེགས།', 'Translate this');

      expect(result.translation).toContain('Mocked translation');
      expect(result.confidence).toBe(0.85);
      expect(result.metadata.provider).toBe('mock');
    });

    it('should handle batch translations', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const results = await provider.translateBatch(texts, 'Translate these');

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.translation).toContain(`text${i + 1}`);
      });
    });

    it('should support custom responses', async () => {
      provider.setCustomResponse('test', {
        translation: 'Custom translation',
        confidence: 0.99,
        metadata: { custom: true },
      });

      const result = await provider.translate('test', 'prompt');
      expect(result.translation).toBe('Custom translation');
      expect(result.confidence).toBe(0.99);
    });

    it('should track call counts', async () => {
      expect(provider.getCallCount()).toBe(0);

      await provider.translate('test1', 'prompt');
      expect(provider.getCallCount()).toBe(1);

      await provider.translate('test2', 'prompt');
      expect(provider.getCallCount()).toBe(2);
    });

    it('should support failure mode', async () => {
      provider.setFailureMode(true);

      await expect(provider.translate('test', 'prompt')).rejects.toThrow(
        'Mock translation provider failure'
      );
    });
  });

  describe('MockEmbeddingProvider', () => {
    let provider: MockEmbeddingProvider;

    beforeEach(() => {
      provider = new MockEmbeddingProvider();
    });

    it('should generate deterministic embeddings', async () => {
      const embedding1 = await provider.getEmbedding('test');
      const embedding2 = await provider.getEmbedding('test');

      expect(embedding1).toEqual(embedding2);
      expect(embedding1).toHaveLength(768);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await provider.getEmbedding('text1');
      const embedding2 = await provider.getEmbedding('text2');

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should support batch embeddings', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const embeddings = await provider.getBatchEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(768);
      });
    });

    it('should support custom dimensions', async () => {
      const customProvider = new MockEmbeddingProvider({ dimension: 512 });
      const embedding = await customProvider.getEmbedding('test');

      expect(embedding).toHaveLength(512);
    });
  });

  describe('MockCacheProvider', () => {
    let cache: MockCacheProvider;

    beforeEach(() => {
      cache = new MockCacheProvider();
    });

    it('should store and retrieve values', async () => {
      await cache.set('key1', { value: 'test' });
      const result = await cache.get('key1');

      expect(result).toEqual({ value: 'test' });
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      await cache.set('key1', 'value', 0.1); // 0.1 second TTL

      // Immediately available
      expect(await cache.get('key1')).toBe('value');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(await cache.get('key1')).toBeNull();
    });

    it('should track cache statistics', async () => {
      await cache.set('key1', 'value');

      await cache.get('key1'); // Hit
      await cache.get('key2'); // Miss
      await cache.get('key1'); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should clear all data', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      expect(cache.getStats().size).toBe(2);

      await cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(await cache.get('key1')).toBeNull();
    });
  });

  describe('MockStorageProvider', () => {
    let storage: MockStorageProvider;

    beforeEach(() => {
      storage = new MockStorageProvider();
    });

    it('should save and load data', async () => {
      const id = await storage.save('translations', {
        text: 'test',
        translation: 'result',
      });

      const loaded = await storage.load('translations', id);
      expect(loaded.text).toBe('test');
      expect(loaded.translation).toBe('result');
    });

    it('should query data with filters', async () => {
      await storage.save('translations', { category: 'religious', text: 'text1' });
      await storage.save('translations', { category: 'religious', text: 'text2' });
      await storage.save('translations', { category: 'general', text: 'text3' });

      const results = await storage.query('translations', { category: 'religious' });
      expect(results).toHaveLength(2);
    });

    it('should track collections', async () => {
      await storage.save('translations', { data: 1 });
      await storage.save('dictionary', { data: 2 });

      const collections = storage.getCollections();
      expect(collections).toContain('translations');
      expect(collections).toContain('dictionary');
    });
  });

  describe('Factory Functions', () => {
    it('should create all providers with consistent config', () => {
      const mocks = createMockProviders({
        shouldFail: false,
        embeddingDimension: 512,
        translationConfidence: 0.9,
      });

      expect(mocks.embedding.dimension).toBe(512);
      expect(mocks.translation).toBeDefined();
      expect(mocks.cache).toBeDefined();
      expect(mocks.storage).toBeDefined();
    });

    it('should create spy providers for assertion', async () => {
      const spies = createSpyProviders();

      await spies.translation.translate('test', 'prompt');

      expect(spies.translation.translate).toHaveBeenCalledWith('test', 'prompt');
      expect(spies.translation.translate).toHaveBeenCalledTimes(1);
    });
  });
});
