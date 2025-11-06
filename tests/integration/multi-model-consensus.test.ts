/**
 * Multi-Model Consensus Integration Test
 *
 * Tests the multi-model translation workflow:
 * 1. Enable useMultiModel option
 * 2. Translate with 2-3 mock providers
 * 3. Verify consensus building
 * 4. Assert confidence boost from agreement
 * 5. Verify metadata includes modelAgreement and modelsUsed
 *
 * Also tests:
 * - Disagreement scenario (low agreement)
 * - Partial failure (1 provider fails)
 *
 * @module tests/integration/multi-model-consensus
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiModelTranslator } from '../../../server/services/confidence/MultiModelTranslator';
import { ConsensusBuilder } from '../../../server/services/confidence/ConsensusBuilder';
import {
  MockTranslationProvider,
  MockEmbeddingProvider,
  type TranslationResult,
} from '../utils/mocks';
import { calculateSimilarity } from '../utils/similarity';

describe('Multi-Model Consensus Integration Tests', () => {
  let embeddingProvider: MockEmbeddingProvider;

  beforeEach(() => {
    embeddingProvider = new MockEmbeddingProvider({ dimension: 768 });
  });

  describe('consensus building with multiple providers', () => {
    it('should translate with 2 providers and build consensus', async () => {
      const tibetanText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const expectedTranslation = 'Tashi Delek (བཀྲ་ཤིས་བདེ་ལེགས།).';

      // Create two providers with similar translations
      const provider1 = new MockTranslationProvider({ confidence: 0.85 });
      const provider2 = new MockTranslationProvider({ confidence: 0.87 });

      // Set custom responses (similar translations)
      provider1.setCustomResponse(tibetanText, {
        translation: expectedTranslation,
        confidence: 0.85,
        metadata: { provider: 'gemini', model: 'gemini-2.0-flash' },
      });

      provider2.setCustomResponse(tibetanText, {
        translation: expectedTranslation,
        confidence: 0.87,
        metadata: { provider: 'gpt-4', model: 'gpt-4-turbo' },
      });

      // Create multi-model translator
      const translator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      // Translate
      const result = await translator.translate(
        tibetanText,
        'Translate this Tibetan greeting'
      );

      // Verify consensus metadata
      expect(result.metadata).toHaveProperty('consensus');
      expect(result.metadata.consensus).toBe(true);
      expect(result.metadata).toHaveProperty('modelAgreement');
      expect(result.metadata.modelAgreement).toBeGreaterThan(0.8); // High agreement
      expect(result.metadata).toHaveProperty('modelsUsed');
      expect(result.metadata.modelsUsed).toHaveLength(2);

      // Verify confidence boost from agreement
      expect(result.confidence).toBeGreaterThan(0.85);

      // Verify translation quality
      expect(result.translation).toBe(expectedTranslation);

      console.log('✓ 2-model consensus achieved');
      console.log(`  Model agreement: ${result.metadata.modelAgreement}`);
      console.log(`  Final confidence: ${result.confidence}`);
      console.log(`  Models used: ${result.metadata.modelsUsed.join(', ')}`);
    });

    it('should translate with 3 providers and build consensus', async () => {
      const tibetanText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';
      const expectedTranslation = 'The Tibetan language (བོད་ཀྱི་སྐད་ཡིག) is important (གལ་ཆེན་པོ་ཡིན།).';

      // Create three providers with similar translations
      const provider1 = new MockTranslationProvider({ confidence: 0.83 });
      const provider2 = new MockTranslationProvider({ confidence: 0.85 });
      const provider3 = new MockTranslationProvider({ confidence: 0.84 });

      // All providers return same translation (perfect consensus)
      [provider1, provider2, provider3].forEach((provider, i) => {
        provider.setCustomResponse(tibetanText, {
          translation: expectedTranslation,
          confidence: 0.83 + (i * 0.01),
          metadata: {
            provider: ['gemini', 'gpt-4', 'claude'][i],
            model: ['gemini-2.0-flash', 'gpt-4-turbo', 'claude-3-opus'][i],
          },
        });
      });

      // Create multi-model translator
      const translator = new MultiModelTranslator(
        [provider1, provider2, provider3],
        embeddingProvider
      );

      // Translate
      const result = await translator.translate(
        tibetanText,
        'Translate this Tibetan sentence'
      );

      // With 3 identical results, agreement should be very high
      expect(result.metadata.consensus).toBe(true);
      expect(result.metadata.modelAgreement).toBeGreaterThan(0.9);
      expect(result.metadata.modelsUsed).toHaveLength(3);

      // Confidence should be boosted by consensus
      expect(result.confidence).toBeGreaterThan(0.85);

      console.log('✓ 3-model consensus achieved');
      console.log(`  Model agreement: ${result.metadata.modelAgreement.toFixed(3)}`);
      console.log(`  Final confidence: ${result.confidence.toFixed(3)}`);
      console.log(`  Models: ${result.metadata.modelsUsed.join(', ')}`);
    });

    it('should select best translation when all providers agree', async () => {
      const tibetanText = 'ཐུགས་རྗེ་ཆེ།';

      // Create providers with different confidence levels
      const provider1 = new MockTranslationProvider({ confidence: 0.80 });
      const provider2 = new MockTranslationProvider({ confidence: 0.90 });
      const provider3 = new MockTranslationProvider({ confidence: 0.85 });

      const translation = 'Thank you (ཐུགས་རྗེ་ཆེ།).';

      [provider1, provider2, provider3].forEach((provider) => {
        provider.setCustomResponse(tibetanText, {
          translation,
          confidence: provider['config']?.confidence || 0.8,
          metadata: { provider: 'mock' },
        });
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2, provider3],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Should select translation with highest confidence (0.90)
      // And boost it further due to consensus
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
      expect(result.metadata.consensus).toBe(true);

      console.log('✓ Selected best translation from consensus');
    });
  });

  describe('disagreement scenarios', () => {
    it('should handle low agreement between models', async () => {
      const tibetanText = 'བོད་སྐད།';

      // Create providers with different translations
      const provider1 = new MockTranslationProvider({ confidence: 0.80 });
      const provider2 = new MockTranslationProvider({ confidence: 0.85 });

      provider1.setCustomResponse(tibetanText, {
        translation: 'Tibetan language (བོད་སྐད།).',
        confidence: 0.80,
        metadata: { provider: 'provider1' },
      });

      provider2.setCustomResponse(tibetanText, {
        translation: 'Tibetan speech (བོད་སྐད།).',
        confidence: 0.85,
        metadata: { provider: 'provider2' },
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Metadata should indicate low agreement
      expect(result.metadata).toHaveProperty('modelAgreement');
      expect(result.metadata.modelAgreement).toBeLessThan(1.0);

      // Should still return a result (the higher confidence one)
      expect(result.translation).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);

      // Log disagreement
      console.log('✓ Handled disagreement scenario');
      console.log(`  Model agreement: ${result.metadata.modelAgreement.toFixed(3)}`);
      console.log(`  Selected: "${result.translation}"`);
    });

    it('should handle significant disagreement gracefully', async () => {
      const tibetanText = 'སེམས་ཀྱི་རང་བཞིན།';

      // Create providers with very different translations
      const provider1 = new MockTranslationProvider({ confidence: 0.75 });
      const provider2 = new MockTranslationProvider({ confidence: 0.78 });
      const provider3 = new MockTranslationProvider({ confidence: 0.80 });

      provider1.setCustomResponse(tibetanText, {
        translation: 'Mind nature (སེམས་ཀྱི་རང་བཞིན།).',
        confidence: 0.75,
        metadata: { provider: 'provider1' },
      });

      provider2.setCustomResponse(tibetanText, {
        translation: 'The natural state of mind (སེམས་ཀྱི་རང་བཞིན།).',
        confidence: 0.78,
        metadata: { provider: 'provider2' },
      });

      provider3.setCustomResponse(tibetanText, {
        translation: 'The essence of consciousness (སེམས་ཀྱི་རང་བཞིན།).',
        confidence: 0.80,
        metadata: { provider: 'provider3' },
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2, provider3],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Should indicate disagreement
      expect(result.metadata.modelAgreement).toBeLessThan(0.9);

      // Should still produce a valid result
      expect(result.translation).toBeTruthy();
      expect(result.metadata.modelsUsed).toHaveLength(3);

      console.log('✓ Handled significant disagreement');
      console.log(`  Agreement: ${result.metadata.modelAgreement.toFixed(3)}`);
      console.log(`  Selected: "${result.translation}"`);
    });
  });

  describe('partial failure scenarios', () => {
    it('should handle one provider failure gracefully', async () => {
      const tibetanText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const translation = 'Tashi Delek (བཀྲ་ཤིས་བདེ་ལེགས།).';

      // Create 3 providers: 2 working, 1 failing
      const provider1 = new MockTranslationProvider({ confidence: 0.85 });
      const provider2 = new MockTranslationProvider({ shouldFail: true }); // Fails
      const provider3 = new MockTranslationProvider({ confidence: 0.87 });

      provider1.setCustomResponse(tibetanText, {
        translation,
        confidence: 0.85,
        metadata: { provider: 'provider1' },
      });

      provider3.setCustomResponse(tibetanText, {
        translation,
        confidence: 0.87,
        metadata: { provider: 'provider3' },
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2, provider3],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Should succeed with 2 providers
      expect(result.translation).toBe(translation);
      expect(result.metadata.modelsUsed).toHaveLength(2);
      expect(result.metadata.consensus).toBe(true);

      console.log('✓ Handled 1 provider failure (2/3 succeeded)');
      console.log(`  Models used: ${result.metadata.modelsUsed.length}`);
    });

    it('should handle majority provider failure', async () => {
      const tibetanText = 'བོད་སྐད།';
      const translation = 'Tibetan language (བོད་སྐད།).';

      // Create 3 providers: 1 working, 2 failing
      const provider1 = new MockTranslationProvider({ confidence: 0.85 });
      const provider2 = new MockTranslationProvider({ shouldFail: true });
      const provider3 = new MockTranslationProvider({ shouldFail: true });

      provider1.setCustomResponse(tibetanText, {
        translation,
        confidence: 0.85,
        metadata: { provider: 'provider1' },
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2, provider3],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Should succeed with just 1 provider
      expect(result.translation).toBe(translation);
      expect(result.metadata.modelsUsed).toHaveLength(1);
      expect(result.metadata.consensus).toBe(false); // No consensus with 1 model

      console.log('✓ Handled majority failure (1/3 succeeded)');
      console.log(`  Single model used: ${result.metadata.modelsUsed[0]}`);
    });

    it('should throw error if all providers fail', async () => {
      const tibetanText = 'བོད་སྐད།';

      // All providers fail
      const provider1 = new MockTranslationProvider({ shouldFail: true });
      const provider2 = new MockTranslationProvider({ shouldFail: true });
      const provider3 = new MockTranslationProvider({ shouldFail: true });

      const translator = new MultiModelTranslator(
        [provider1, provider2, provider3],
        embeddingProvider
      );

      // Should throw error
      await expect(
        translator.translate(tibetanText, 'Translate')
      ).rejects.toThrow('All translation providers failed');

      console.log('✓ Correctly threw error when all providers failed');
    });
  });

  describe('consensus builder integration', () => {
    it('should use ConsensusBuilder to aggregate results', async () => {
      const tibetanText = 'སྙིང་རྗེ།';

      // Create providers with slightly different translations
      const provider1 = new MockTranslationProvider({ confidence: 0.82 });
      const provider2 = new MockTranslationProvider({ confidence: 0.84 });

      provider1.setCustomResponse(tibetanText, {
        translation: 'Compassion (སྙིང་རྗེ།).',
        confidence: 0.82,
        metadata: { provider: 'provider1' },
      });

      provider2.setCustomResponse(tibetanText, {
        translation: 'Loving-kindness (སྙིང་རྗེ།).',
        confidence: 0.84,
        metadata: { provider: 'provider2' },
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // ConsensusBuilder should calculate semantic similarity
      expect(result.metadata).toHaveProperty('semanticAgreement');

      // Should select one of the translations
      const isProvider1 = result.translation === 'Compassion (སྙིང་རྗེ།).';
      const isProvider2 = result.translation === 'Loving-kindness (སྙིང་རྗེ།).';
      expect(isProvider1 || isProvider2).toBe(true);

      console.log('✓ ConsensusBuilder integrated correctly');
      console.log(`  Semantic agreement: ${result.metadata.semanticAgreement?.toFixed(3)}`);
    });

    it('should boost confidence when models agree semantically', async () => {
      const tibetanText = 'བོད་སྐད་གལ་ཆེན་ཡིན།';

      // Create providers with semantically similar translations
      const provider1 = new MockTranslationProvider({ confidence: 0.80 });
      const provider2 = new MockTranslationProvider({ confidence: 0.82 });

      provider1.setCustomResponse(tibetanText, {
        translation: 'Tibetan language is important (བོད་སྐད་གལ་ཆེན་ཡིན།).',
        confidence: 0.80,
        metadata: { provider: 'provider1' },
      });

      provider2.setCustomResponse(tibetanText, {
        translation: 'The Tibetan language is crucial (བོད་སྐད་གལ་ཆེན་ཡིན།).',
        confidence: 0.82,
        metadata: { provider: 'provider2' },
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Confidence should be boosted due to semantic agreement
      expect(result.confidence).toBeGreaterThan(0.82);

      console.log('✓ Confidence boosted by semantic agreement');
      console.log(`  Original max confidence: 0.82`);
      console.log(`  Boosted confidence: ${result.confidence.toFixed(3)}`);
    });
  });

  describe('metadata verification', () => {
    it('should include all required consensus metadata', async () => {
      const tibetanText = 'བཀྲ་ཤིས་བདེ་ལེགས།';
      const translation = 'Tashi Delek (བཀྲ་ཤིས་བདེ་ལེགས།).';

      const provider1 = new MockTranslationProvider({ confidence: 0.85 });
      const provider2 = new MockTranslationProvider({ confidence: 0.87 });

      [provider1, provider2].forEach((provider) => {
        provider.setCustomResponse(tibetanText, {
          translation,
          confidence: 0.85,
          metadata: { provider: 'mock' },
        });
      });

      const translator = new MultiModelTranslator(
        [provider1, provider2],
        embeddingProvider
      );

      const result = await translator.translate(tibetanText, 'Translate');

      // Verify all required metadata fields
      expect(result.metadata).toHaveProperty('consensus');
      expect(result.metadata).toHaveProperty('modelAgreement');
      expect(result.metadata).toHaveProperty('modelsUsed');
      expect(result.metadata).toHaveProperty('semanticAgreement');

      // Verify types
      expect(typeof result.metadata.consensus).toBe('boolean');
      expect(typeof result.metadata.modelAgreement).toBe('number');
      expect(Array.isArray(result.metadata.modelsUsed)).toBe(true);
      expect(typeof result.metadata.semanticAgreement).toBe('number');

      // Verify value ranges
      expect(result.metadata.modelAgreement).toBeGreaterThanOrEqual(0);
      expect(result.metadata.modelAgreement).toBeLessThanOrEqual(1);
      expect(result.metadata.semanticAgreement).toBeGreaterThanOrEqual(0);
      expect(result.metadata.semanticAgreement).toBeLessThanOrEqual(1);

      console.log('✓ All consensus metadata present and valid');
      console.log(JSON.stringify(result.metadata, null, 2));
    });
  });
});
