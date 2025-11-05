/**
 * Tests for MultiModelTranslator
 *
 * Tests multi-model translation orchestration:
 * - Translate with multiple providers in parallel
 * - Aggregate results using ConsensusBuilder
 * - Handle partial failures gracefully
 * - Select best result based on confidence × agreement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiModelTranslator } from '../../../../server/services/confidence/MultiModelTranslator.js';
import { MockTranslationProvider, MockEmbeddingProvider } from '../../../utils/mocks.js';

describe('MultiModelTranslator', () => {
  let provider1: MockTranslationProvider;
  let provider2: MockTranslationProvider;
  let provider3: MockTranslationProvider;
  let embeddingProvider: MockEmbeddingProvider;
  let translator: MultiModelTranslator;

  beforeEach(() => {
    provider1 = new MockTranslationProvider({ confidence: 0.85 });
    provider2 = new MockTranslationProvider({ confidence: 0.80 });
    provider3 = new MockTranslationProvider({ confidence: 0.82 });
    embeddingProvider = new MockEmbeddingProvider({ dimension: 768 });

    translator = new MultiModelTranslator(
      [provider1, provider2, provider3],
      embeddingProvider
    );
  });

  describe('Translation with Multiple Models', () => {
    it('should translate using all providers', async () => {
      const result = await translator.translate('བཀྲ་ཤིས།', 'Translate to English');

      // Should have called all providers
      expect(provider1.getCallCount()).toBe(1);
      expect(provider2.getCallCount()).toBe(1);
      expect(provider3.getCallCount()).toBe(1);

      // Result should indicate consensus
      expect(result.metadata.consensus).toBe(true);
      expect(result.metadata.modelsUsed).toHaveLength(3);
    });

    it('should process providers in parallel', async () => {
      const startTime = Date.now();
      await translator.translate('བཀྲ་ཤིས།', 'Translate to English');
      const duration = Date.now() - startTime;

      // Should complete quickly (parallel processing)
      // If sequential, would take much longer
      expect(duration).toBeLessThan(1000);
    });

    it('should select highest weighted result', async () => {
      // Set up providers with custom responses
      provider1.setCustomResponse('བཀྲ་ཤིས།', {
        translation: 'High confidence (བཀྲ་ཤིས།).',
        confidence: 0.90,
        metadata: {
          provider: 'provider1',
          model: 'model-1',
        },
      });

      provider2.setCustomResponse('བཀྲ་ཤིས།', {
        translation: 'Medium confidence (བཀྲ་ཤིས།).',
        confidence: 0.70,
        metadata: {
          provider: 'provider2',
          model: 'model-2',
        },
      });

      provider3.setCustomResponse('བཀྲ་ཤིས།', {
        translation: 'Low confidence (བཀྲ་ཤིས།).',
        confidence: 0.50,
        metadata: {
          provider: 'provider3',
          model: 'model-3',
        },
      });

      const result = await translator.translate('བཀྲ་ཤིས།', 'Translate');

      // Should select highest weighted (likely high confidence one)
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('should boost confidence based on agreement', async () => {
      // Set up similar translations (high agreement)
      const similarTranslation = 'Greetings (བཀྲ་ཤིས།).';

      provider1.setCustomResponse('བཀྲ་ཤིས།', {
        translation: similarTranslation,
        confidence: 0.75,
        metadata: { provider: 'provider1', model: 'model-1' },
      });

      provider2.setCustomResponse('བཀྲ་ཤིས།', {
        translation: similarTranslation,
        confidence: 0.75,
        metadata: { provider: 'provider2', model: 'model-2' },
      });

      provider3.setCustomResponse('བཀྲ་ཤིས།', {
        translation: similarTranslation,
        confidence: 0.75,
        metadata: { provider: 'provider3', model: 'model-3' },
      });

      const result = await translator.translate('བཀྲ་ཤིས།', 'Translate');

      // High agreement should boost confidence
      expect(result.confidence).toBeGreaterThan(0.75);
      expect(result.metadata.modelAgreement).toBeGreaterThan(0.9);
    });

    it('should include all model names in metadata', async () => {
      // Override metadata to include specific model names
      provider1.setCustomResponse('བོད།', {
        translation: 'A (བོད།).',
        confidence: 0.8,
        metadata: { model: 'gemini-flash' },
      });

      provider2.setCustomResponse('བོད།', {
        translation: 'B (བོད།).',
        confidence: 0.8,
        metadata: { model: 'gpt-4' },
      });

      provider3.setCustomResponse('བོད།', {
        translation: 'C (བོད།).',
        confidence: 0.8,
        metadata: { model: 'claude-3-sonnet' },
      });

      const result = await translator.translate('བོད།', 'Translate');

      expect(result.metadata.modelsUsed).toContain('gemini-flash');
      expect(result.metadata.modelsUsed).toContain('gpt-4');
      expect(result.metadata.modelsUsed).toContain('claude-3-sonnet');
    });
  });

  describe('Partial Failures', () => {
    it('should handle single provider failure', async () => {
      // Make provider2 fail
      provider2.setFailureMode(true);

      const result = await translator.translate('བཀྲ་ཤིས།', 'Translate');

      // Should still succeed with 2 out of 3 providers
      expect(result.translation).toBeDefined();
      expect(result.metadata.modelsUsed).toHaveLength(2);
      expect(result.metadata.consensus).toBe(true);
    });

    it('should handle multiple provider failures', async () => {
      // Make 2 providers fail
      provider2.setFailureMode(true);
      provider3.setFailureMode(true);

      const result = await translator.translate('བཀྲ་ཤིས།', 'Translate');

      // Should still succeed with 1 provider
      expect(result.translation).toBeDefined();
      expect(result.metadata.modelsUsed).toHaveLength(1);
      expect(result.metadata.consensus).toBe(false); // Single result = no consensus
    });

    it('should throw error when all providers fail', async () => {
      // Make all providers fail
      provider1.setFailureMode(true);
      provider2.setFailureMode(true);
      provider3.setFailureMode(true);

      await expect(
        translator.translate('བཀྲ་ཤིས།', 'Translate')
      ).rejects.toThrow('All translation providers failed');
    });

    it('should continue despite individual provider errors', async () => {
      // Make provider1 fail
      provider1.setFailureMode(true);

      const result = await translator.translate('བཀྲ་ཤིས།', 'Translate');

      // Should use remaining providers
      expect(provider1.getCallCount()).toBe(1); // Attempted
      expect(provider2.getCallCount()).toBe(1); // Succeeded
      expect(provider3.getCallCount()).toBe(1); // Succeeded
      expect(result.metadata.modelsUsed).toHaveLength(2);
    });
  });

  describe('Single Provider', () => {
    it('should work with single provider', async () => {
      const singleTranslator = new MultiModelTranslator(
        [provider1],
        embeddingProvider
      );

      const result = await singleTranslator.translate('བོད།', 'Translate');

      expect(result.translation).toBeDefined();
      expect(result.metadata.modelsUsed).toHaveLength(1);
      expect(result.metadata.consensus).toBe(false);
      expect(result.metadata.modelAgreement).toBe(1.0);
    });

    it('should not boost confidence with single provider', async () => {
      const singleTranslator = new MultiModelTranslator(
        [provider1],
        embeddingProvider
      );

      provider1.setCustomResponse('བོད།', {
        translation: 'Text (བོད།).',
        confidence: 0.75,
        metadata: { model: 'model-1' },
      });

      const result = await singleTranslator.translate('བོད།', 'Translate');

      // Should maintain original confidence (no consensus boost)
      expect(result.confidence).toBe(0.75);
    });
  });

  describe('Two Providers', () => {
    it('should work with two providers', async () => {
      const twoTranslator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      const result = await twoTranslator.translate('བོད།', 'Translate');

      expect(result.translation).toBeDefined();
      expect(result.metadata.modelsUsed).toHaveLength(2);
      expect(result.metadata.consensus).toBe(true);
    });

    it('should calculate agreement between two results', async () => {
      const twoTranslator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      provider1.setCustomResponse('བོད།', {
        translation: 'First (བོད།).',
        confidence: 0.8,
        metadata: { model: 'model-1' },
      });

      provider2.setCustomResponse('བོད།', {
        translation: 'Second (བོད།).',
        confidence: 0.8,
        metadata: { model: 'model-2' },
      });

      const result = await twoTranslator.translate('བོད།', 'Translate');

      expect(result.metadata.modelAgreement).toBeGreaterThan(0);
      expect(result.metadata.modelAgreement).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const result = await translator.translate('', 'Translate');

      expect(result.translation).toBeDefined();
    });

    it('should handle very long text', async () => {
      const longText = 'བོད། '.repeat(1000);

      const result = await translator.translate(longText, 'Translate');

      expect(result.translation).toBeDefined();
    });

    it('should handle special characters in text', async () => {
      const specialText = 'བོད།\n\n\tསྐད།\t\t\nཡིག།';

      const result = await translator.translate(specialText, 'Translate');

      expect(result.translation).toBeDefined();
    });

    it('should handle providers returning empty translations', async () => {
      provider1.setCustomResponse('བོད།', {
        translation: '',
        confidence: 0.5,
        metadata: { model: 'model-1' },
      });

      const result = await translator.translate('བོད།', 'Translate');

      // Should still return a result (possibly from other providers)
      expect(result).toBeDefined();
    });

    it('should handle providers with very different confidences', async () => {
      provider1.setCustomResponse('བོད།', {
        translation: 'Very high (བོད།).',
        confidence: 0.98,
        metadata: { model: 'model-1' },
      });

      provider2.setCustomResponse('བོད།', {
        translation: 'Very low (བོད།).',
        confidence: 0.1,
        metadata: { model: 'model-2' },
      });

      const result = await translator.translate('བོད།', 'Translate');

      // Should heavily favor high-confidence result
      expect(result.translation).toBe('Very high (བོད།).');
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error when no providers given', () => {
      expect(() => {
        new MultiModelTranslator([], embeddingProvider);
      }).toThrow('At least one translation provider is required');
    });

    it('should handle embedding provider failures', async () => {
      embeddingProvider.setFailureMode(true);

      await expect(
        translator.translate('བོད།', 'Translate')
      ).rejects.toThrow();
    });

    it('should include error details in failure message', async () => {
      provider1.setFailureMode(true);
      provider2.setFailureMode(true);
      provider3.setFailureMode(true);

      try {
        await translator.translate('བོད།', 'Translate');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('All translation providers failed');
      }
    });
  });

  describe('Performance', () => {
    it('should complete translation in reasonable time', async () => {
      const startTime = Date.now();
      await translator.translate('བོད། སྐད། ཡིག།', 'Translate');
      const duration = Date.now() - startTime;

      // Should complete within 1 second for mock providers
      expect(duration).toBeLessThan(1000);
    });

    it('should handle batches efficiently', async () => {
      const texts = [
        'བོད།',
        'སྐད།',
        'ཡིག།',
      ];

      const startTime = Date.now();

      for (const text of texts) {
        await translator.translate(text, 'Translate');
      }

      const duration = Date.now() - startTime;

      // Should complete all translations reasonably fast
      expect(duration).toBeLessThan(3000);
    });
  });
});
