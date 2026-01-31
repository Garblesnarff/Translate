/**
 * Cache Key Utilities
 *
 * Provides deterministic key generation and text hashing for cache operations.
 * All keys use consistent namespacing to prevent collisions.
 */

import { createHash } from 'crypto';
import type { CacheKeys as CacheKeysType } from './types.js';

/**
 * Hash text using SHA-256 for deterministic cache keys
 * Same input always produces the same hash
 *
 * @param text - Text to hash
 * @returns Hexadecimal hash string
 */
export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Hash object/data by JSON stringifying first
 * Useful for complex cache keys
 *
 * @param data - Data to hash
 * @returns Hexadecimal hash string
 */
export function hashData(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return hashText(normalized);
}

/**
 * Validate cache key format
 * Keys must be non-empty and not contain special characters
 *
 * @param key - Key to validate
 * @returns True if valid
 */
export function isValidCacheKey(key: string): boolean {
  if (!key || key.length === 0) {
    return false;
  }

  // Keys should only contain alphanumeric, colon, dash, underscore
  const validKeyPattern = /^[a-zA-Z0-9:_-]+$/;
  return validKeyPattern.test(key);
}

/**
 * Sanitize a key component by removing/replacing invalid characters
 *
 * @param component - Key component to sanitize
 * @returns Sanitized component
 */
export function sanitizeKeyComponent(component: string): string {
  return component
    .trim() // Trim first
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Cache key generators for different entity types.
 * All keys use namespacing to prevent collisions.
 *
 * Format: {namespace}:{identifier}
 *
 * Examples:
 * - trans:abc123...  (translation)
 * - embed:def456...  (embedding)
 * - dict:བཀྲ་ཤིས་བདེ་ལེགས  (dictionary)
 */
export const CacheKeys: CacheKeysType = {
  /**
   * Translation result cache key
   * Uses hash of source text for deterministic keys
   *
   * @param textHash - SHA-256 hash of source text
   * @returns Cache key (e.g., "trans:abc123...")
   */
  translation: (textHash: string): string => {
    return `trans:${textHash}`;
  },

  /**
   * Text embedding cache key
   * Uses hash of text for which embedding was computed
   *
   * @param textHash - SHA-256 hash of text
   * @returns Cache key (e.g., "embed:def456...")
   */
  embedding: (textHash: string): string => {
    return `embed:${textHash}`;
  },

  /**
   * Dictionary lookup cache key
   * Caches dictionary entries for Tibetan terms
   *
   * @param tibetan - Tibetan text to lookup
   * @returns Cache key (e.g., "dict:བཀྲ་ཤིས་བདེ་ལེགས")
   */
  dictionary: (tibetan: string): string => {
    // URL-encode Tibetan to ensure key safety
    const encoded = encodeURIComponent(tibetan);
    return `dict:${encoded}`;
  },

  /**
   * Translation example cache key
   * Caches individual translation examples
   *
   * @param exampleId - Example identifier
   * @returns Cache key (e.g., "ex:greeting-001")
   */
  example: (exampleId: string): string => {
    const sanitized = sanitizeKeyComponent(exampleId);
    return `ex:${sanitized}`;
  },

  /**
   * Generic cache key with custom namespace
   * Use for custom cache entries
   *
   * @param namespace - Cache namespace (e.g., "user", "config")
   * @param key - Item key
   * @returns Cache key (e.g., "user:123")
   */
  generic: (namespace: string, key: string): string => {
    const sanitizedNs = sanitizeKeyComponent(namespace);
    const sanitizedKey = sanitizeKeyComponent(key);
    return `${sanitizedNs}:${sanitizedKey}`;
  },
};

/**
 * Generate a cache key for a translation request
 * Combines text and options into a single deterministic key
 *
 * @param text - Source text
 * @param options - Optional translation options that affect the result
 * @returns Cache key
 */
export function generateTranslationKey(
  text: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): string {
  if (!options || Object.keys(options).length === 0) {
    return CacheKeys.translation(hashText(text));
  }

  // Include options in key if they affect translation
  const keyData = {
    text,
    ...options,
  };

  return CacheKeys.translation(hashData(keyData));
}

/**
 * Generate a cache key for embeddings
 *
 * @param text - Text for embedding
 * @param model - Optional embedding model name
 * @returns Cache key
 */
export function generateEmbeddingKey(text: string, model?: string): string {
  if (!model) {
    return CacheKeys.embedding(hashText(text));
  }

  const keyData = { text, model };
  return CacheKeys.embedding(hashData(keyData));
}

/**
 * Parse a cache key to extract namespace and identifier
 *
 * @param key - Full cache key
 * @returns Object with namespace and identifier
 */
export function parseCacheKey(key: string): {
  namespace: string;
  identifier: string;
} {
  const colonIndex = key.indexOf(':');

  if (colonIndex === -1) {
    return {
      namespace: 'default',
      identifier: key,
    };
  }

  return {
    namespace: key.substring(0, colonIndex),
    identifier: key.substring(colonIndex + 1),
  };
}

/**
 * Build a pattern for matching multiple cache keys
 * Useful for Redis SCAN operations
 *
 * @param namespace - Cache namespace
 * @param pattern - Wildcard pattern
 * @returns Pattern string (e.g., "trans:*", "dict:བཀྲ*")
 */
export function buildKeyPattern(namespace: string, pattern: string = '*'): string {
  return `${namespace}:${pattern}`;
}
