/**
 * Tests for SemanticAgreement
 *
 * Tests semantic similarity calculation between multiple translations
 * using embedding vectors and cosine similarity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticAgreement } from '../../../../server/services/confidence/SemanticAgreement.js';
import { MockEmbeddingProvider } from '../../../utils/mocks.js';

describe('SemanticAgreement', () => {
  let embeddingProvider: MockEmbeddingProvider;
  let semanticAgreement: SemanticAgreement;

  beforeEach(() => {
    embeddingProvider = new MockEmbeddingProvider({ dimension: 768 });
    semanticAgreement = new SemanticAgreement(embeddingProvider);
  });

  describe('Cosine Similarity', () => {
    it('should return 1.0 for identical texts', async () => {
      const texts = ['Greetings (བཀྲ་ཤིས།).', 'Greetings (བཀྲ་ཤིས།).'];

      const agreement = await semanticAgreement.calculate(texts);

      // Use toBeCloseTo for floating point comparison
      expect(agreement).toBeCloseTo(1.0, 10); // 10 decimal places
    });

    it('should return high similarity for similar texts', async () => {
      const texts = [
        'Greetings (བཀྲ་ཤིས།).',
        'Hello (བཀྲ་ཤིས།).',
      ];

      const agreement = await semanticAgreement.calculate(texts);

      // Similar texts should have high agreement
      expect(agreement).toBeGreaterThan(0.5);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });

    it('should return lower similarity for different texts', async () => {
      const texts = [
        'Greetings (བཀྲ་ཤིས།).',
        'The quick brown fox jumps over the lazy dog.',
      ];

      const agreement = await semanticAgreement.calculate(texts);

      // Different texts should have lower agreement
      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThan(1.0);
    });

    it('should handle multiple translations (>2)', async () => {
      const texts = [
        'Greetings (བཀྲ་ཤིས།).',
        'Hello (བཀྲ་ཤིས།).',
        'Salutations (བཀྲ་ཤིས།).',
      ];

      const agreement = await semanticAgreement.calculate(texts);

      // Should calculate pairwise similarities and average
      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });

    it('should return 1.0 for single text', async () => {
      const texts = ['Greetings (བཀྲ་ཤིས།).'];

      const agreement = await semanticAgreement.calculate(texts);

      // Single text = perfect agreement with itself
      expect(agreement).toBe(1.0);
    });

    it('should handle empty texts array', async () => {
      const texts: string[] = [];

      const agreement = await semanticAgreement.calculate(texts);

      // Empty array = no agreement
      expect(agreement).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should efficiently process multiple texts', async () => {
      const texts = [
        'Text 1 (བོད།).',
        'Text 2 (སྐད།).',
        'Text 3 (ཡིག།).',
        'Text 4 (དེ།).',
      ];

      const agreement = await semanticAgreement.calculate(texts);

      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });

    it('should use batch embedding API when available', async () => {
      const texts = [
        'Text 1 (བོད།).',
        'Text 2 (སྐད།).',
        'Text 3 (ཡིག།).',
      ];

      // MockEmbeddingProvider implements getBatchEmbeddings
      await semanticAgreement.calculate(texts);

      // Should have called the provider
      expect(embeddingProvider.getCallCount()).toBeGreaterThan(0);
    });
  });

  describe('Pairwise Similarity Calculation', () => {
    it('should calculate all pairwise similarities', async () => {
      const texts = [
        'A (བོད།).',
        'B (སྐད།).',
        'C (ཡིག།).',
      ];

      // 3 texts = 3 pairs: (A,B), (A,C), (B,C)
      const agreement = await semanticAgreement.calculate(texts);

      // Average of all pairwise similarities
      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });

    it('should weight all pairs equally', async () => {
      // With mock embeddings, identical texts should average to 1.0
      const texts = [
        'Same (བོད།).',
        'Same (བོད།).',
        'Same (བོད།).',
      ];

      const agreement = await semanticAgreement.calculate(texts);

      // All pairs identical = average 1.0
      expect(agreement).toBe(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long texts', async () => {
      const longText = 'Text (བོད།). '.repeat(1000);
      const texts = [longText, longText];

      const agreement = await semanticAgreement.calculate(texts);

      expect(agreement).toBe(1.0);
    });

    it('should handle texts with special characters', async () => {
      const texts = [
        'Text (བོད།).\n\n\tNew line.',
        'Text (བོད།).\t\n\n\tNew line.',
      ];

      const agreement = await semanticAgreement.calculate(texts);

      // Mock embeddings are deterministic based on text content
      // Different whitespace creates different embeddings
      // Should still have moderate similarity
      expect(agreement).toBeGreaterThan(0.5);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });

    it('should handle unicode normalization', async () => {
      const texts = [
        'Text (བོད།).',
        'Text (བོད།).', // Same but potentially different Unicode encoding
      ];

      const agreement = await semanticAgreement.calculate(texts);

      expect(agreement).toBe(1.0);
    });

    it('should handle empty strings in array', async () => {
      const texts = ['Text (བོད།).', '', 'Another (སྐད།).'];

      const agreement = await semanticAgreement.calculate(texts);

      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding provider failures gracefully', async () => {
      embeddingProvider.setFailureMode(true);

      const texts = ['Text 1', 'Text 2'];

      await expect(semanticAgreement.calculate(texts)).rejects.toThrow();
    });

    it('should handle invalid embedding dimensions', async () => {
      // Create provider with different dimensions
      const provider = new MockEmbeddingProvider({ dimension: 512 });
      const service = new SemanticAgreement(provider);

      const texts = ['Text 1', 'Text 2'];

      const agreement = await service.calculate(texts);

      // Should still work with different dimensions
      expect(agreement).toBeGreaterThanOrEqual(0);
      expect(agreement).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time for small batches', async () => {
      const texts = Array(5).fill('Text (བོད།).');

      const startTime = Date.now();
      await semanticAgreement.calculate(texts);
      const duration = Date.now() - startTime;

      // Should complete in less than 1 second for 5 texts
      expect(duration).toBeLessThan(1000);
    });

    it('should handle medium-sized batches', async () => {
      const texts = Array(10).fill('Text (བོད།).');

      const agreement = await semanticAgreement.calculate(texts);

      expect(agreement).toBe(1.0); // All identical
    });
  });
});
