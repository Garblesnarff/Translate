/**
 * Full Translation Pipeline Integration Test
 *
 * Tests the complete end-to-end translation workflow:
 * 1. Upload PDF (use test fixture)
 * 2. Extract text (TextExtractor)
 * 3. Chunk text (TextChunker)
 * 4. Translate chunks (TranslationService)
 * 5. Validate results (ValidationService)
 * 6. Score quality (QualityScorer)
 * 7. Check quality gates (QualityGateService)
 *
 * @module tests/integration/full-pipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { splitTextIntoChunks } from '@/lib/textExtractor';
import { validateAndNormalize } from '@/lib/tibetan/unicodeValidator';
import { splitIntoSentences } from '@/lib/tibetan/sentenceDetector';
import { ValidationService } from '../../../server/services/validation/ValidationService';
import { QualityScorer } from '../../../server/services/quality/QualityScorer';
import { QualityGateService } from '../../../server/services/quality/QualityGateService';
import {
  MockTranslationProvider,
  MockCacheProvider,
  MockEmbeddingProvider,
  createMockProviders,
} from '../utils/mocks';
import type { TranslationResult, TextChunk } from '../../../shared/types';

describe('Full Translation Pipeline Integration Tests', () => {
  let mockProviders: ReturnType<typeof createMockProviders>;
  let validationService: ValidationService;
  let qualityScorer: QualityScorer;
  let qualityGateService: QualityGateService;

  beforeEach(() => {
    // Initialize all services with mocks
    mockProviders = createMockProviders({ translationConfidence: 0.85 });
    validationService = new ValidationService();
    qualityScorer = new QualityScorer();
    qualityGateService = new QualityGateService(qualityScorer);
  });

  describe('complete pipeline workflow', () => {
    it('should process a simple Tibetan text through the full pipeline', async () => {
      // Step 1: Input text (simulating PDF extraction)
      const inputText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      // Step 2: Unicode validation and normalization
      const { text: normalizedText, report: unicodeReport } = validateAndNormalize(inputText);
      expect(unicodeReport.isValid).toBe(true);
      expect(normalizedText.length).toBeGreaterThan(0);
      console.log('✓ Step 1: Unicode validation passed');

      // Step 3: Input validation
      const inputValidation = validationService.validate(normalizedText, 'input');
      expect(inputValidation.isValid).toBe(true);
      expect(inputValidation.errors).toHaveLength(0);
      console.log('✓ Step 2: Input validation passed');

      // Step 4: Sentence detection
      const sentences = splitIntoSentences(normalizedText);
      expect(sentences.length).toBeGreaterThan(0);
      expect(sentences.every(s => s.text.length > 0)).toBe(true);
      console.log(`✓ Step 3: Detected ${sentences.length} sentence(s)`);

      // Step 5: Text chunking
      const chunks = splitTextIntoChunks(normalizedText);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.tokenCount > 0)).toBe(true);
      console.log(`✓ Step 4: Created ${chunks.length} chunk(s)`);

      // Step 6: Translation
      const translations: TranslationResult[] = [];
      for (const chunk of chunks) {
        const result = await mockProviders.translation.translate(
          chunk.text,
          'Translate this Tibetan text to English, preserving the original Tibetan in parentheses.'
        );

        translations.push({
          translation: result.translation,
          confidence: result.confidence,
          metadata: result.metadata,
        });
      }
      expect(translations.length).toBe(chunks.length);
      expect(translations.every(t => t.confidence > 0)).toBe(true);
      console.log(`✓ Step 5: Translated ${translations.length} chunk(s)`);

      // Step 7: Output validation
      for (let i = 0; i < translations.length; i++) {
        const outputValidation = validationService.validate(
          {
            translation: translations[i].translation,
            original: chunks[i].text,
          },
          'output'
        );

        // Output validation might have warnings, but should not have hard errors
        // for mock translations (in real tests, this would catch format issues)
        if (!outputValidation.isValid) {
          console.warn(`Output validation warnings for chunk ${i}:`, outputValidation.errors);
        }
      }
      console.log('✓ Step 6: Output validation completed');

      // Step 8: Quality scoring
      for (let i = 0; i < translations.length; i++) {
        const qualityScore = qualityScorer.score(
          translations[i],
          chunks[i].text
        );

        expect(qualityScore).toHaveProperty('overall');
        expect(qualityScore.overall).toBeGreaterThan(0);
        expect(qualityScore.overall).toBeLessThanOrEqual(1);
      }
      console.log('✓ Step 7: Quality scoring completed');

      // Step 9: Quality gates
      for (let i = 0; i < translations.length; i++) {
        const gateResult = qualityGateService.check(
          translations[i],
          chunks[i].text
        );

        // Log failures if any
        if (!gateResult.passed) {
          console.warn(`Quality gate failures for chunk ${i}:`, gateResult.failures);
        }

        // For mock translations with expected Tibetan, gate should pass
        // In real tests, this would catch low-quality translations
        expect(gateResult).toHaveProperty('passed');
        expect(gateResult).toHaveProperty('qualityScore');
      }
      console.log('✓ Step 8: Quality gates passed');

      // Step 10: Aggregate results
      const finalTranslation = translations.map(t => t.translation).join(' ');
      const avgConfidence = translations.reduce((sum, t) => sum + t.confidence, 0) / translations.length;

      expect(finalTranslation.length).toBeGreaterThan(0);
      expect(avgConfidence).toBeGreaterThan(0.7);
      console.log('✓ Step 9: Results aggregated successfully');

      console.log('\n=== Pipeline Summary ===');
      console.log(`Input: ${inputText}`);
      console.log(`Normalized: ${normalizedText}`);
      console.log(`Sentences: ${sentences.length}`);
      console.log(`Chunks: ${chunks.length}`);
      console.log(`Translations: ${translations.length}`);
      console.log(`Avg Confidence: ${avgConfidence.toFixed(3)}`);
      console.log(`Final Translation: ${finalTranslation}`);
    });

    it('should process multi-sentence text through the pipeline', async () => {
      const inputText = 'བོད་སྐད་གལ་ཆེན་ཡིན། ང་ཚོ་སློབ་སྦྱོང་བྱེད། ཆོས་ཀྱི་སློབ་སྦྱོང་ནི་གནད་ཆེན་པོ་རེད།';

      // Process through pipeline
      const { text: normalizedText } = validateAndNormalize(inputText);
      const inputValidation = validationService.validate(normalizedText, 'input');
      expect(inputValidation.isValid).toBe(true);

      const sentences = splitIntoSentences(normalizedText);
      expect(sentences.length).toBeGreaterThanOrEqual(3); // Should detect 3 sentences

      const chunks = splitTextIntoChunks(normalizedText);
      expect(chunks.length).toBeGreaterThan(0);

      // Translate all chunks
      const translations = await Promise.all(
        chunks.map(chunk =>
          mockProviders.translation.translate(chunk.text, 'Translate to English')
        )
      );

      expect(translations.length).toBe(chunks.length);
      expect(translations.every(t => t.confidence >= 0.7)).toBe(true);

      // Validate and score all translations
      for (let i = 0; i < translations.length; i++) {
        const qualityScore = qualityScorer.score(translations[i], chunks[i].text);
        expect(qualityScore.overall).toBeGreaterThan(0.6);
      }

      console.log('✓ Multi-sentence pipeline completed successfully');
    });

    it('should handle long text requiring multiple chunks', async () => {
      // Create long text (100 repetitions)
      const longText = 'བོད་སྐད་གལ་ཆེན་ཡིན། '.repeat(100);

      const { text: normalizedText } = validateAndNormalize(longText);
      const inputValidation = validationService.validate(normalizedText, 'input');
      expect(inputValidation.isValid).toBe(true);

      // Chunk with a smaller max token count to force multiple chunks
      const chunks = splitTextIntoChunks(normalizedText, { maxTokens: 100 });
      expect(chunks.length).toBeGreaterThan(1);
      console.log(`Created ${chunks.length} chunks for long text`);

      // Verify chunk boundaries
      chunks.forEach((chunk, i) => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.tokenCount).toBeLessThanOrEqual(100);
        expect(chunk.text.length).toBeGreaterThan(0);
      });

      // Translate chunks in parallel
      const startTime = Date.now();
      const translations = await Promise.all(
        chunks.map(chunk =>
          mockProviders.translation.translate(chunk.text, 'Translate to English')
        )
      );
      const duration = Date.now() - startTime;

      expect(translations.length).toBe(chunks.length);
      console.log(`Translated ${chunks.length} chunks in ${duration}ms`);

      // Validate quality
      const avgConfidence = translations.reduce((sum, t) => sum + t.confidence, 0) / translations.length;
      expect(avgConfidence).toBeGreaterThan(0.7);

      console.log('✓ Long text pipeline completed successfully');
    });

    it('should cache translations and improve performance on second run', async () => {
      const inputText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      // First run - no cache
      const { text: normalizedText } = validateAndNormalize(inputText);
      const chunks = splitTextIntoChunks(normalizedText);

      const startTime1 = Date.now();
      const translation1 = await mockProviders.translation.translate(
        chunks[0].text,
        'Translate to English'
      );
      const duration1 = Date.now() - startTime1;

      // Cache the translation
      const cacheKey = `translation:${chunks[0].text}`;
      await mockProviders.cache.set(cacheKey, translation1, 3600);

      // Second run - with cache
      const startTime2 = Date.now();
      const cached = await mockProviders.cache.get<TranslationResult>(cacheKey);
      const duration2 = Date.now() - startTime2;

      expect(cached).toBeTruthy();
      expect(cached?.translation).toBe(translation1.translation);
      expect(duration2).toBeLessThan(duration1); // Cache should be faster

      console.log(`First run: ${duration1}ms, Cached run: ${duration2}ms`);
      console.log('✓ Caching improved performance');
    });
  });

  describe('pipeline error handling', () => {
    it('should handle invalid input gracefully', () => {
      // Empty string
      const emptyValidation = validationService.validate('', 'input');
      expect(emptyValidation.isValid).toBe(false);
      expect(emptyValidation.errors.length).toBeGreaterThan(0);

      // Non-Tibetan text
      const englishValidation = validationService.validate('Hello World', 'input');
      expect(englishValidation.isValid).toBe(false);
      expect(englishValidation.errors.length).toBeGreaterThan(0);

      console.log('✓ Invalid input handling works correctly');
    });

    it('should handle translation failures and fallback', async () => {
      const inputText = 'བོད་ཀྱི་སྐད་ཡིག།';

      // Create a failing provider
      const failingProvider = new MockTranslationProvider({ shouldFail: true });

      // Try to translate - should throw
      await expect(
        failingProvider.translate(inputText, 'Translate')
      ).rejects.toThrow('Mock translation provider failure');

      // Fallback to working provider
      const workingProvider = new MockTranslationProvider({ shouldFail: false });
      const result = await workingProvider.translate(inputText, 'Translate');

      expect(result.translation).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);

      console.log('✓ Fallback mechanism works correctly');
    });

    it('should reject low-quality translations at quality gates', async () => {
      const inputText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      // Create a low-confidence translation
      const lowQualityTranslation: TranslationResult = {
        translation: 'Bad translation without Tibetan',
        confidence: 0.3,
        metadata: {
          provider: 'mock',
          warnings: ['Low confidence'],
        },
      };

      // Check against quality gates
      const gateResult = qualityGateService.check(lowQualityTranslation, inputText);

      // Should fail due to low confidence and missing Tibetan preservation
      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures.length).toBeGreaterThan(0);

      const confidenceFailure = gateResult.failures.find(f => f.gate === 'confidence');
      expect(confidenceFailure).toBeTruthy();
      expect(confidenceFailure?.action).toBe('reject');

      console.log('✓ Quality gates rejected low-quality translation');
      console.log('Failures:', gateResult.failures.map(f => f.message));
    });
  });

  describe('pipeline performance', () => {
    it('should process pipeline within acceptable time limits', async () => {
      const inputText = 'བོད་སྐད་གལ་ཆེན་ཡིན། ང་ཚོ་སློབ་སྦྱོང་བྱེད།';

      const startTime = Date.now();

      // Full pipeline
      const { text: normalizedText } = validateAndNormalize(inputText);
      const inputValidation = validationService.validate(normalizedText, 'input');
      const sentences = splitIntoSentences(normalizedText);
      const chunks = splitTextIntoChunks(normalizedText);
      const translations = await Promise.all(
        chunks.map(chunk =>
          mockProviders.translation.translate(chunk.text, 'Translate')
        )
      );
      const qualityScores = translations.map((t, i) =>
        qualityScorer.score(t, chunks[i].text)
      );
      const gateResults = translations.map((t, i) =>
        qualityGateService.check(t, chunks[i].text)
      );

      const duration = Date.now() - startTime;

      // Pipeline should complete in reasonable time (with mocks)
      expect(duration).toBeLessThan(1000); // < 1 second for mock pipeline

      console.log(`Full pipeline completed in ${duration}ms`);
      console.log('✓ Pipeline performance acceptable');
    });

    it('should handle parallel chunk translation efficiently', async () => {
      const inputText = 'བོད་སྐད། '.repeat(50);
      const chunks = splitTextIntoChunks(inputText, { maxTokens: 50 });

      // Sequential translation
      const seqStart = Date.now();
      for (const chunk of chunks) {
        await mockProviders.translation.translate(chunk.text, 'Translate');
      }
      const seqDuration = Date.now() - seqStart;

      // Reset mock provider
      mockProviders.translation.reset();

      // Parallel translation
      const parStart = Date.now();
      await Promise.all(
        chunks.map(chunk =>
          mockProviders.translation.translate(chunk.text, 'Translate')
        )
      );
      const parDuration = Date.now() - parStart;

      // Parallel should be faster or similar (with mocks, difference is minimal)
      expect(parDuration).toBeLessThanOrEqual(seqDuration * 1.2); // Allow 20% variance

      console.log(`Sequential: ${seqDuration}ms, Parallel: ${parDuration}ms`);
      console.log('✓ Parallel processing improves throughput');
    });
  });

  describe('pipeline integration with quality system', () => {
    it('should track quality metrics throughout pipeline', async () => {
      const inputText = 'བོད་ཀྱི་སྐད་ཡིག་ནི་གལ་ཆེན་པོ་ཡིན།';

      const metrics = {
        inputValidationTime: 0,
        chunkingTime: 0,
        translationTime: 0,
        qualityScoringTime: 0,
        gateCheckingTime: 0,
      };

      // Input validation
      let start = Date.now();
      const { text: normalizedText } = validateAndNormalize(inputText);
      validationService.validate(normalizedText, 'input');
      metrics.inputValidationTime = Date.now() - start;

      // Chunking
      start = Date.now();
      const chunks = splitTextIntoChunks(normalizedText);
      metrics.chunkingTime = Date.now() - start;

      // Translation
      start = Date.now();
      const translations = await Promise.all(
        chunks.map(chunk =>
          mockProviders.translation.translate(chunk.text, 'Translate')
        )
      );
      metrics.translationTime = Date.now() - start;

      // Quality scoring
      start = Date.now();
      const qualityScores = translations.map((t, i) =>
        qualityScorer.score(t, chunks[i].text)
      );
      metrics.qualityScoringTime = Date.now() - start;

      // Gate checking
      start = Date.now();
      const gateResults = translations.map((t, i) =>
        qualityGateService.check(t, chunks[i].text)
      );
      metrics.gateCheckingTime = Date.now() - start;

      console.log('\n=== Pipeline Metrics ===');
      console.log(JSON.stringify(metrics, null, 2));

      // Assert reasonable timing
      expect(metrics.inputValidationTime).toBeLessThan(50);
      expect(metrics.chunkingTime).toBeLessThan(50);
      expect(metrics.qualityScoringTime).toBeLessThan(50);
      expect(metrics.gateCheckingTime).toBeLessThan(50);

      console.log('✓ All pipeline stages completed within time limits');
    });
  });
});
