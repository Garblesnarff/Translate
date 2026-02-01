/**
 * Translation Types and Interfaces
 *
 * Central location for all translation-related type definitions.
 * This file contains interfaces and types used across the translation service.
 *
 * @author Translation Service Team
 */

export interface TranslationConfig {
  useHelperAI?: boolean;
  useMultiPass?: boolean;
  maxIterations?: number;
  qualityThreshold?: number;
  useChainOfThought?: boolean;
  contextWindow?: number;
  enableQualityAnalysis?: boolean;
  timeout?: number;
  // New optional features from PR #1 cherry-pick
  useExpertPanel?: boolean;        // Enable panel of experts quality gate
  useReferenceTranslations?: boolean; // Enable in-context learning
  extractGlossary?: boolean;       // Extract glossary during translation
}

export interface ValidationMetadata {
  inputValidation?: {
    tibetanPercentage?: number;
    textLength?: number;
  };
  outputValidation?: {
    isValid: boolean;
    formatCompliance?: number;
    tibetanPreservation?: number;
    completeness?: number;
    errors?: string[];
    warnings?: string[];
  };
  glossary?: {
    termsExtracted: number;
    glossarySize: number;
    consistencyScore?: number;
    inconsistencyWarnings?: number;
  };
}

export interface EnhancedTranslationResult {
  translation: string;
  confidence: number;
  quality?: TranslationQuality;
  modelAgreement?: number;
  iterationsUsed?: number;
  helperModels?: string[];
  processingTime?: number;
  validationMetadata?: ValidationMetadata;
  errorRecovery?: {
    usedFallback: boolean;
    fallbackStrategy?: string;
  };
}

export interface TranslationChunk {
  pageNumber: number;
  content: string;
  context?: TranslationContext;
}

export interface TranslationContext {
  previousPage?: string;
  nextPage?: string;
  documentTitle?: string;
  chapter?: string;
}

export interface QualityMetrics {
  overallScore: number;
  dictionaryUsage: number;
  structuralIntegrity: number;
  terminologyConsistency: number;
  completeness: number;
  naturalness: number;
  details: QualityDetail[];
}

export interface QualityDetail {
  aspect: string;
  score: number;
  description: string;
  issues?: string[];
  suggestions?: string[];
}

export interface TranslationQuality {
  metrics: QualityMetrics;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  confidence: number;
  recommendations: string[];
}

export interface AIResponse {
  provider: string;
  model: string;
  translation: string;
  confidence: number;
  processingTime: number;
}

export interface GeminiTranslationResult {
  translation: string;
  confidence: number;
}

export interface RefinementResult {
  translation: string;
  confidence: number;
}

// New types from PR #1 cherry-pick

/**
 * Glossary mapping Tibetan terms to English translations
 */
export interface Glossary {
  [tibetanTerm: string]: string;
}

/**
 * Reference translation pair for in-context learning
 */
export interface ReferenceTranslation {
  source: string;       // Original Tibetan text
  translation: string;  // English translation
  context?: string;     // Optional context (e.g., "Heart Sutra", "Sakya lineage")
}

/**
 * Expert critique from panel of experts quality gate
 */
export interface ExpertCritique {
  expert: string;       // Expert type (e.g., "Historian", "Linguist")
  critique: string;     // The critique text
  hasIssues: boolean;   // Whether significant issues were found
}
