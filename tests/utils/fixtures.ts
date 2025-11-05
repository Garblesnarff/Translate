// File: tests/utils/fixtures.ts
// Comprehensive test data and fixtures

import path from 'path';

/**
 * Tibetan text samples covering various complexity levels
 */
export const TibetanText = {
  // Simple greeting
  simple: 'བཀྲ་ཤིས་བདེ་ལེགས།',

  // Simple sentence with punctuation
  simpleSentence: 'ང་བོད་པ་ཡིན། ངའི་མིང་ལ་བསྟན་འཛིན་ཞེས་ཟེར།',

  // Paragraph with multiple sentences
  paragraph: `བཀྲ་ཤིས་བདེ་ལེགས། ང་རང་བོད་ཀྱི་ལྷ་ས་ནས་ཡིན།
ང་ད་ལྟ་སློབ་གྲྭ་ཆེན་མོ་ཞིག་ཏུ་སློབ་སྦྱོང་བྱེད་བཞིན་ཡོད།
ང་ལ་དེབ་ཀློག་པ་དང་ཡི་གེ་འབྲི་བ་ཧ་ཅང་དགའ་པོ་ཡོད།`,

  // Text with Sanskrit terms (common in Buddhist texts)
  withSanskrit: `ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ། དེ་ནི་སྙིང་རྗེའི་སྔགས་ཡིན།
སངས་རྒྱས་ཀྱི་བསྟན་པ་ནི་ཤིན་ཏུ་གཏིང་ཟབ་ཡིན།`,

  // Multi-page text simulation
  multiPage: `པར་བྱང་། དཔལ་ལྡན་ས་སྐྱའི་གསུང་རབ་ཕྱོགས་བསྒྲིགས།

པར་བྱང་།
དཔལ་ལྡན་ས་སྐྱའི་གསུང་རབ་ཕྱོགས་བསྒྲིགས་ནི།
རྒྱལ་བའི་གསུང་རབ་ཀྱི་དོན་རྣམས་བསྡུས་པའི་མཛོད་ཆེན་པོ་ཞིག་ཡིན།

དཀར་ཆག
ལེའུ་དང་པོ། སྔོན་འགྲོའི་ཆོས་སྐོར།
ལེའུ་གཉིས་པ། དངོས་གཞིའི་ཆོས་སྐོར།
ལེའུ་གསུམ་པ། མཇུག་གི་ཕྱག་ལེན།

ལེའུ་དང་པོ།
སྔོན་འགྲོའི་ཆོས་སྐོར།

རིག་འཛིན་ཆེན་པོ་རྣམས་ཀྱིས།
སེམས་ཅན་ཀུན་གྱི་དོན་དུ།
སྙིང་རྗེ་ཆེན་པོས་བསྐུལ་ནས།
ཆོས་ཀྱི་འཁོར་ལོ་བསྐོར་བ་ལགས།`,

  // Text with various punctuation marks
  withPunctuation: `བཀྲ་ཤིས་བདེ་ལེགས། ཁྱེད་རང་བདེ་མོ་ཡིན་ནམ༎
ང་ཚོས་དེ་རིང་ག་རེ་བྱེད་དགོས་སམ༎ དགོང་དག་ལ་ཕྱིར་འོང་རྒྱུ་ཡིན།`,

  // Longer religious text
  religious: `ན་མོ་གུ་རུ་བྷྱཿ
བླ་མ་དང་སངས་རྒྱས་དང་བྱང་ཆུབ་སེམས་དཔའ་རྣམས་ལ་ཕྱག་འཚལ་ལོ།
བདག་གིས་དགེ་བའི་རྩ་བ་གང་བསགས་པ་ཐམས་ཅད།
སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ་བསྔོ་བར་བགྱིའོ།`,

  // Text with numbers (Tibetan numerals)
  withNumbers: 'སློབ་ཕྲུག་༡༠༠ དང་དགེ་རྒན་༢༠ ཡོད།',

  // Mixed Tibetan and English (common in modern texts)
  mixed: 'བོད་ཀྱི་སློབ་གྲྭ་ནི་Dharamsala ལ་ཡོད། ད་ལྟ་student ༡༠༠ བཞུགས་ཡོད།',

  // Empty/edge cases
  empty: '',
  whitespace: '   ',
  singleTsek: '་',
  singleShad: '།',
};

/**
 * Expected translations for testing output validation
 */
export const ExpectedTranslations = {
  // Proper format: English with Tibetan in parentheses
  valid: 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།). May you be well.',

  // Missing Tibetan preservation
  missingTibetan: 'Greetings. May you be well.',

  // Wrong format: Tibetan not in parentheses
  wrongFormat: 'Translation: Greetings བཀྲ་ཤིས་བདེ་ལེགས།',

  // Tibetan after English (correct format)
  properFormat: 'I am Tibetan (ང་བོད་པ་ཡིན།). My name is Tenzin (ངའི་མིང་ལ་བསྟན་འཛིན་ཞེས་ཟེར།).',

  // Multiple paragraphs
  multiParagraph: `Greetings (བཀྲ་ཤིས་བདེ་ལེགས།). I am from Lhasa, Tibet (ང་རང་བོད་ཀྱི་ལྷ་ས་ནས་ཡིན།).

I am currently studying at a university (ང་ད་ལྟ་སློབ་གྲྭ་ཆེན་མོ་ཞིག་ཏུ་སློབ་སྦྱོང་བྱེད་བཞིན་ཡོད།). I love reading books and writing (ང་ལ་དེབ་ཀློག་པ་དང་ཡི་གེ་འབྲི་བ་ཧ་ཅང་དགའ་པོ་ཡོད།).`,

  // With Sanskrit
  withSanskrit: 'Om Mani Padme Hum (ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ།). This is the mantra of compassion (དེ་ནི་སྙིང་རྗེའི་སྔགས་ཡིན།).',
};

/**
 * Translation result samples for testing
 */
export const TranslationResults = {
  highConfidence: {
    translation: ExpectedTranslations.valid,
    confidence: 0.95,
    metadata: {
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      processingTime: 250,
    },
  },

  mediumConfidence: {
    translation: ExpectedTranslations.valid,
    confidence: 0.75,
    metadata: {
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      processingTime: 300,
    },
  },

  lowConfidence: {
    translation: ExpectedTranslations.wrongFormat,
    confidence: 0.45,
    metadata: {
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      processingTime: 400,
    },
  },

  withWarnings: {
    translation: ExpectedTranslations.valid,
    confidence: 0.82,
    metadata: {
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      warnings: ['Low Tibetan character preservation'],
    },
  },
};

/**
 * Text chunks for testing chunking functionality
 */
export const TextChunks = {
  single: [
    {
      id: 'chunk-1',
      text: TibetanText.simple,
      pageNumber: 1,
      tokenCount: 10,
      startIndex: 0,
      endIndex: TibetanText.simple.length,
    },
  ],

  multiple: [
    {
      id: 'chunk-1',
      text: TibetanText.simpleSentence.split('།')[0] + '།',
      pageNumber: 1,
      tokenCount: 15,
      startIndex: 0,
      endIndex: 50,
    },
    {
      id: 'chunk-2',
      text: TibetanText.simpleSentence.split('།')[1],
      pageNumber: 1,
      tokenCount: 18,
      startIndex: 50,
      endIndex: 100,
    },
  ],

  withOverlap: [
    {
      id: 'chunk-1',
      text: TibetanText.paragraph.substring(0, 100),
      pageNumber: 1,
      tokenCount: 50,
      overlap: '',
    },
    {
      id: 'chunk-2',
      text: TibetanText.paragraph.substring(80, 180), // 20 chars overlap
      pageNumber: 1,
      tokenCount: 50,
      overlap: TibetanText.paragraph.substring(80, 100),
    },
  ],
};

/**
 * Quality score samples
 */
export const QualityScores = {
  excellent: {
    overall: 0.95,
    confidence: 0.96,
    format: 0.98,
    preservation: 0.92,
  },

  good: {
    overall: 0.82,
    confidence: 0.85,
    format: 0.88,
    preservation: 0.75,
  },

  poor: {
    overall: 0.45,
    confidence: 0.50,
    format: 0.60,
    preservation: 0.30,
  },

  failing: {
    overall: 0.35,
    confidence: 0.40,
    format: 0.45,
    preservation: 0.20,
  },
};

/**
 * PDF fixtures (paths relative to project root)
 */
export const PDFFixtures = {
  // Note: These would be actual test PDF files in tests/fixtures/pdfs/
  digital: path.join(process.cwd(), 'tests/fixtures/pdfs/digital-text.pdf'),
  scanned: path.join(process.cwd(), 'tests/fixtures/pdfs/scanned-image.pdf'),
  multiColumn: path.join(process.cwd(), 'tests/fixtures/pdfs/two-column.pdf'),
  mixed: path.join(process.cwd(), 'tests/fixtures/pdfs/mixed-layout.pdf'),
  largeFile: path.join(process.cwd(), 'tests/fixtures/pdfs/large-document.pdf'),
};

/**
 * Dictionary entries for testing
 */
export const DictionaryEntries = {
  common: [
    {
      id: 'dict-1',
      tibetan: 'བཀྲ་ཤིས་བདེ་ལེགས',
      english: 'greetings',
      wylie: 'bkra shis bde legs',
      category: 'greeting',
      frequency: 'very_common',
      context: 'Used as a greeting in Tibetan',
    },
    {
      id: 'dict-2',
      tibetan: 'སངས་རྒྱས',
      english: 'Buddha',
      wylie: 'sangs rgyas',
      category: 'religious',
      frequency: 'common',
      context: 'The enlightened one',
    },
    {
      id: 'dict-3',
      tibetan: 'སྙིང་རྗེ',
      english: 'compassion',
      wylie: 'snying rje',
      category: 'religious',
      frequency: 'common',
      context: 'A core Buddhist concept',
    },
  ],

  religious: [
    {
      id: 'dict-4',
      tibetan: 'བླ་མ',
      english: 'spiritual teacher',
      wylie: 'bla ma',
      sanskrit: 'guru',
      category: 'religious',
      frequency: 'common',
    },
    {
      id: 'dict-5',
      tibetan: 'ཆོས',
      english: 'dharma',
      wylie: 'chos',
      sanskrit: 'dharma',
      category: 'religious',
      frequency: 'very_common',
    },
  ],

  technical: [
    {
      id: 'dict-6',
      tibetan: 'ཀློག་མཁན',
      english: 'reader',
      wylie: 'klog mkhan',
      category: 'general',
      frequency: 'common',
    },
  ],
};

/**
 * Example translations with embeddings for testing
 */
export const TranslationExamples = {
  basic: [
    {
      id: 'ex-1',
      tibetan: TibetanText.simple,
      english: 'Greetings',
      category: 'greeting',
      embedding: null, // Would be populated in real usage
    },
    {
      id: 'ex-2',
      tibetan: 'ཐུགས་རྗེ་ཆེ།',
      english: 'Thank you',
      category: 'greeting',
      embedding: null,
    },
  ],

  religious: [
    {
      id: 'ex-3',
      tibetan: 'ན་མོ་བུདྡྷ་ཡ།',
      english: 'Homage to the Buddha',
      category: 'religious',
      embedding: null,
    },
  ],
};

/**
 * Validation error samples
 */
export const ValidationErrors = {
  missingTibetan: {
    isValid: false,
    errors: ['Text must contain at least 50% Tibetan characters'],
    warnings: [],
  },

  lowQuality: {
    isValid: true,
    errors: [],
    warnings: ['Text contains less than 70% Tibetan characters'],
  },

  unicodeError: {
    isValid: false,
    errors: ['Invalid Unicode sequence detected'],
    warnings: [],
  },

  formatError: {
    isValid: false,
    errors: ['Translation does not preserve Tibetan text in parentheses'],
    warnings: [],
  },
};

/**
 * Test metadata samples
 */
export const MetadataSamples = {
  extraction: {
    pageCount: 5,
    layout: 'single-column',
    quality: 'high',
    extractionMethod: 'native',
    hasImages: false,
    language: 'tibetan',
  },

  translation: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    timestamp: Date.now(),
    processingTime: 250,
    tokensUsed: 1500,
    cached: false,
  },

  quality: {
    overall: 0.85,
    confidence: 0.88,
    format: 0.90,
    preservation: 0.78,
    passedGates: ['confidence', 'format'],
    failedGates: [],
  },
};

/**
 * Complete test data object
 */
export const TestData = {
  tibetan: TibetanText,
  translations: ExpectedTranslations,
  results: TranslationResults,
  chunks: TextChunks,
  quality: QualityScores,
  pdfs: PDFFixtures,
  dictionary: DictionaryEntries,
  examples: TranslationExamples,
  validation: ValidationErrors,
  metadata: MetadataSamples,
};

/**
 * Helper to create custom test data
 */
export function createTestData<T>(defaults: T, overrides: Partial<T>): T {
  return { ...defaults, ...overrides };
}

/**
 * Helper to generate multiple test cases
 */
export function generateTestCases<T>(
  template: T,
  variations: Partial<T>[]
): T[] {
  return variations.map(variation => ({ ...template, ...variation }));
}

export default TestData;
