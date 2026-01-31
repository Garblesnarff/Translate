/**
 * Similarity Calculator
 *
 * Calculates semantic similarity between two texts for regression testing.
 * Uses multiple methods: word overlap, n-gram similarity, and character-level similarity.
 *
 * @module tests/utils/similarity
 */

/**
 * Calculate semantic similarity between two texts
 * Returns a score between 0 and 1, where:
 * - 1.0 = identical
 * - 0.9+ = very similar
 * - 0.8+ = similar (acceptable for regression)
 * - 0.7+ = somewhat similar
 * - <0.7 = different
 *
 * @param text1 - First text to compare
 * @param text2 - Second text to compare
 * @param options - Calculation options
 * @returns Similarity score (0-1)
 */
export function calculateSimilarity(
  text1: string,
  text2: string,
  options: {
    /** Weight for word overlap similarity (0-1) */
    wordOverlapWeight?: number;
    /** Weight for character n-gram similarity (0-1) */
    ngramWeight?: number;
    /** Weight for token-level similarity (0-1) */
    tokenWeight?: number;
    /** Case sensitive comparison */
    caseSensitive?: boolean;
  } = {}
): number {
  const {
    wordOverlapWeight = 0.5,
    ngramWeight = 0.3,
    tokenWeight = 0.2,
    caseSensitive = false,
  } = options;

  // Normalize texts if case-insensitive
  const t1 = caseSensitive ? text1 : text1.toLowerCase();
  const t2 = caseSensitive ? text2 : text2.toLowerCase();

  // Calculate component similarities
  const wordSim = calculateWordOverlapSimilarity(t1, t2);
  const ngramSim = calculateNGramSimilarity(t1, t2, 3);
  const tokenSim = calculateTokenSimilarity(t1, t2);

  // Weighted average
  const totalWeight = wordOverlapWeight + ngramWeight + tokenWeight;
  const similarity = (
    wordSim * wordOverlapWeight +
    ngramSim * ngramWeight +
    tokenSim * tokenWeight
  ) / totalWeight;

  return Math.max(0, Math.min(1, similarity));
}

/**
 * Calculate word overlap similarity (Jaccard similarity)
 * Compares unique words between texts
 */
function calculateWordOverlapSimilarity(text1: string, text2: string): number {
  const words1 = new Set(tokenize(text1));
  const words2 = new Set(tokenize(text2));

  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  // Calculate Jaccard similarity: |A ∩ B| / |A ∪ B|
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate n-gram similarity
 * Compares character n-grams for substring matching
 */
function calculateNGramSimilarity(text1: string, text2: string, n: number = 3): number {
  const ngrams1 = extractNGrams(text1, n);
  const ngrams2 = extractNGrams(text2, n);

  if (ngrams1.length === 0 && ngrams2.length === 0) return 1.0;
  if (ngrams1.length === 0 || ngrams2.length === 0) return 0.0;

  // Create frequency maps
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();

  ngrams1.forEach(ng => freq1.set(ng, (freq1.get(ng) || 0) + 1));
  ngrams2.forEach(ng => freq2.set(ng, (freq2.get(ng) || 0) + 1));

  // Calculate cosine similarity
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  const allNgrams = new Set([...freq1.keys(), ...freq2.keys()]);

  for (const ngram of allNgrams) {
    const f1 = freq1.get(ngram) || 0;
    const f2 = freq2.get(ngram) || 0;
    dotProduct += f1 * f2;
    magnitude1 += f1 * f1;
    magnitude2 += f2 * f2;
  }

  if (magnitude1 === 0 || magnitude2 === 0) return 0.0;

  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

/**
 * Calculate token-level similarity using edit distance
 */
function calculateTokenSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  // Use Levenshtein distance at token level
  const distance = levenshteinDistance(tokens1, tokens2);
  const maxLength = Math.max(tokens1.length, tokens2.length);

  return 1 - (distance / maxLength);
}

/**
 * Tokenize text into words (preserving Tibetan characters)
 */
function tokenize(text: string): string[] {
  // Split on whitespace and punctuation, but preserve Tibetan characters
  const tokens = text
    .split(/[\s,\.!?;:\(\)\[\]\{\}]+/)
    .filter(t => t.length > 0);

  return tokens;
}

/**
 * Extract character n-grams from text
 */
function extractNGrams(text: string, n: number): string[] {
  const ngrams: string[] = [];
  const cleaned = text.replace(/\s+/g, ' ').trim();

  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.push(cleaned.substring(i, i + n));
  }

  return ngrams;
}

/**
 * Calculate Levenshtein distance between two arrays
 */
function levenshteinDistance<T>(arr1: T[], arr2: T[]): number {
  const m = arr1.length;
  const n = arr2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate percentage of Tibetan characters preserved
 * This is critical for translation quality
 */
export function calculateTibetanPreservation(original: string, translation: string): number {
  const tibetanRegex = /[\u0F00-\u0FFF]/g;

  const originalTibetan = (original.match(tibetanRegex) || []).length;
  const preservedTibetan = (translation.match(tibetanRegex) || []).length;

  if (originalTibetan === 0) return 1.0; // No Tibetan to preserve

  // Calculate preservation rate (should be close to 100%)
  return preservedTibetan / originalTibetan;
}

/**
 * Check if translation follows the expected format:
 * "English text (བོད་སྐད་) more English (more Tibetan)."
 */
export function validateTranslationFormat(translation: string, original: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 1.0;

  // Check for Tibetan preservation
  const tibetanRegex = /[\u0F00-\u0FFF]/;
  if (!tibetanRegex.test(translation)) {
    errors.push('Translation does not preserve Tibetan characters');
    score -= 0.5;
  }

  // Check for parentheses (Tibetan should be in parentheses)
  if (!translation.includes('(') || !translation.includes(')')) {
    warnings.push('Translation should include parentheses for Tibetan preservation');
    score -= 0.1;
  }

  // Check for balanced parentheses
  const openCount = (translation.match(/\(/g) || []).length;
  const closeCount = (translation.match(/\)/g) || []).length;
  if (openCount !== closeCount) {
    errors.push('Unbalanced parentheses in translation');
    score -= 0.2;
  }

  // Check for AI meta-text (should not exist)
  const aiPatterns = [
    /I apologize/i,
    /I cannot/i,
    /Translation:/i,
    /Output:/i,
    /Here is/i,
  ];

  for (const pattern of aiPatterns) {
    if (pattern.test(translation)) {
      errors.push(`Translation contains AI meta-text: ${pattern}`);
      score -= 0.3;
    }
  }

  // Check preservation rate
  const preservation = calculateTibetanPreservation(original, translation);
  if (preservation < 0.7) {
    errors.push(`Low Tibetan preservation rate: ${(preservation * 100).toFixed(0)}%`);
    score -= 0.2;
  } else if (preservation < 0.9) {
    warnings.push(`Moderate Tibetan preservation rate: ${(preservation * 100).toFixed(0)}%`);
    score -= 0.1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, Math.min(1, score)),
  };
}

/**
 * Calculate comprehensive similarity metrics for regression testing
 */
export function calculateComprehensiveSimilarity(
  text1: string,
  text2: string,
  original?: string
): {
  overallScore: number;
  wordOverlap: number;
  ngramSimilarity: number;
  tokenSimilarity: number;
  tibetanPreservation?: number;
  formatValidation?: ReturnType<typeof validateTranslationFormat>;
} {
  const wordOverlap = calculateWordOverlapSimilarity(
    text1.toLowerCase(),
    text2.toLowerCase()
  );
  const ngramSimilarity = calculateNGramSimilarity(text1, text2, 3);
  const tokenSimilarity = calculateTokenSimilarity(text1, text2);

  const overallScore = calculateSimilarity(text1, text2);

  const result: ReturnType<typeof calculateComprehensiveSimilarity> = {
    overallScore,
    wordOverlap,
    ngramSimilarity,
    tokenSimilarity,
  };

  if (original) {
    result.tibetanPreservation = calculateTibetanPreservation(original, text1);
    result.formatValidation = validateTranslationFormat(text1, original);
  }

  return result;
}
