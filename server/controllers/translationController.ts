/**
 * Translation Controller
 *
 * Handles translation-related HTTP requests and responses.
 * Contains business logic for translation endpoints.
 *
 * @author Translation Service Team
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { splitTextIntoChunks } from "../../client/src/lib/textChunker";
import { translationService } from '../services/translationService';
import { cancellationManager, CancellationManager } from '../services/CancellationManager';
import { createTranslationError } from '../middleware/errorHandler';
import { TranslationProgressEmitter } from '../lib/TranslationProgressEmitter';
import { db } from '@db/index';
import { getTables } from '@db/config';
import type { InsertTranslation } from '@db/types';
import { desc, eq, sql, asc } from 'drizzle-orm';
import {
  TranslationRequestSchema,
  TranslationConfigUpdateSchema,
  TranslationRetrievalRequestSchema,
  RecentTranslationsRequestSchema,
  SessionCancellationRequestSchema,
  type TranslationRequest,
  type TranslationConfigUpdate,
  type TranslationRetrievalRequest,
  type RecentTranslationsRequest,
  type SessionCancellationRequest
} from '../schemas/translationSchemas';
import { TranslationConfig } from '../services/translation/types';

/**
 * Handle regular translation requests
 */
export async function handleTranslation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  let sessionId: string | undefined;

  try {
    const validatedData = TranslationRequestSchema.parse(req.body);
    const { text, sessionId: providedSessionId } = validatedData;

    // Generate session ID if not provided
    sessionId = providedSessionId || randomUUID();
    const abortSignal = cancellationManager.createSession(sessionId, 'direct');

    const chunks = splitTextIntoChunks(text);
    if (chunks.length === 0) {
      throw createTranslationError(
        'No valid text chunks found',
        'INVALID_TEXT',
        400
      );
    }

    const translations = [];
    const errors = [];
    let confidenceScores = [];

    console.log('Starting parallel translation in pairs...');
    const results = [];

    // Determine translation configuration based on query parameters or defaults
    const useEnhancedMode = req.query.enhanced !== 'false'; // Default to enhanced mode
    const translationConfig: TranslationConfig = {
      useHelperAI: req.query.useHelperAI !== 'false',
      useMultiPass: req.query.useMultiPass !== 'false',
      maxIterations: parseInt(req.query.maxIterations as string) || 3,
      qualityThreshold: parseFloat(req.query.qualityThreshold as string) || 0.8,
      useChainOfThought: req.query.useChainOfThought === 'true',
      enableQualityAnalysis: req.query.enableQualityAnalysis !== 'false',
      timeout: 120000 // 2 minutes for enhanced processing
    };

    console.log(`Translation mode: ${useEnhancedMode ? 'Enhanced' : 'Legacy'}`);
    console.log(`Helper AI: ${translationConfig.useHelperAI ? 'Enabled' : 'Disabled'}`);
    console.log(`Multi-pass: ${translationConfig.useMultiPass ? 'Enabled' : 'Disabled'}`);

    // Process chunks in pairs using the enhanced translation service
    for (let i = 0; i < chunks.length; i += 2) {
      // Check if translation was cancelled
      CancellationManager.throwIfCancelled(abortSignal, 'chunk processing');

      const currentPair = [];

      // First chunk of the pair
      currentPair.push(
        (async () => {
          try {
            console.log(`Starting translation for page ${chunks[i].pageNumber}`);

            if (useEnhancedMode) {
              const result = await translationService.translateText(
                {
                  pageNumber: chunks[i].pageNumber,
                  content: chunks[i].text
                },
                translationConfig,
                abortSignal
              );

              console.log(`Page ${chunks[i].pageNumber} completed:`, {
                confidence: result.confidence.toFixed(3),
                modelAgreement: result.modelAgreement?.toFixed(3),
                iterations: result.iterationsUsed,
                models: result.helperModels?.length || 1,
                quality: result.quality?.grade,
                processingTime: result.processingTime
              });

              return {
                pageNumber: chunks[i].pageNumber,
                translation: result.translation,
                confidence: result.confidence,
                quality: result.quality,
                modelAgreement: result.modelAgreement,
                iterationsUsed: result.iterationsUsed,
                helperModels: result.helperModels,
                processingTime: result.processingTime
              };
            } else {
              // Legacy mode for backwards compatibility
              const result = await translationService.translateTextLegacy({pageNumber: chunks[i].pageNumber, content: chunks[i].text});
              return {
                pageNumber: chunks[i].pageNumber,
                translation: result.translation,
                confidence: result.confidence
              };
            }
          } catch (error) {
            console.error(`Error translating page ${chunks[i].pageNumber}:`, error);
            return {
              pageNumber: chunks[i].pageNumber,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })()
      );

      // Second chunk of the pair if it exists
      if (i + 1 < chunks.length) {
        currentPair.push(
          (async () => {
            try {
              console.log(`Starting translation for page ${chunks[i + 1].pageNumber}`);

              if (useEnhancedMode) {
                const result = await translationService.translateText(
                  {
                    pageNumber: chunks[i + 1].pageNumber,
                    content: chunks[i + 1].text
                  },
                  translationConfig,
                  abortSignal
                );

                console.log(`Page ${chunks[i + 1].pageNumber} completed:`, {
                  confidence: result.confidence.toFixed(3),
                  modelAgreement: result.modelAgreement?.toFixed(3),
                  iterations: result.iterationsUsed,
                  models: result.helperModels?.length || 1,
                  quality: result.quality?.grade,
                  processingTime: result.processingTime
                });

                return {
                  pageNumber: chunks[i + 1].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence,
                  quality: result.quality,
                  modelAgreement: result.modelAgreement,
                  iterationsUsed: result.iterationsUsed,
                  helperModels: result.helperModels,
                  processingTime: result.processingTime
                };
              } else {
                // Legacy mode for backwards compatibility
                const result = await translationService.translateTextLegacy({pageNumber: chunks[i + 1].pageNumber, content: chunks[i + 1].text});
                return {
                  pageNumber: chunks[i + 1].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence
                };
              }
            } catch (error) {
              console.error(`Error translating page ${chunks[i + 1].pageNumber}:`, error);
              return {
                pageNumber: chunks[i + 1].pageNumber,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })()
        );
      }

      // Wait for both chunks in the pair to complete
      const pairResults = await Promise.all(currentPair);
      results.push(...pairResults);
    }

    // Process results
    const allResults = results;
    for (const result of allResults) {
      if ('error' in result) {
        errors.push({
          pageNumber: result.pageNumber,
          error: result.error
        });
      } else {
        translations.push(result);
        confidenceScores.push(result.confidence);
      }
    }

    // Continue even if some translations fail
    if (translations.length === 0) {
      throw createTranslationError(
        'Translation failed for all pages',
        'TRANSLATION_FAILED',
        500,
        { errors }
      );
    }

    // Combine translated chunks in order
    const combinedText = translations
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map(t => t.translation.replace(/^## Translation of Tibetan Text \(Page \d+\)\n*/, ''))
      .join('\n\n');

    // Calculate average confidence score
    const averageConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    // Calculate enhanced metadata
    const totalProcessingTime = translations.reduce((sum: number, t: any) => sum + (t.processingTime || 0), 0);
    const averageModelAgreement = translations.length > 0
      ? translations.reduce((sum: number, t: any) => sum + (t.modelAgreement || 1), 0) / translations.length
      : 1;
    const totalIterations = translations.reduce((sum: number, t: any) => sum + (t.iterationsUsed || 1), 0);
    const uniqueHelperModels = [...new Set(translations.flatMap((t: any) => t.helperModels || []))];
    const qualityGrades = translations.map((t: any) => t.quality?.grade).filter(Boolean);
    const qualityDistribution = qualityGrades.reduce((acc: any, grade: string) => {
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    // Save translation to database
    const tables = getTables();
    const translationData: InsertTranslation = {
      sourceText: text,
      translatedText: combinedText,
      confidence: averageConfidence.toString(),
      pageCount: chunks.length,
      processingTime: Date.now() - startTime,
      textLength: text.length,
      status: 'completed'
    };

    const [savedTranslation] = await db.insert(tables.translations).values(translationData).returning();

    // Complete the session successfully
    cancellationManager.completeSession(sessionId);

    // Return enhanced translation results with comprehensive metadata
    res.json({
      id: savedTranslation.id,
      translatedText: combinedText,
      sessionId,
      metadata: {
        processingTime: Date.now() - startTime,
        totalModelProcessingTime: totalProcessingTime,
        chunkCount: chunks.length,
        successfulChunks: translations.length,
        failedChunks: errors.length,
        confidence: averageConfidence,
        modelAgreement: averageModelAgreement,
        totalIterations,
        averageIterationsPerChunk: translations.length > 0 ? totalIterations / translations.length : 0,
        helperModelsUsed: uniqueHelperModels,
        qualityDistribution,
        enhancedMode: useEnhancedMode,
        translationConfig: useEnhancedMode ? translationConfig : undefined,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    // Clean up session on error
    if (sessionId) {
      cancellationManager.cancelSession(sessionId);
    }
    // Handle validation errors
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid request data',
        'VALIDATION_ERROR',
        400,
        error.errors
      ));
      return;
    }

    // Handle known translation errors
    if (error instanceof Error && 'code' in error) {
      next(error);
      return;
    }

    // Handle unexpected errors
    next(createTranslationError(
      'An unexpected error occurred during translation',
      'UNKNOWN_ERROR',
      500,
      error instanceof Error ? error.message : undefined
    ));
  }
}

/**
 * Handle streaming translation requests with Server-Sent Events
 */
export async function handleStreamingTranslation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  let progressEmitter: TranslationProgressEmitter;
  let sessionId: string | undefined;

  try {
    const validatedData = TranslationRequestSchema.parse(req.body);
    const { text, sessionId: providedSessionId } = validatedData;

    // Generate session ID if not provided
    sessionId = providedSessionId || randomUUID();
    const abortSignal = cancellationManager.createSession(sessionId, 'stream');

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Create progress emitter
    progressEmitter = new TranslationProgressEmitter(res);

    progressEmitter.emit('start', {
      message: 'Starting translation process...',
      timestamp: Date.now()
    });

    const chunks = splitTextIntoChunks(text);
    if (chunks.length === 0) {
      progressEmitter.emit('error', {
        message: 'No valid text chunks found',
        code: 'INVALID_TEXT'
      });
      return;
    }

    progressEmitter.emit('progress', {
      message: `Processing ${chunks.length} pages...`,
      progress: 5,
      totalPages: chunks.length,
      currentPage: 0
    });

    // Determine translation configuration
    const useEnhancedMode = req.query.enhanced !== 'false';
    const translationConfig: TranslationConfig = {
      useHelperAI: req.query.useHelperAI !== 'false',
      useMultiPass: req.query.useMultiPass !== 'false',
      maxIterations: parseInt(req.query.maxIterations as string) || 3,
      qualityThreshold: parseFloat(req.query.qualityThreshold as string) || 0.8,
      useChainOfThought: req.query.useChainOfThought === 'true',
      enableQualityAnalysis: req.query.enableQualityAnalysis !== 'false',
      timeout: 120000
    };

    progressEmitter.emit('config', {
      message: `Translation mode: ${useEnhancedMode ? 'Enhanced' : 'Legacy'}`,
      config: {
        enhancedMode: useEnhancedMode,
        helperAI: translationConfig.useHelperAI,
        multiPass: translationConfig.useMultiPass,
        maxIterations: translationConfig.maxIterations
      }
    });

    const translations: any[] = [];
    const errors: any[] = [];
    let confidenceScores: number[] = [];

    // Process chunks with progress reporting
    for (let i = 0; i < chunks.length; i += 2) {
      // Check if translation was cancelled
      CancellationManager.throwIfCancelled(abortSignal, 'stream chunk processing');

      const currentPair: any[] = [];
      const startPage = i + 1;
      const endPage = Math.min(i + 2, chunks.length);

      progressEmitter.emit('pair_start', {
        message: `Processing pages ${startPage}-${endPage}...`,
        progress: Math.floor((i / chunks.length) * 80) + 10,
        currentPage: startPage,
        totalPages: chunks.length
      });

      // First chunk of the pair
      currentPair.push(
        (async () => {
          try {
            progressEmitter.emit('page_start', {
              message: `Translating page ${chunks[i].pageNumber}...`,
              pageNumber: chunks[i].pageNumber,
              pageType: chunks[i].pageNumber % 2 === 1 ? 'odd' : 'even'
            });

            if (useEnhancedMode) {
              const result = await translationService.translateText(
                {
                  pageNumber: chunks[i].pageNumber,
                  content: chunks[i].text
                },
                translationConfig,
                abortSignal
              );

              progressEmitter.emit('page_complete', {
                message: `Page ${chunks[i].pageNumber} completed`,
                pageNumber: chunks[i].pageNumber,
                confidence: result.confidence,
                modelAgreement: result.modelAgreement,
                iterations: result.iterationsUsed,
                models: result.helperModels?.length || 1,
                quality: result.quality?.grade,
                processingTime: result.processingTime
              });

              return {
                pageNumber: chunks[i].pageNumber,
                translation: result.translation,
                confidence: result.confidence,
                quality: result.quality,
                modelAgreement: result.modelAgreement,
                iterationsUsed: result.iterationsUsed,
                helperModels: result.helperModels,
                processingTime: result.processingTime
              };
            } else {
              const result = await translationService.translateTextLegacy({
                pageNumber: chunks[i].pageNumber,
                content: chunks[i].text
              });

              progressEmitter.emit('page_complete', {
                message: `Page ${chunks[i].pageNumber} completed (legacy)`,
                pageNumber: chunks[i].pageNumber,
                confidence: result.confidence
              });

              return {
                pageNumber: chunks[i].pageNumber,
                translation: result.translation,
                confidence: result.confidence
              };
            }
          } catch (error) {
            progressEmitter.emit('page_error', {
              message: `Error translating page ${chunks[i].pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              pageNumber: chunks[i].pageNumber,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
              pageNumber: chunks[i].pageNumber,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })()
      );

      // Second chunk of the pair if it exists
      if (i + 1 < chunks.length) {
        currentPair.push(
          (async () => {
            try {
              progressEmitter.emit('page_start', {
                message: `Translating page ${chunks[i + 1].pageNumber}...`,
                pageNumber: chunks[i + 1].pageNumber,
                pageType: chunks[i + 1].pageNumber % 2 === 1 ? 'odd' : 'even'
              });

              if (useEnhancedMode) {
                const result = await translationService.translateText(
                  {
                    pageNumber: chunks[i + 1].pageNumber,
                    content: chunks[i + 1].text
                  },
                  translationConfig,
                  abortSignal
                );

                progressEmitter.emit('page_complete', {
                  message: `Page ${chunks[i + 1].pageNumber} completed`,
                  pageNumber: chunks[i + 1].pageNumber,
                  confidence: result.confidence,
                  modelAgreement: result.modelAgreement,
                  iterations: result.iterationsUsed,
                  models: result.helperModels?.length || 1,
                  quality: result.quality?.grade,
                  processingTime: result.processingTime
                });

                return {
                  pageNumber: chunks[i + 1].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence,
                  quality: result.quality,
                  modelAgreement: result.modelAgreement,
                  iterationsUsed: result.iterationsUsed,
                  helperModels: result.helperModels,
                  processingTime: result.processingTime
                };
              } else {
                const result = await translationService.translateTextLegacy({
                  pageNumber: chunks[i + 1].pageNumber,
                  content: chunks[i + 1].text
                });

                progressEmitter.emit('page_complete', {
                  message: `Page ${chunks[i + 1].pageNumber} completed (legacy)`,
                  pageNumber: chunks[i + 1].pageNumber,
                  confidence: result.confidence
                });

                return {
                  pageNumber: chunks[i + 1].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence
                };
              }
            } catch (error) {
              progressEmitter.emit('page_error', {
                message: `Error translating page ${chunks[i + 1].pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                pageNumber: chunks[i + 1].pageNumber,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              return {
                pageNumber: chunks[i + 1].pageNumber,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })()
        );
      }

      // Wait for both pages in the pair to complete
      const pairResults = await Promise.all(currentPair);

      // Process results
      for (const result of pairResults) {
        if ('error' in result) {
          errors.push({
            pageNumber: result.pageNumber,
            error: result.error
          });
        } else {
          translations.push(result);
          confidenceScores.push(result.confidence);
        }
      }

      progressEmitter.emit('pair_complete', {
        message: `Pages ${startPage}-${endPage} completed`,
        progress: Math.floor(((i + 2) / chunks.length) * 80) + 10,
        completedPages: i + 2,
        totalPages: chunks.length,
        successfulTranslations: translations.length,
        errors: errors.length
      });
    }

    // Finalization phase
    progressEmitter.emit('finalizing', {
      message: 'Finalizing translation...',
      progress: 90
    });

    if (translations.length === 0) {
      progressEmitter.emit('error', {
        message: 'Translation failed for all pages',
        code: 'TRANSLATION_FAILED',
        errors
      });
      return;
    }

    // Combine translated chunks in order
    const combinedText = translations
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map(t => t.translation.replace(/^## Translation of Tibetan Text \(Page \d+\)\n*/, ''))
      .join('\n\n');

    // Calculate metadata
    const averageConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    const totalProcessingTime = translations.reduce((sum: number, t: any) => sum + (t.processingTime || 0), 0);
    const averageModelAgreement = translations.length > 0
      ? translations.reduce((sum: number, t: any) => sum + (t.modelAgreement || 1), 0) / translations.length
      : 1;

    progressEmitter.emit('saving', {
      message: 'Saving translation to database...',
      progress: 95
    });

    // Save translation to database
    const tables = getTables();
    const translationData: InsertTranslation = {
      sourceText: text,
      translatedText: combinedText,
      confidence: averageConfidence.toFixed(3),
      pageCount: chunks.length,
      textLength: text.length,
      processingTime: Date.now() - startTime,
      status: 'completed'
    };

    const [savedTranslation] = await db.insert(tables.translations).values(translationData).returning();

    // Send completion event
    progressEmitter.emit('complete', {
      message: 'Translation completed successfully!',
      progress: 100,
      result: {
        id: savedTranslation.id,
        translatedText: combinedText,
        confidence: averageConfidence,
        pageCount: chunks.length,
        processingTime: Date.now() - startTime,
        metadata: {
          successfulPages: translations.length,
          errorPages: errors.length,
          averageModelAgreement,
          useEnhancedMode
        }
      }
    });

    // Complete the session successfully
    if (sessionId) {
      cancellationManager.completeSession(sessionId);
    }

    progressEmitter.close();

  } catch (error) {
    console.error('Translation stream error:', error);

    // Clean up session on error
    if (sessionId) {
      cancellationManager.cancelSession(sessionId);
    }

    if (progressEmitter!) {
      progressEmitter.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'STREAM_ERROR'
      });
      progressEmitter.close();
    }
  }
}

/**
 * Get translation service capabilities
 */
export async function getTranslationCapabilities(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const capabilities = translationService.getCapabilities();
    res.json(capabilities);
  } catch (error) {
    next(error);
  }
}

/**
 * Get translation configuration
 */
export async function getTranslationConfig(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const config = translationService.getConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
}

/**
 * Update translation configuration
 */
export async function updateTranslationConfig(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const configUpdate = TranslationConfigUpdateSchema.parse(req.body);
    translationService.setConfig(configUpdate);
    res.json({
      message: 'Configuration updated successfully',
      config: translationService.getConfig()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid configuration data',
        'VALIDATION_ERROR',
        400,
        error.errors
      ));
      return;
    }
    next(error);
  }
}

/**
 * Get recent translations
 */
export async function getRecentTranslations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const queryParams = RecentTranslationsRequestSchema.parse(req.query);
    const { limit, offset } = queryParams;

    const tables = getTables();
    const recentTranslations = await db
      .select()
      .from(tables.translations)
      .orderBy(desc(tables.translations.createdAt))
      .limit(Math.min(limit, 50)) // Cap at 50
      .offset(offset);

    res.json({
      translations: recentTranslations,
      count: recentTranslations.length,
      limit,
      offset
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid query parameters',
        'VALIDATION_ERROR',
        400,
        error.errors
      ));
      return;
    }
    next(error);
  }
}

/**
 * Get specific translation by ID
 */
export async function getTranslation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = TranslationRetrievalRequestSchema.parse(req.params);
    const { id } = params;

    const tables = getTables();
    const translation = await db
      .select()
      .from(tables.translations)
      .where(eq(tables.translations.id, id))
      .limit(1);

    if (translation.length === 0) {
      throw createTranslationError('Translation not found', 'NOT_FOUND', 404);
    }

    res.json(translation[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid translation ID',
        'VALIDATION_ERROR',
        400,
        error.errors
      ));
      return;
    }
    next(error);
  }
}

/**
 * Cancel translation session
 */
export async function cancelTranslationSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = SessionCancellationRequestSchema.parse(req.params);
    const { sessionId } = params;

    const cancelled = cancellationManager.cancelSession(sessionId);

    res.json({
      success: true,
      cancelled,
      sessionId,
      message: cancelled ? 'Translation cancelled successfully' : 'Session not found or already completed'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid session ID',
        'VALIDATION_ERROR',
        400,
        error.errors
      ));
      return;
    }
    next(error);
  }
}

/**
 * Get active translation sessions
 */
export async function getActiveSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const activeSessions = cancellationManager.getActiveSessions();
    res.json({
      activeSessions,
      count: activeSessions.length
    });
  } catch (error) {
    next(error);
  }
}
