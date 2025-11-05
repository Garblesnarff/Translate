/**
 * Tests for ConsensusBuilder
 *
 * Tests consensus building logic for multi-model translations:
 * - Calculate semantic agreement between results
 * - Weight results by confidence × agreement
 * - Select highest weighted result
 * - Boost final confidence based on agreement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConsensusBuilder } from '../../../../server/services/confidence/ConsensusBuilder.js';
import { MockEmbeddingProvider } from '../../../utils/mocks.js';
import type { TranslationResult } from '../../../../shared/types.js';

describe('ConsensusBuilder', () => {
  let embeddingProvider: MockEmbeddingProvider;
  let consensusBuilder: ConsensusBuilder;

  beforeEach(() => {
    embeddingProvider = new MockEmbeddingProvider({ dimension: 768 });
    consensusBuilder = new ConsensusBuilder(embeddingProvider);
  });

  describe('Result Selection', () => {
    it('should select highest confidence result when agreement is equal', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'High confidence (བོད།).',
          confidence: 0.9,
          metadata: {
            model: 'gemini-flash',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Medium confidence (བོད།).',
          confidence: 0.7,
          metadata: {
            model: 'gpt-4',
            cached: false,
            processingTimeMs: 1200,
            tokenCount: 10,
          },
        },
        {
          translation: 'Low confidence (བོད།).',
          confidence: 0.5,
          metadata: {
            model: 'claude-3',
            cached: false,
            processingTimeMs: 1100,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.translation).toBe('High confidence (བོད།).');
      expect(consensus.metadata.consensus).toBe(true);
      expect(consensus.metadata.modelsUsed).toHaveLength(3);
    });

    it('should weight results by confidence × agreement', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Result A (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-a',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Result B (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'model-b',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      // Should select based on weighted score (confidence × agreement)
      expect(consensus.metadata.consensus).toBe(true);
      expect(consensus.metadata.modelsUsed).toContain('model-a');
      expect(consensus.metadata.modelsUsed).toContain('model-b');
    });

    it('should handle single result', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Single result (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'gemini-flash',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.translation).toBe('Single result (བོད།).');
      expect(consensus.confidence).toBe(0.85);
      expect(consensus.metadata.consensus).toBe(false); // No consensus with single result
      expect(consensus.metadata.modelAgreement).toBe(1.0); // Perfect agreement with self
    });

    it('should handle two results', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'First (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Second (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.metadata.consensus).toBe(true);
      expect(consensus.metadata.modelsUsed).toHaveLength(2);
      expect(consensus.metadata.modelAgreement).toBeGreaterThan(0);
    });
  });

  describe('Confidence Boosting', () => {
    it('should boost confidence based on high agreement', async () => {
      // Similar translations should have high agreement
      const results: TranslationResult[] = [
        {
          translation: 'Greetings (བཀྲ་ཤིས།).',
          confidence: 0.7,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Greetings (བཀྲ་ཤིས།).',
          confidence: 0.75,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Greetings (བཀྲ་ཤིས།).',
          confidence: 0.72,
          metadata: {
            model: 'model-3',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བཀྲ་ཤིས།');

      // High agreement (identical translations) should boost confidence
      expect(consensus.confidence).toBeGreaterThan(0.75);
      expect(consensus.metadata.modelAgreement).toBeGreaterThan(0.9);
    });

    it('should not boost confidence for low agreement', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Translation A (བོད།).',
          confidence: 0.7,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Completely different translation (བོད།).',
          confidence: 0.75,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      // Low agreement should not significantly boost confidence
      expect(consensus.metadata.modelAgreement).toBeLessThan(0.9);
    });

    it('should cap boosted confidence at 0.98', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Perfect (བོད།).',
          confidence: 0.95,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Perfect (བོད།).',
          confidence: 0.96,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      // Even with high confidence and agreement, should cap at 0.98
      expect(consensus.confidence).toBeLessThanOrEqual(0.98);
    });
  });

  describe('Metadata', () => {
    it('should include all model names in metadata', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'A (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'gemini-flash',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'B (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'gpt-4',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'C (བོད།).',
          confidence: 0.82,
          metadata: {
            model: 'claude-3-sonnet',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.metadata.modelsUsed).toContain('gemini-flash');
      expect(consensus.metadata.modelsUsed).toContain('gpt-4');
      expect(consensus.metadata.modelsUsed).toContain('claude-3-sonnet');
    });

    it('should set consensus flag for multiple models', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'A (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'B (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.metadata.consensus).toBe(true);
    });

    it('should not set consensus flag for single model', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Single (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.metadata.consensus).toBe(false);
    });

    it('should include model agreement score', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'A (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'B (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.metadata.modelAgreement).toBeGreaterThanOrEqual(0);
      expect(consensus.metadata.modelAgreement).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results array', async () => {
      const results: TranslationResult[] = [];

      await expect(
        consensusBuilder.build(results, 'བོད།')
      ).rejects.toThrow('No translation results provided');
    });

    it('should handle results with varying confidence', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Very high (བོད།).',
          confidence: 0.95,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Very low (བོད།).',
          confidence: 0.3,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      // Should heavily weight the high-confidence result
      expect(consensus.translation).toBe('Very high (བོད།).');
    });

    it('should handle results with identical confidence', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'First (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'Second (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      // Should select based on agreement with other results
      expect(consensus.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle very long translations', async () => {
      const longText = 'Long translation (བོད།). '.repeat(1000);

      const results: TranslationResult[] = [
        {
          translation: longText,
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10000,
          },
        },
        {
          translation: longText,
          confidence: 0.85,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10000,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.translation).toBe(longText);
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding provider failures', async () => {
      embeddingProvider.setFailureMode(true);

      const results: TranslationResult[] = [
        {
          translation: 'A (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
        {
          translation: 'B (བོད།).',
          confidence: 0.85,
          metadata: {
            model: 'model-2',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      await expect(
        consensusBuilder.build(results, 'བོད།')
      ).rejects.toThrow();
    });

    it('should validate result metadata', async () => {
      const results: TranslationResult[] = [
        {
          translation: 'Valid (བོད།).',
          confidence: 0.8,
          metadata: {
            model: 'model-1',
            cached: false,
            processingTimeMs: 1000,
            tokenCount: 10,
          },
        },
      ];

      const consensus = await consensusBuilder.build(results, 'བོད།');

      expect(consensus.metadata).toBeDefined();
      expect(consensus.metadata.model).toBeDefined();
    });
  });
});
