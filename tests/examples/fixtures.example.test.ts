// File: tests/examples/fixtures.example.test.ts
// Example tests demonstrating fixture usage

import { describe, it, expect } from 'vitest';
import {
  TestData,
  TibetanText,
  ExpectedTranslations,
  TranslationResults,
  createTestData,
  generateTestCases,
} from '../utils';

describe('Test Fixtures Examples', () => {
  describe('Tibetan Text Fixtures', () => {
    it('should provide simple Tibetan text', () => {
      expect(TibetanText.simple).toBeDefined();
      expect(TibetanText.simple).toBe('བཀྲ་ཤིས་བདེ་ལེགས།');
    });

    it('should provide various complexity levels', () => {
      expect(TibetanText.simple).toBeTruthy();
      expect(TibetanText.simpleSentence).toBeTruthy();
      expect(TibetanText.paragraph).toBeTruthy();
      expect(TibetanText.multiPage).toBeTruthy();
      expect(TibetanText.withSanskrit).toBeTruthy();
    });

    it('should provide edge cases', () => {
      expect(TibetanText.empty).toBe('');
      expect(TibetanText.whitespace).toBe('   ');
      expect(TibetanText.singleTsek).toBe('་');
      expect(TibetanText.singleShad).toBe('།');
    });
  });

  describe('Expected Translations', () => {
    it('should provide valid translation format', () => {
      const translation = ExpectedTranslations.valid;

      expect(translation).toContain('Greetings');
      expect(translation).toContain('བཀྲ་ཤིས་བདེ་ལེགས།');
      expect(translation).toMatch(/\([^\)]*[\u0F00-\u0FFF][^\)]*\)/);
    });

    it('should provide examples of incorrect formats', () => {
      expect(ExpectedTranslations.missingTibetan).not.toContain('བཀྲ་ཤིས་བདེ་ལེགས།');
      expect(ExpectedTranslations.wrongFormat).not.toMatch(/\([^\)]*[\u0F00-\u0FFF][^\)]*\)/);
    });
  });

  describe('Translation Results', () => {
    it('should provide results with varying confidence', () => {
      expect(TranslationResults.highConfidence.confidence).toBeGreaterThan(0.9);
      expect(TranslationResults.mediumConfidence.confidence).toBeGreaterThan(0.7);
      expect(TranslationResults.lowConfidence.confidence).toBeLessThan(0.5);
    });

    it('should include metadata', () => {
      const result = TranslationResults.highConfidence;

      expect(result.metadata.model).toBeDefined();
      expect(result.metadata.provider).toBeDefined();
      expect(result.metadata.processingTime).toBeDefined();
    });
  });

  describe('Text Chunks', () => {
    it('should provide single chunk example', () => {
      const chunks = TestData.chunks.single;

      expect(chunks).toHaveLength(1);
      expect(chunks[0].id).toBe('chunk-1');
      expect(chunks[0].text).toBeTruthy();
    });

    it('should provide multiple chunks example', () => {
      const chunks = TestData.chunks.multiple;

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.id).toBeDefined();
        expect(chunk.text).toBeDefined();
        expect(chunk.pageNumber).toBeDefined();
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });
  });

  describe('Quality Scores', () => {
    it('should provide quality score examples', () => {
      const excellent = TestData.quality.excellent;

      expect(excellent.overall).toBeGreaterThan(0.9);
      expect(excellent.confidence).toBeDefined();
      expect(excellent.format).toBeDefined();
      expect(excellent.preservation).toBeDefined();
    });

    it('should provide varying quality levels', () => {
      expect(TestData.quality.excellent.overall).toBeGreaterThan(0.9);
      expect(TestData.quality.good.overall).toBeGreaterThan(0.7);
      expect(TestData.quality.poor.overall).toBeLessThan(0.5);
    });
  });

  describe('Dictionary Entries', () => {
    it('should provide common dictionary entries', () => {
      const entries = TestData.dictionary.common;

      expect(entries).toBeDefined();
      expect(entries.length).toBeGreaterThan(0);

      const firstEntry = entries[0];
      expect(firstEntry.tibetan).toBeDefined();
      expect(firstEntry.english).toBeDefined();
      expect(firstEntry.category).toBeDefined();
      expect(firstEntry.frequency).toBeDefined();
    });

    it('should categorize entries', () => {
      expect(TestData.dictionary.common).toBeDefined();
      expect(TestData.dictionary.religious).toBeDefined();
      expect(TestData.dictionary.technical).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    it('should create custom test data', () => {
      const customResult = createTestData(TranslationResults.highConfidence, {
        confidence: 0.75,
        metadata: { custom: true },
      });

      expect(customResult.confidence).toBe(0.75);
      expect(customResult.metadata.custom).toBe(true);
      expect(customResult.translation).toBe(TranslationResults.highConfidence.translation);
    });

    it('should generate test cases from template', () => {
      const template = {
        text: 'base text',
        confidence: 0.5,
        metadata: {},
      };

      const variations = [
        { confidence: 0.8 },
        { confidence: 0.9 },
        { text: 'different text' },
      ];

      const testCases = generateTestCases(template, variations);

      expect(testCases).toHaveLength(3);
      expect(testCases[0].confidence).toBe(0.8);
      expect(testCases[1].confidence).toBe(0.9);
      expect(testCases[2].text).toBe('different text');
    });
  });

  describe('Complete TestData Object', () => {
    it('should provide all data categories', () => {
      expect(TestData.tibetan).toBeDefined();
      expect(TestData.translations).toBeDefined();
      expect(TestData.results).toBeDefined();
      expect(TestData.chunks).toBeDefined();
      expect(TestData.quality).toBeDefined();
      expect(TestData.dictionary).toBeDefined();
      expect(TestData.examples).toBeDefined();
      expect(TestData.validation).toBeDefined();
      expect(TestData.metadata).toBeDefined();
    });
  });
});
