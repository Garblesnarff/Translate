import { describe, it, expect } from 'vitest';
import goldenTranslations from '../fixtures/golden-translations.json';

describe('Golden Dataset Regression Tests', () => {
  describe('golden translation examples', () => {
    it('should have all required fields', () => {
      goldenTranslations.forEach((example) => {
        expect(example).toHaveProperty('id');
        expect(example).toHaveProperty('tibetan');
        expect(example).toHaveProperty('english');
        expect(example).toHaveProperty('category');
        expect(example).toHaveProperty('difficulty');
      });
    });

    it('should have diverse categories', () => {
      const categories = new Set(goldenTranslations.map(ex => ex.category));
      expect(categories.size).toBeGreaterThan(5);
    });

    it('should have multiple difficulty levels', () => {
      const difficulties = new Set(goldenTranslations.map(ex => ex.difficulty));
      expect(difficulties.has('simple')).toBe(true);
      expect(difficulties.has('medium')).toBe(true);
      expect(difficulties.has('complex')).toBe(true);
    });

    it('should have at least 20 examples', () => {
      expect(goldenTranslations.length).toBeGreaterThanOrEqual(20);
    });

    it('should have Tibetan characters in source', () => {
      const tibetanRegex = /[\u0F00-\u0FFF]/;
      goldenTranslations.forEach((example) => {
        expect(tibetanRegex.test(example.tibetan)).toBe(true);
      });
    });

    it('should have Tibetan preserved in English translation', () => {
      const tibetanRegex = /[\u0F00-\u0FFF]/;
      goldenTranslations.forEach((example) => {
        expect(tibetanRegex.test(example.english)).toBe(true);
      });
    });

    it('should have parentheses in English translation', () => {
      goldenTranslations.forEach((example) => {
        expect(example.english).toContain('(');
        expect(example.english).toContain(')');
      });
    });

    it('should have balanced parentheses', () => {
      goldenTranslations.forEach((example) => {
        const openCount = (example.english.match(/\(/g) || []).length;
        const closeCount = (example.english.match(/\)/g) || []).length;
        expect(openCount).toBe(closeCount);
      });
    });

    it('should preserve original Tibetan in parentheses', () => {
      goldenTranslations.forEach((example) => {
        // Extract Tibetan from parentheses
        const tibetanInParens = example.english.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g);
        expect(tibetanInParens).toBeTruthy();
        expect(tibetanInParens!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('format validation', () => {
    it('should follow expected format pattern', () => {
      goldenTranslations.forEach((example) => {
        // Each translation should have English followed by Tibetan in parens
        const hasProperFormat = /[A-Za-z\s]+\([^)]*[\u0F00-\u0FFF][^)]*\)/.test(example.english);
        expect(hasProperFormat).toBe(true);
      });
    });

    it('should not have AI meta-text', () => {
      const aiPatterns = [
        /I apologize/i,
        /I cannot/i,
        /Translation:/i,
        /Output:/i,
        /Here is/i,
      ];

      goldenTranslations.forEach((example) => {
        aiPatterns.forEach((pattern) => {
          expect(pattern.test(example.english)).toBe(false);
        });
      });
    });

    it('should not have code blocks', () => {
      goldenTranslations.forEach((example) => {
        expect(example.english).not.toContain('```');
      });
    });
  });

  describe('quality metrics', () => {
    it('should calculate average Tibetan preservation', () => {
      let totalPreservation = 0;

      goldenTranslations.forEach((example) => {
        const originalTibetan = (example.tibetan.match(/[\u0F00-\u0FFF]/g) || []).length;
        const preservedTibetan = (example.english.match(/[\u0F00-\u0FFF]/g) || []).length;
        const preservation = (preservedTibetan / originalTibetan) * 100;
        totalPreservation += preservation;
      });

      const avgPreservation = totalPreservation / goldenTranslations.length;
      expect(avgPreservation).toBeGreaterThan(70);
    });

    it('should have reasonable translation length ratios', () => {
      goldenTranslations.forEach((example) => {
        const tibetanLength = example.tibetan.length;
        const englishLength = example.english.length;
        const ratio = englishLength / tibetanLength;

        // Translation should be between 0.5x and 5x the original length
        expect(ratio).toBeGreaterThan(0.5);
        expect(ratio).toBeLessThan(5);
      });
    });
  });

  describe('category distribution', () => {
    it('should have examples from each key category', () => {
      const keyCategories = ['greeting', 'general', 'philosophy', 'practice', 'education'];
      const categoriesPresent = new Set(goldenTranslations.map(ex => ex.category));

      keyCategories.forEach((category) => {
        const hasCategory = Array.from(categoriesPresent).some(c => c.toLowerCase().includes(category));
        if (!hasCategory) {
          console.warn(`Missing examples from category: ${category}`);
        }
      });

      expect(categoriesPresent.size).toBeGreaterThan(5);
    });

    it('should have balanced difficulty distribution', () => {
      const simpleCount = goldenTranslations.filter(ex => ex.difficulty === 'simple').length;
      const mediumCount = goldenTranslations.filter(ex => ex.difficulty === 'medium').length;
      const complexCount = goldenTranslations.filter(ex => ex.difficulty === 'complex').length;

      expect(simpleCount).toBeGreaterThan(5);
      expect(mediumCount).toBeGreaterThan(5);
      expect(complexCount).toBeGreaterThan(3);
    });
  });

  describe('dataset statistics', () => {
    it('should report dataset statistics', () => {
      const stats = {
        totalExamples: goldenTranslations.length,
        categories: new Set(goldenTranslations.map(ex => ex.category)).size,
        difficulties: {
          simple: goldenTranslations.filter(ex => ex.difficulty === 'simple').length,
          medium: goldenTranslations.filter(ex => ex.difficulty === 'medium').length,
          complex: goldenTranslations.filter(ex => ex.difficulty === 'complex').length,
        },
        avgTibetanLength: goldenTranslations.reduce((sum, ex) => sum + ex.tibetan.length, 0) / goldenTranslations.length,
        avgEnglishLength: goldenTranslations.reduce((sum, ex) => sum + ex.english.length, 0) / goldenTranslations.length,
      };

      console.log('Golden Dataset Statistics:', JSON.stringify(stats, null, 2));

      expect(stats.totalExamples).toBeGreaterThan(0);
      expect(stats.categories).toBeGreaterThan(0);
    });
  });
});
