/**
 * Translation Schemas
 *
 * Validation schemas for translation-related API requests.
 * Central location for all request/response validation schemas.
 *
 * @author Translation Service Team
 */

import { z } from 'zod';

/**
 * Schema for validating translation requests
 */
export const TranslationRequestSchema = z.object({
  text: z.string().min(1).max(100000),
  sessionId: z.string().optional(), // Optional session ID for cancellation tracking
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
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;
export type BatchTranslationRequest = z.infer<typeof BatchTranslationRequestSchema>;
export type PDFGenerationRequest = z.infer<typeof PDFGenerationRequestSchema>;
export type TranslationConfigUpdate = z.infer<typeof TranslationConfigUpdateSchema>;
export type BatchJobStatusRequest = z.infer<typeof BatchJobStatusRequestSchema>;
export type TranslationRetrievalRequest = z.infer<typeof TranslationRetrievalRequestSchema>;
export type RecentTranslationsRequest = z.infer<typeof RecentTranslationsRequestSchema>;
export type SessionCancellationRequest = z.infer<typeof SessionCancellationRequestSchema>;
