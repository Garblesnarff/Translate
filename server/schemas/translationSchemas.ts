/**
 * Translation Schemas
 *
 * Validation schemas for translation-related API requests.
 * Central location for all request/response validation schemas.
 *
 * @author Translation Service Team
 */

import { z } from 'zod';

// ========== Input Validation Schemas ==========

/**
 * Schema for validating Tibetan text input
 * Ensures text meets basic requirements before translation
 */
export const tibetanTextSchema = z.string()
  .min(10, 'Text must be at least 10 characters long')
  .max(100000, 'Text must not exceed 100,000 characters')
  .refine((text) => {
    // Check if text contains Tibetan characters (U+0F00-U+0FFF)
    const tibetanChars = text.match(/[\u0F00-\u0FFF]/g);
    return tibetanChars && tibetanChars.length > 0;
  }, {
    message: 'Text must contain Tibetan characters (Unicode U+0F00-U+0FFF)'
  });

/**
 * Schema for validating translation chunks
 */
export const chunkSchema = z.object({
  pageNumber: z.number().int().positive(),
  content: tibetanTextSchema,
  text: z.string().optional(), // For backwards compatibility
});

/**
 * Schema for translation configuration
 */
export const configSchema = z.object({
  useHelperAI: z.boolean().optional().default(true),
  useMultiPass: z.boolean().optional().default(true),
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
  qualityThreshold: z.number().min(0).max(1).optional().default(0.8),
  useChainOfThought: z.boolean().optional().default(false),
  contextWindow: z.number().int().min(0).max(10).optional().default(2),
  enableQualityAnalysis: z.boolean().optional().default(true),
  timeout: z.number().int().positive().optional().default(90000)
});

// ========== Output Validation Schemas ==========

/**
 * Schema for translation quality analysis
 */
export const qualityReportSchema = z.object({
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  strengths: z.array(z.string()),
  formatCompliance: z.number().min(0).max(100).optional(),
  termConsistency: z.number().min(0).max(100).optional(),
  contextAccuracy: z.number().min(0).max(100).optional(),
  structuralIntegrity: z.number().min(0).max(100).optional()
});

/**
 * Schema for translation result
 */
export const translationResultSchema = z.object({
  translation: z.string().min(1, 'Translation cannot be empty'),
  confidence: z.number().min(0).max(1),
  quality: qualityReportSchema.optional(),
  modelAgreement: z.number().min(0).max(1).optional(),
  iterationsUsed: z.number().int().positive().optional(),
  helperModels: z.array(z.string()).optional(),
  processingTime: z.number().positive().optional(),
  metadata: z.record(z.any()).optional()
});

// ========== API Request Schemas ==========

/**
 * Schema for validating translation requests
 */
export const TranslationRequestSchema = z.object({
  text: tibetanTextSchema,
  sessionId: z.string().optional(), // Optional session ID for cancellation tracking
  config: configSchema.optional()
});

/**
 * Schema for validating batch translation requests
 */
export const BatchTranslationRequestSchema = z.object({
  files: z.array(z.any()).min(1), // Array of uploaded files
});

/**
 * Schema for validating PDF generation requests
 */
export const PDFGenerationRequestSchema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    tibetanText: z.string(),
    englishText: z.string(),
    confidence: z.number().min(0).max(1)
  })).min(1)
});

/**
 * Schema for validating translation configuration updates
 */
export const TranslationConfigUpdateSchema = z.object({
  useHelperAI: z.boolean().optional(),
  useMultiPass: z.boolean().optional(),
  maxIterations: z.number().int().min(1).max(5).optional(),
  qualityThreshold: z.number().min(0).max(1).optional(),
  useChainOfThought: z.boolean().optional(),
  enableQualityAnalysis: z.boolean().optional(),
  timeout: z.number().int().positive().optional()
});

/**
 * Schema for validating batch job status requests
 */
export const BatchJobStatusRequestSchema = z.object({
  jobId: z.string().uuid()
});

/**
 * Schema for validating translation retrieval requests
 */
export const TranslationRetrievalRequestSchema = z.object({
  id: z.number().int().positive()
});

/**
 * Schema for validating recent translations requests
 */
export const RecentTranslationsRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  offset: z.number().int().min(0).optional().default(0)
});

/**
 * Schema for validating session cancellation requests
 */
export const SessionCancellationRequestSchema = z.object({
  sessionId: z.string().min(1)
});

/**
 * Type exports for use in controllers
 */
export type TibetanText = z.infer<typeof tibetanTextSchema>;
export type TranslationChunk = z.infer<typeof chunkSchema>;
export type TranslationConfig = z.infer<typeof configSchema>;
export type QualityReport = z.infer<typeof qualityReportSchema>;
export type TranslationResult = z.infer<typeof translationResultSchema>;
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;
export type BatchTranslationRequest = z.infer<typeof BatchTranslationRequestSchema>;
export type PDFGenerationRequest = z.infer<typeof PDFGenerationRequestSchema>;
export type TranslationConfigUpdate = z.infer<typeof TranslationConfigUpdateSchema>;
export type BatchJobStatusRequest = z.infer<typeof BatchJobStatusRequestSchema>;
export type TranslationRetrievalRequest = z.infer<typeof TranslationRetrievalRequestSchema>;
export type RecentTranslationsRequest = z.infer<typeof RecentTranslationsRequestSchema>;
export type SessionCancellationRequest = z.infer<typeof SessionCancellationRequestSchema>;
