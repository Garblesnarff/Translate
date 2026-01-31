/**
 * Tests for Cache Key Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  CacheKeys,
  hashText,
  hashData,
  isValidCacheKey,
  sanitizeKeyComponent,
  generateTranslationKey,
  generateEmbeddingKey,
  parseCacheKey,
  buildKeyPattern,
} from '../../../server/core/cache/keys.js';

describe('Cache Key Utilities', () => {
  describe('hashText', () => {
    it('should generate consistent hashes', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const hash1 = hashText(text);
      const hash2 = hashText(text);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different text', () => {
      const hash1 = hashText('text1');
      const hash2 = hashText('text2');

      expect(hash1).not.toBe(hash2);
    });

    it('should generate 64-character hex string (SHA-256)', () => {
      const hash = hashText('test');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    it('should handle Unicode correctly', () => {
      const tibetan = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const hash = hashText(tibetan);

      expect(hash).toBeTruthy();
      expect(hash.length).toBe(64);
    });
  });

  describe('hashData', () => {
    it('should hash objects consistently', () => {
      const obj = { name: 'test', value: 123 };
      const hash1 = hashData(obj);
      const hash2 = hashData(obj);

      expect(hash1).toBe(hash2);
    });

    it('should normalize key order', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };
      const hash1 = hashData(obj1);
      const hash2 = hashData(obj2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different objects', () => {
      const hash1 = hashData({ value: 1 });
      const hash2 = hashData({ value: 2 });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isValidCacheKey', () => {
    it('should accept valid keys', () => {
      const validKeys = [
        'simple',
        'key-with-dash',
        'key_with_underscore',
        'key:with:colon',
        'KEY123',
        'trans:abc123',
      ];

      validKeys.forEach((key) => {
        expect(isValidCacheKey(key)).toBe(true);
      });
    });

    it('should reject invalid keys', () => {
      const invalidKeys = [
        '',
        'key with space',
        'key@with@at',
        'key#with#hash',
        'key/with/slash',
        'key\\with\\backslash',
      ];

      invalidKeys.forEach((key) => {
        expect(isValidCacheKey(key)).toBe(false);
      });
    });
  });

  describe('sanitizeKeyComponent', () => {
    it('should replace invalid characters', () => {
      expect(sanitizeKeyComponent('key with spaces')).toBe('key_with_spaces');
      expect(sanitizeKeyComponent('key@with@special')).toBe('key_with_special');
      expect(sanitizeKeyComponent('key/path')).toBe('key_path');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeKeyComponent('key___test')).toBe('key_test');
    });

    it('should trim whitespace', () => {
      expect(sanitizeKeyComponent('  key  ')).toBe('key');
    });

    it('should keep valid characters', () => {
      expect(sanitizeKeyComponent('key-123_ABC')).toBe('key-123_ABC');
    });
  });

  describe('CacheKeys generators', () => {
    describe('translation', () => {
      it('should generate translation key', () => {
        const hash = 'abc123';
        const key = CacheKeys.translation(hash);

        expect(key).toBe('trans:abc123');
      });
    });

    describe('embedding', () => {
      it('should generate embedding key', () => {
        const hash = 'def456';
        const key = CacheKeys.embedding(hash);

        expect(key).toBe('embed:def456');
      });
    });

    describe('dictionary', () => {
      it('should generate dictionary key', () => {
        const tibetan = 'བཀྲ་ཤིས་བདེ་ལེགས།';
        const key = CacheKeys.dictionary(tibetan);

        expect(key).toContain('dict:');
        expect(key).toContain(encodeURIComponent(tibetan));
      });

      it('should handle URL encoding', () => {
        const text = 'བཀྲ་ཤིས།';
        const key = CacheKeys.dictionary(text);

        // Should be URL-safe
        expect(key).not.toContain(' ');
      });
    });

    describe('example', () => {
      it('should generate example key', () => {
        const id = 'greeting-001';
        const key = CacheKeys.example(id);

        expect(key).toBe('ex:greeting-001');
      });

      it('should sanitize example IDs', () => {
        const id = 'example with spaces';
        const key = CacheKeys.example(id);

        expect(key).toBe('ex:example_with_spaces');
      });
    });

    describe('generic', () => {
      it('should generate generic key', () => {
        const key = CacheKeys.generic('user', '123');

        expect(key).toBe('user:123');
      });

      it('should sanitize namespace and key', () => {
        const key = CacheKeys.generic('my namespace', 'my key');

        expect(key).toBe('my_namespace:my_key');
      });
    });
  });

  describe('generateTranslationKey', () => {
    it('should generate key without options', () => {
      const text = 'test';
      const key = generateTranslationKey(text);

      expect(key).toContain('trans:');
    });

    it('should generate same key for same text', () => {
      const text = 'test';
      const key1 = generateTranslationKey(text);
      const key2 = generateTranslationKey(text);

      expect(key1).toBe(key2);
    });

    it('should include options in key', () => {
      const text = 'test';
      const options = { model: 'gemini', temperature: 0.7 };
      const key1 = generateTranslationKey(text, options);
      const key2 = generateTranslationKey(text);

      // Keys should be different because of options
      expect(key1).not.toBe(key2);
    });

    it('should generate same key for same text and options', () => {
      const text = 'test';
      const options = { model: 'gemini', temperature: 0.7 };
      const key1 = generateTranslationKey(text, options);
      const key2 = generateTranslationKey(text, options);

      expect(key1).toBe(key2);
    });
  });

  describe('generateEmbeddingKey', () => {
    it('should generate key without model', () => {
      const text = 'test';
      const key = generateEmbeddingKey(text);

      expect(key).toContain('embed:');
    });

    it('should include model in key', () => {
      const text = 'test';
      const key1 = generateEmbeddingKey(text, 'gemini');
      const key2 = generateEmbeddingKey(text);

      expect(key1).not.toBe(key2);
    });
  });

  describe('parseCacheKey', () => {
    it('should parse namespaced keys', () => {
      const key = 'trans:abc123';
      const parsed = parseCacheKey(key);

      expect(parsed.namespace).toBe('trans');
      expect(parsed.identifier).toBe('abc123');
    });

    it('should handle keys without namespace', () => {
      const key = 'simplekey';
      const parsed = parseCacheKey(key);

      expect(parsed.namespace).toBe('default');
      expect(parsed.identifier).toBe('simplekey');
    });

    it('should handle multiple colons', () => {
      const key = 'namespace:sub:id:123';
      const parsed = parseCacheKey(key);

      expect(parsed.namespace).toBe('namespace');
      expect(parsed.identifier).toBe('sub:id:123');
    });
  });

  describe('buildKeyPattern', () => {
    it('should build wildcard pattern', () => {
      const pattern = buildKeyPattern('trans');

      expect(pattern).toBe('trans:*');
    });

    it('should build custom pattern', () => {
      const pattern = buildKeyPattern('dict', 'བཀྲ*');

      expect(pattern).toBe('dict:བཀྲ*');
    });

    it('should handle empty pattern', () => {
      const pattern = buildKeyPattern('embed', '');

      expect(pattern).toBe('embed:');
    });
  });

  describe('Integration', () => {
    it('should work together for translation caching', () => {
      const text = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const hash = hashText(text);
      const key = CacheKeys.translation(hash);

      expect(isValidCacheKey(key)).toBe(true);

      const parsed = parseCacheKey(key);
      expect(parsed.namespace).toBe('trans');
      expect(parsed.identifier).toBe(hash);
    });

    it('should work together for dictionary caching', () => {
      const tibetan = 'བཀྲ་ཤིས།';
      const key = CacheKeys.dictionary(tibetan);

      expect(key).toContain('dict:');

      const parsed = parseCacheKey(key);
      expect(parsed.namespace).toBe('dict');
    });
  });
});
