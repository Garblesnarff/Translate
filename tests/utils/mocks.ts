// File: tests/utils/mocks.ts
// Mock implementations of provider interfaces for testing

import { vi } from 'vitest';

/**
 * Core Provider Interfaces (as defined in V2 Architecture)
 */

export interface EmbeddingProvider {
  getEmbedding(text: string): Promise<number[]>;
  getBatchEmbeddings(texts: string[]): Promise<number[][]>;
  dimension: number;
}

export interface TranslationResult {
  translation: string;
  confidence: number;
  metadata: Record<string, any>;
}

export interface TranslationProvider {
  translate(text: string, prompt: string): Promise<TranslationResult>;
  translateBatch(texts: string[], prompt: string): Promise<TranslationResult[]>;
  supportsStreaming: boolean;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface StorageProvider {
  save(collection: string, data: any): Promise<string>;
  load(collection: string, id: string): Promise<any>;
  query(collection: string, filter: any): Promise<any[]>;
}

/**
 * Mock Embedding Provider
 * Returns deterministic fake embeddings based on text content
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  dimension = 768;
  private failureMode = false;
  private callCount = 0;

  // Configuration options
  constructor(private config?: { dimension?: number; shouldFail?: boolean }) {
    if (config?.dimension) {
      this.dimension = config.dimension;
    }
    if (config?.shouldFail) {
      this.failureMode = config.shouldFail;
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    this.callCount++;

    if (this.failureMode) {
      throw new Error('Mock embedding provider failure');
    }

    // Generate deterministic embedding based on text
    const hash = this.hashString(text);
    return Array(this.dimension)
      .fill(0)
      .map((_, i) => Math.sin((i + 1) * hash) * 0.5 + 0.5);
  }

  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.failureMode) {
      throw new Error('Mock embedding provider failure');
    }

    return Promise.all(texts.map(text => this.getEmbedding(text)));
  }

  // Helper method to generate deterministic hash
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / Math.pow(2, 31);
  }

  // Test utilities
  getCallCount(): number {
    return this.callCount;
  }

  setFailureMode(fail: boolean): void {
    this.failureMode = fail;
  }

  reset(): void {
    this.callCount = 0;
    this.failureMode = false;
  }
}

/**
 * Mock Translation Provider
 * Returns predictable translations for testing
 */
export class MockTranslationProvider implements TranslationProvider {
  supportsStreaming = false;
  private failureMode = false;
  private callCount = 0;
  private customResponses: Map<string, TranslationResult> = new Map();

  constructor(private config?: {
    shouldFail?: boolean;
    confidence?: number;
    streaming?: boolean;
  }) {
    if (config?.shouldFail) {
      this.failureMode = config.shouldFail;
    }
    if (config?.streaming !== undefined) {
      this.supportsStreaming = config.streaming;
    }
  }

  async translate(text: string, prompt: string): Promise<TranslationResult> {
    this.callCount++;

    if (this.failureMode) {
      throw new Error('Mock translation provider failure');
    }

    // Check for custom response
    if (this.customResponses.has(text)) {
      return this.customResponses.get(text)!;
    }

    // Generate mock translation with Tibetan preservation
    const confidence = this.config?.confidence ?? 0.85;
    const preview = text.substring(0, 50);
    return {
      translation: `Mocked translation of text (${preview})${text.length > 50 ? '...' : ''}`,
      confidence,
      metadata: {
        provider: 'mock',
        model: 'test-model',
        timestamp: Date.now(),
        promptLength: prompt.length,
      },
    };
  }

  async translateBatch(texts: string[], prompt: string): Promise<TranslationResult[]> {
    if (this.failureMode) {
      throw new Error('Mock translation provider failure');
    }

    return Promise.all(texts.map(text => this.translate(text, prompt)));
  }

  // Test utilities
  setCustomResponse(text: string, result: TranslationResult): void {
    this.customResponses.set(text, result);
  }

  getCallCount(): number {
    return this.callCount;
  }

  setFailureMode(fail: boolean): void {
    this.failureMode = fail;
  }

  reset(): void {
    this.callCount = 0;
    this.failureMode = false;
    this.customResponses.clear();
  }
}

/**
 * Mock Cache Provider
 * In-memory cache with no external dependencies
 */
export class MockCacheProvider implements CacheProvider {
  private cache: Map<string, { value: any; ttl?: number; timestamp: number }> = new Map();
  private failureMode = false;
  private hitCount = 0;
  private missCount = 0;

  constructor(private config?: { shouldFail?: boolean }) {
    if (config?.shouldFail) {
      this.failureMode = config.shouldFail;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.failureMode) {
      throw new Error('Mock cache provider failure');
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.failureMode) {
      throw new Error('Mock cache provider failure');
    }

    this.cache.set(key, {
      value,
      ttl,
      timestamp: Date.now(),
    });
  }

  async delete(key: string): Promise<void> {
    if (this.failureMode) {
      throw new Error('Mock cache provider failure');
    }

    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    if (this.failureMode) {
      throw new Error('Mock cache provider failure');
    }

    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  // Test utilities
  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 0 : this.hitCount / total;
  }

  getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.getHitRate(),
      size: this.cache.size,
    };
  }

  setFailureMode(fail: boolean): void {
    this.failureMode = fail;
  }

  reset(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.failureMode = false;
  }
}

/**
 * Mock Storage Provider
 * In-memory database for testing
 */
export class MockStorageProvider implements StorageProvider {
  private storage: Map<string, Map<string, any>> = new Map();
  private failureMode = false;
  private nextId = 1;

  constructor(private config?: { shouldFail?: boolean }) {
    if (config?.shouldFail) {
      this.failureMode = config.shouldFail;
    }
  }

  async save(collection: string, data: any): Promise<string> {
    if (this.failureMode) {
      throw new Error('Mock storage provider failure');
    }

    if (!this.storage.has(collection)) {
      this.storage.set(collection, new Map());
    }

    const id = data.id || `mock-${this.nextId++}`;
    const collectionMap = this.storage.get(collection)!;
    collectionMap.set(id, { ...data, id, createdAt: Date.now() });

    return id;
  }

  async load(collection: string, id: string): Promise<any> {
    if (this.failureMode) {
      throw new Error('Mock storage provider failure');
    }

    const collectionMap = this.storage.get(collection);
    if (!collectionMap) {
      return null;
    }

    return collectionMap.get(id) || null;
  }

  async query(collection: string, filter: any): Promise<any[]> {
    if (this.failureMode) {
      throw new Error('Mock storage provider failure');
    }

    const collectionMap = this.storage.get(collection);
    if (!collectionMap) {
      return [];
    }

    // Simple filter implementation
    const results = Array.from(collectionMap.values());

    if (!filter || Object.keys(filter).length === 0) {
      return results;
    }

    return results.filter(item => {
      return Object.entries(filter).every(([key, value]) => {
        return item[key] === value;
      });
    });
  }

  // Test utilities
  getCollections(): string[] {
    return Array.from(this.storage.keys());
  }

  getCollectionSize(collection: string): number {
    return this.storage.get(collection)?.size || 0;
  }

  setFailureMode(fail: boolean): void {
    this.failureMode = fail;
  }

  reset(): void {
    this.storage.clear();
    this.nextId = 1;
    this.failureMode = false;
  }
}

/**
 * Factory function to create all mocks with consistent configuration
 */
export function createMockProviders(config?: {
  shouldFail?: boolean;
  embeddingDimension?: number;
  translationConfidence?: number;
}) {
  return {
    embedding: new MockEmbeddingProvider({
      dimension: config?.embeddingDimension,
      shouldFail: config?.shouldFail,
    }),
    translation: new MockTranslationProvider({
      shouldFail: config?.shouldFail,
      confidence: config?.translationConfidence,
    }),
    cache: new MockCacheProvider({
      shouldFail: config?.shouldFail,
    }),
    storage: new MockStorageProvider({
      shouldFail: config?.shouldFail,
    }),
  };
}

/**
 * Vitest spy wrappers for providers
 */
export function createSpyProviders() {
  const mocks = createMockProviders();

  return {
    embedding: {
      ...mocks.embedding,
      getEmbedding: vi.fn(mocks.embedding.getEmbedding.bind(mocks.embedding)),
      getBatchEmbeddings: vi.fn(mocks.embedding.getBatchEmbeddings.bind(mocks.embedding)),
    },
    translation: {
      ...mocks.translation,
      translate: vi.fn(mocks.translation.translate.bind(mocks.translation)),
      translateBatch: vi.fn(mocks.translation.translateBatch.bind(mocks.translation)),
    },
    cache: {
      ...mocks.cache,
      get: vi.fn(mocks.cache.get.bind(mocks.cache)),
      set: vi.fn(mocks.cache.set.bind(mocks.cache)),
      delete: vi.fn(mocks.cache.delete.bind(mocks.cache)),
      clear: vi.fn(mocks.cache.clear.bind(mocks.cache)),
    },
    storage: {
      ...mocks.storage,
      save: vi.fn(mocks.storage.save.bind(mocks.storage)),
      load: vi.fn(mocks.storage.load.bind(mocks.storage)),
      query: vi.fn(mocks.storage.query.bind(mocks.storage)),
    },
  };
}
