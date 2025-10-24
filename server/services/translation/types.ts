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
}

export interface EnhancedTranslationResult {
  translation: string;
  confidence: number;
  quality?: TranslationQuality;
  modelAgreement?: number;
  iterationsUsed?: number;
  helperModels?: string[];
  processingTime?: number;
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

export interface Glossary {
  [key: string]: string;
}

export interface GeminiTranslationResult {
  translation: string;
  confidence: number;
  glossary?: Glossary;
}

export interface RefinementResult {
  translation: string;
  confidence: number;
}

export interface ReferenceTranslation {
  source: string;
  translation: string;
}
