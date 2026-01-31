/**
 * Fallback System Tests
 *
 * Comprehensive tests for fallback orchestrator and strategies.
 * Tests strategy execution order, success/failure handling, and fallback metadata.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackOrchestrator } from '../../../../server/services/fallback/FallbackOrchestrator';
import { SimplerPromptStrategy } from '../../../../server/services/fallback/strategies/SimplerPromptStrategy';
import { AlternativeModelStrategy } from '../../../../server/services/fallback/strategies/AlternativeModelStrategy';
import { SmallerChunkStrategy } from '../../../../server/services/fallback/strategies/SmallerChunkStrategy';
import { ManualReviewStrategy } from '../../../../server/services/fallback/strategies/ManualReviewStrategy';
import type { TranslationRequest, TranslationResult } from '../../../../server/services/fallback/types';

describe('FallbackOrchestrator', () => {
  let orchestrator: FallbackOrchestrator;
  let mockRequest: TranslationRequest;

  beforeEach(() => {
    orchestrator = new FallbackOrchestrator();
    mockRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };
  });

  describe('Strategy Execution Order', () => {
    it('should try strategies in correct order', async () => {
      const executionOrder: string[] = [];

      // Mock all strategies to fail except last
      const simplerPrompt = new SimplerPromptStrategy({} as any);
      vi.spyOn(simplerPrompt, 'execute').mockImplementation(async () => {
        executionOrder.push('simpler');
        throw new Error('Simpler prompt failed');
      });

      const alternativeModel = new AlternativeModelStrategy({} as any);
      vi.spyOn(alternativeModel, 'execute').mockImplementation(async () => {
        executionOrder.push('alternative');
        throw new Error('Alternative model failed');
      });

      const smallerChunk = new SmallerChunkStrategy({} as any);
      vi.spyOn(smallerChunk, 'execute').mockImplementation(async () => {
        executionOrder.push('smaller');
        throw new Error('Smaller chunk failed');
      });

      const manualReview = new ManualReviewStrategy({} as any);
      vi.spyOn(manualReview, 'execute').mockImplementation(async () => {
        executionOrder.push('manual');
        return {
          translation: '',
          confidence: 0,
          metadata: { requiresManualReview: true }
        };
      });

      orchestrator.registerStrategy(simplerPrompt);
      orchestrator.registerStrategy(alternativeModel);
      orchestrator.registerStrategy(smallerChunk);
      orchestrator.registerStrategy(manualReview);

      await orchestrator.executeFallback(mockRequest, new Error('Initial failure'));

      expect(executionOrder).toEqual(['simpler', 'alternative', 'smaller', 'manual']);
    });

    it('should stop after first successful strategy', async () => {
      const executionOrder: string[] = [];

      const simplerPrompt = new SimplerPromptStrategy({} as any);
      vi.spyOn(simplerPrompt, 'execute').mockImplementation(async () => {
        executionOrder.push('simpler');
        throw new Error('Simpler prompt failed');
      });

      const alternativeModel = new AlternativeModelStrategy({} as any);
      vi.spyOn(alternativeModel, 'execute').mockImplementation(async () => {
        executionOrder.push('alternative');
        return {
          translation: 'Hello and good wishes (བཀྲ་ཤིས་བདེ་ལེགས།)',
          confidence: 0.85,
          metadata: { fallbackStrategy: 'ALTERNATIVE_MODEL' }
        };
      });

      const smallerChunk = new SmallerChunkStrategy({} as any);
      vi.spyOn(smallerChunk, 'execute').mockImplementation(async () => {
        executionOrder.push('smaller');
        return {
          translation: 'Should not be called',
          confidence: 0.9,
          metadata: {}
        };
      });

      orchestrator.registerStrategy(simplerPrompt);
      orchestrator.registerStrategy(alternativeModel);
      orchestrator.registerStrategy(smallerChunk);

      const result = await orchestrator.executeFallback(mockRequest, new Error('Initial failure'));

      expect(executionOrder).toEqual(['simpler', 'alternative']);
      expect(result.translation).toBe('Hello and good wishes (བཀྲ་ཤིས་བདེ་ལེགས།)');
      expect(result.metadata.fallbackStrategy).toBe('ALTERNATIVE_MODEL');
    });

    it('should try all strategies before giving up', async () => {
      const simplerPrompt = new SimplerPromptStrategy({} as any);
      vi.spyOn(simplerPrompt, 'execute').mockRejectedValue(new Error('Failed'));

      const alternativeModel = new AlternativeModelStrategy({} as any);
      vi.spyOn(alternativeModel, 'execute').mockRejectedValue(new Error('Failed'));

      const smallerChunk = new SmallerChunkStrategy({} as any);
      vi.spyOn(smallerChunk, 'execute').mockRejectedValue(new Error('Failed'));

      orchestrator.registerStrategy(simplerPrompt);
      orchestrator.registerStrategy(alternativeModel);
      orchestrator.registerStrategy(smallerChunk);

      await expect(
        orchestrator.executeFallback(mockRequest, new Error('Initial failure'))
      ).rejects.toThrow('All fallback strategies failed');
    });
  });

  describe('Strategy Success Handling', () => {
    it('should return result with fallback metadata', async () => {
      const strategy = new SimplerPromptStrategy({} as any);
      vi.spyOn(strategy, 'execute').mockResolvedValue({
        translation: 'Translated text (བཀྲ་ཤིས་བདེ་ལེགས།)',
        confidence: 0.75,
        metadata: { fallbackStrategy: 'SIMPLER_PROMPT' }
      });

      orchestrator.registerStrategy(strategy);

      const result = await orchestrator.executeFallback(mockRequest, new Error('Initial failure'));

      expect(result.translation).toBe('Translated text (བཀྲ་ཤིས་བདེ་ལེགས།)');
      expect(result.confidence).toBe(0.75);
      expect(result.metadata.fallbackStrategy).toBe('SIMPLER_PROMPT');
      expect(result.metadata.fallbackUsed).toBe(true);
    });

    it('should track which strategy succeeded', async () => {
      const strategy1 = new SimplerPromptStrategy({} as any);
      vi.spyOn(strategy1, 'execute').mockRejectedValue(new Error('Failed'));

      const strategy2 = new AlternativeModelStrategy({} as any);
      vi.spyOn(strategy2, 'execute').mockResolvedValue({
        translation: 'Success',
        confidence: 0.85,
        metadata: { fallbackStrategy: 'ALTERNATIVE_MODEL', modelUsed: 'gpt-4' }
      });

      orchestrator.registerStrategy(strategy1);
      orchestrator.registerStrategy(strategy2);

      const result = await orchestrator.executeFallback(mockRequest, new Error('Initial failure'));

      expect(result.metadata.fallbackStrategy).toBe('ALTERNATIVE_MODEL');
      expect(result.metadata.modelUsed).toBe('gpt-4');
    });
  });

  describe('Logging and Metrics', () => {
    it('should log fallback attempts', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const strategy = new SimplerPromptStrategy({} as any);
      vi.spyOn(strategy, 'execute').mockResolvedValue({
        translation: 'Success',
        confidence: 0.8,
        metadata: { fallbackStrategy: 'SIMPLER_PROMPT' }
      });

      orchestrator.registerStrategy(strategy);

      await orchestrator.executeFallback(mockRequest, new Error('Initial failure'));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fallback initiated')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('succeeded')
      );
    });

    it('should track fallback usage in metrics', async () => {
      const strategy = new SimplerPromptStrategy({} as any);
      vi.spyOn(strategy, 'execute').mockResolvedValue({
        translation: 'Success',
        confidence: 0.8,
        metadata: { fallbackStrategy: 'SIMPLER_PROMPT' }
      });

      orchestrator.registerStrategy(strategy);

      const result = await orchestrator.executeFallback(mockRequest, new Error('Initial failure'));

      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.fallbackStrategy).toBeDefined();
    });

    it('should log all failed strategies', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      const strategy1 = new SimplerPromptStrategy({} as any);
      vi.spyOn(strategy1, 'execute').mockRejectedValue(new Error('Strategy 1 failed'));

      const strategy2 = new AlternativeModelStrategy({} as any);
      vi.spyOn(strategy2, 'execute').mockRejectedValue(new Error('Strategy 2 failed'));

      orchestrator.registerStrategy(strategy1);
      orchestrator.registerStrategy(strategy2);

      await expect(
        orchestrator.executeFallback(mockRequest, new Error('Initial failure'))
      ).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.anything()
      );
    });
  });
});

describe('SimplerPromptStrategy', () => {
  let strategy: SimplerPromptStrategy;
  let mockTranslationService: any;

  beforeEach(() => {
    mockTranslationService = {
      translate: vi.fn()
    };
    strategy = new SimplerPromptStrategy(mockTranslationService);
  });

  it('should remove dictionary terms from prompt', async () => {
    mockTranslationService.translate.mockResolvedValue({
      translation: 'Translated text (བཀྲ་ཤིས་བདེ་ལེགས།)',
      confidence: 0.75
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {
        dictionaryTerms: ['term1', 'term2']
      }
    };

    await strategy.execute(request);

    expect(mockTranslationService.translate).toHaveBeenCalledWith(
      expect.objectContaining({
        includeDictionary: false
      })
    );
  });

  it('should remove examples from prompt', async () => {
    mockTranslationService.translate.mockResolvedValue({
      translation: 'Translated text',
      confidence: 0.75
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    await strategy.execute(request);

    expect(mockTranslationService.translate).toHaveBeenCalledWith(
      expect.objectContaining({
        includeExamples: false
      })
    );
  });

  it('should use basic prompt format', async () => {
    mockTranslationService.translate.mockResolvedValue({
      translation: 'Hello (བཀྲ་ཤིས་བདེ་ལེགས།)',
      confidence: 0.75
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.translation).toContain('Hello');
    expect(result.metadata.fallbackStrategy).toBe('SIMPLER_PROMPT');
  });

  it('should maintain confidence score', async () => {
    mockTranslationService.translate.mockResolvedValue({
      translation: 'Translated',
      confidence: 0.82
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.confidence).toBe(0.82);
  });
});

describe('AlternativeModelStrategy', () => {
  let strategy: AlternativeModelStrategy;
  let mockProviderService: any;

  beforeEach(() => {
    mockProviderService = {
      getNextProvider: vi.fn(),
      translate: vi.fn()
    };
    strategy = new AlternativeModelStrategy(mockProviderService);
  });

  it('should try next provider in chain', async () => {
    mockProviderService.getNextProvider.mockReturnValue('gpt-4');
    mockProviderService.translate.mockResolvedValue({
      translation: 'Translated by GPT-4 (བཀྲ་ཤིས་བདེ་ལེགས།)',
      confidence: 0.88
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(mockProviderService.getNextProvider).toHaveBeenCalled();
    expect(result.metadata.fallbackStrategy).toBe('ALTERNATIVE_MODEL');
    expect(result.metadata.modelUsed).toBe('gpt-4');
  });

  it('should use same prompt with alternative model', async () => {
    mockProviderService.getNextProvider.mockReturnValue('claude-3');
    mockProviderService.translate.mockResolvedValue({
      translation: 'Translated',
      confidence: 0.85
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {
        originalPrompt: 'Translate this text...'
      }
    };

    await strategy.execute(request);

    expect(mockProviderService.translate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Translate this text...',
        provider: 'claude-3'
      })
    );
  });

  it('should mark result with alternative model used', async () => {
    mockProviderService.getNextProvider.mockReturnValue('claude-3-opus');
    mockProviderService.translate.mockResolvedValue({
      translation: 'Success',
      confidence: 0.9
    });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.metadata.modelUsed).toBe('claude-3-opus');
    expect(result.metadata.fallbackStrategy).toBe('ALTERNATIVE_MODEL');
  });

  it('should fail if no alternative providers available', async () => {
    mockProviderService.getNextProvider.mockReturnValue(null);

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    await expect(strategy.execute(request)).rejects.toThrow('No alternative providers available');
  });
});

describe('SmallerChunkStrategy', () => {
  let strategy: SmallerChunkStrategy;
  let mockTranslationService: any;

  beforeEach(() => {
    mockTranslationService = {
      translate: vi.fn()
    };
    strategy = new SmallerChunkStrategy(mockTranslationService);
  });

  it('should split text into 2 smaller chunks', async () => {
    const longText = 'བཀྲ་ཤིས་བདེ་ལེགས། '.repeat(50); // Long text

    mockTranslationService.translate
      .mockResolvedValueOnce({
        translation: 'Part 1 translated',
        confidence: 0.8
      })
      .mockResolvedValueOnce({
        translation: 'Part 2 translated',
        confidence: 0.85
      });

    const request: TranslationRequest = {
      text: longText,
      pageNumber: 1,
      context: {}
    };

    await strategy.execute(request);

    expect(mockTranslationService.translate).toHaveBeenCalledTimes(2);
  });

  it('should translate each chunk separately', async () => {
    const text = 'བཀྲ་ཤིས་བདེ་ལེགས། ཁྱེད་རང་ག་པར་ཡོད།';

    mockTranslationService.translate
      .mockResolvedValueOnce({
        translation: 'Hello and good wishes',
        confidence: 0.8
      })
      .mockResolvedValueOnce({
        translation: 'How are you',
        confidence: 0.85
      });

    const request: TranslationRequest = {
      text,
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.translation).toContain('Hello and good wishes');
    expect(result.translation).toContain('How are you');
  });

  it('should combine results from all chunks', async () => {
    mockTranslationService.translate
      .mockResolvedValueOnce({
        translation: 'First part',
        confidence: 0.75
      })
      .mockResolvedValueOnce({
        translation: 'Second part',
        confidence: 0.80
      });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས། '.repeat(20),
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.translation).toBe('First part\n\nSecond part');
    expect(result.metadata.fallbackStrategy).toBe('SMALLER_CHUNKS');
  });

  it('should average confidence scores', async () => {
    mockTranslationService.translate
      .mockResolvedValueOnce({
        translation: 'Part 1',
        confidence: 0.7
      })
      .mockResolvedValueOnce({
        translation: 'Part 2',
        confidence: 0.9
      });

    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས། '.repeat(20),
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.confidence).toBe(0.8); // Average of 0.7 and 0.9
  });

  it('should fail if text cannot be split further', async () => {
    const request: TranslationRequest = {
      text: 'Short', // Too short to split
      pageNumber: 1,
      context: {}
    };

    await expect(strategy.execute(request)).rejects.toThrow('Cannot split text into smaller chunks');
  });
});

describe('ManualReviewStrategy', () => {
  let strategy: ManualReviewStrategy;
  let mockReviewQueue: any;

  beforeEach(() => {
    mockReviewQueue = {
      add: vi.fn().mockResolvedValue('review-id-123')
    };
    strategy = new ManualReviewStrategy(mockReviewQueue);
  });

  it('should not actually translate', async () => {
    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.translation).toBe('');
  });

  it('should return placeholder with manual review flag', async () => {
    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(result.confidence).toBe(0);
    expect(result.metadata.requiresManualReview).toBe(true);
    expect(result.metadata.fallbackStrategy).toBe('MANUAL_REVIEW');
  });

  it('should save to manual review queue', async () => {
    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 5,
      context: {}
    };

    const result = await strategy.execute(request);

    expect(mockReviewQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
        pageNumber: 5
      })
    );
    expect(result.metadata.reviewId).toBe('review-id-123');
  });

  it('should include error information in queue', async () => {
    const error = new Error('Translation failed');
    const request: TranslationRequest = {
      text: 'བཀྲ་ཤིས་བདེ་ལེགས།',
      pageNumber: 1,
      context: {
        originalError: error
      }
    };

    await strategy.execute(request);

    expect(mockReviewQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({
        error: error.message
      })
    );
  });
});
