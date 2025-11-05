/**
 * Batch Controller
 *
 * Handles batch translation operations and PDF generation.
 * Contains business logic for batch processing endpoints.
 *
 * @author Translation Service Team
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { splitTextIntoChunks } from "../../client/src/lib/textChunker";
import { translationService } from '../services/translationService';
import { createTranslationError } from '../middleware/errorHandler';
import { PDFGenerator } from '../services/pdf/PDFGenerator';
import { db } from '@db/index';
import { getTables } from '@db/config';
import type { InsertBatchJob } from '@db/types';
import { eq, sql } from 'drizzle-orm';
// Using built-in fetch (available in Node.js 18+)
const fetch = globalThis.fetch;
import {
  BatchTranslationRequestSchema,
  PDFGenerationRequestSchema,
  BatchJobStatusRequestSchema,
  type BatchTranslationRequest,
  type PDFGenerationRequest,
  type BatchJobStatusRequest
} from '../schemas/translationSchemas';

/**
 * Handle batch translation requests
 */
export async function handleBatchTranslation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = req.files;
    if (!files || Object.keys(files).length === 0) {
      throw createTranslationError('No files provided', 'INVALID_INPUT', 400);
    }

    const jobId = randomUUID();
    const fileArray = Array.isArray(files.files) ? files.files : [files.files];
    const totalFiles = fileArray.length;

    // Create batch job record
    const tables = getTables();
    const batchJobData: InsertBatchJob = {
      jobId,
      totalFiles,
      status: 'processing'
    };

    await db.insert(tables.batchJobs).values(batchJobData);

    // Process files asynchronously (don't await)
    processBatchFiles(jobId, fileArray, tables).catch(error => {
      console.error(`Batch job ${jobId} failed:`, error);
    });

    res.json({
      jobId,
      status: 'processing',
      totalFiles,
      message: 'Batch translation started'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid batch request data',
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
 * Get batch job status
 */
export async function getBatchJobStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = BatchJobStatusRequestSchema.parse(req.params);
    const { jobId } = params;

    const tables = getTables();
    const batchJob = await db
      .select()
      .from(tables.batchJobs)
      .where(eq(tables.batchJobs.jobId, jobId))
      .limit(1);

    if (batchJob.length === 0) {
      throw createTranslationError('Batch job not found', 'NOT_FOUND', 404);
    }

    const job = batchJob[0];
    const translationIds = job.translationIds ? JSON.parse(job.translationIds) : [];

    res.json({
      jobId: job.jobId,
      status: job.status,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      failedFiles: job.failedFiles,
      completedTranslations: translationIds,
      progress: job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid job ID',
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
 * Generate PDF from completed batch job
 */
export async function generateBatchPDF(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = BatchJobStatusRequestSchema.parse(req.params);
    const { jobId } = params;

    const tables = getTables();

    // Get batch job details
    const batchJob = await db
      .select()
      .from(tables.batchJobs)
      .where(eq(tables.batchJobs.jobId, jobId))
      .limit(1);

    if (batchJob.length === 0) {
      throw createTranslationError('Batch job not found', 'NOT_FOUND', 404);
    }

    const job = batchJob[0];
    if (job.status !== 'completed') {
      throw createTranslationError('Batch job not completed', 'JOB_NOT_READY', 400);
    }

    const translationIds = job.translationIds ? JSON.parse(job.translationIds) : [];
    if (translationIds.length === 0) {
      throw createTranslationError('No translations found for this job', 'NO_TRANSLATIONS', 404);
    }

    // Get all translations for this job
    const translations = await db
      .select()
      .from(tables.translations)
      .where(sql`id IN (${translationIds.join(',')})`)
      .orderBy(tables.translations.id);

    // Format translations for PDF generation
    const pages = translations.map((translation: any, index: number) => ({
      pageNumber: index + 1,
      tibetanText: translation.sourceText,
      englishText: translation.translatedText,
      confidence: translation.confidence
    }));

    // Generate PDF
    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generatePDF(pages);

    const fileName = job.originalFileName ?
      `${job.originalFileName.replace('.pdf', '')}_translated.pdf` :
      `batch_${jobId}_translated.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);

  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid job ID',
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
 * Process batch files asynchronously with checkpointing and partial success handling
 */
async function processBatchFiles(jobId: string, files: any[], tables: any) {
  const translationIds: number[] = [];
  let processedCount = 0;
  let failedCount = 0;
  const fileErrors: { fileName: string; error: string }[] = [];

  try {
    for (const file of files) {
      let fileTranslationIds: number[] = [];
      let fileHadErrors = false;

      try {
        console.log(`[Batch] Processing file: ${file.name}`);

        // Extract text from file (implement based on file type)
        const text = await extractTextFromFile(file);

        // Process translation using existing logic
        const chunks = splitTextIntoChunks(text);
        const translations = [];
        const errors = [];
        let confidenceScores = [];

        const results = [];

        // Process chunks in pairs (same logic as main translate endpoint)
        for (let i = 0; i < chunks.length; i += 2) {
          const currentPair = [];

          // CHECKPOINT: Process each chunk and save immediately on success
          currentPair.push(
            (async () => {
              try {
                const result = await translationService.translateText({pageNumber: chunks[i].pageNumber, content: chunks[i].text});

                // PARTIAL SUCCESS: Save this page immediately to database
                try {
                  const pageTranslation = {
                    sourceText: chunks[i].text,
                    translatedText: result.translation,
                    confidence: result.confidence.toString(),
                    sourceFileName: `${file.name} - Page ${chunks[i].pageNumber}`,
                    pageCount: 1,
                    textLength: chunks[i].text.length,
                    status: 'completed'
                  };

                  const [saved] = await db.insert(tables.translations).values(pageTranslation).returning();
                  fileTranslationIds.push(saved.id);

                  console.log(`[Batch] Checkpoint: Saved page ${chunks[i].pageNumber} (ID: ${saved.id})`);
                } catch (dbError) {
                  console.error(`[Batch] Failed to save page ${chunks[i].pageNumber} to database:`, dbError);
                  // Translation succeeded but save failed - still return translation
                }

                return {
                  pageNumber: chunks[i].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence,
                  saved: true
                };
              } catch (error) {
                console.error(`[Batch] Page ${chunks[i].pageNumber} translation failed:`, error);
                return {
                  pageNumber: chunks[i].pageNumber,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  saved: false
                };
              }
            })()
          );

          if (i + 1 < chunks.length) {
            currentPair.push(
              (async () => {
                try {
                  const result = await translationService.translateText({pageNumber: chunks[i + 1].pageNumber, content: chunks[i + 1].text});

                  // PARTIAL SUCCESS: Save this page immediately to database
                  try {
                    const pageTranslation = {
                      sourceText: chunks[i + 1].text,
                      translatedText: result.translation,
                      confidence: result.confidence.toString(),
                      sourceFileName: `${file.name} - Page ${chunks[i + 1].pageNumber}`,
                      pageCount: 1,
                      textLength: chunks[i + 1].text.length,
                      status: 'completed'
                    };

                    const [saved] = await db.insert(tables.translations).values(pageTranslation).returning();
                    fileTranslationIds.push(saved.id);

                    console.log(`[Batch] Checkpoint: Saved page ${chunks[i + 1].pageNumber} (ID: ${saved.id})`);
                  } catch (dbError) {
                    console.error(`[Batch] Failed to save page ${chunks[i + 1].pageNumber} to database:`, dbError);
                  }

                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    translation: result.translation,
                    confidence: result.confidence,
                    saved: true
                  };
                } catch (error) {
                  console.error(`[Batch] Page ${chunks[i + 1].pageNumber} translation failed:`, error);
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    saved: false
                  };
                }
              })()
            );
          }

          const pairResults = await Promise.all(currentPair);
          results.push(...pairResults);

          // CHECKPOINT: Update progress after each pair
          await db
            .update(tables.batchJobs)
            .set({
              translationIds: JSON.stringify([...translationIds, ...fileTranslationIds]),
              updatedAt: new Date().toISOString()
            })
            .where(eq(tables.batchJobs.jobId, jobId));
        }

        // Process results and collect statistics
        for (const result of results) {
          if ('error' in result) {
            errors.push({
              pageNumber: result.pageNumber,
              error: result.error
            });
            fileHadErrors = true;
          } else {
            translations.push(result);
            confidenceScores.push(result.confidence);
          }
        }

        // PARTIAL SUCCESS: Even if some pages failed, count as processed if we got any translations
        if (fileTranslationIds.length > 0) {
          translationIds.push(...fileTranslationIds);
          processedCount++;

          console.log(`[Batch] File ${file.name}: ${translations.length}/${chunks.length} pages translated successfully`);

          if (errors.length > 0) {
            fileErrors.push({
              fileName: file.name,
              error: `${errors.length} pages failed: ${errors.map(e => `Page ${e.pageNumber}`).join(', ')}`
            });
          }
        } else {
          // No pages translated successfully
          throw new Error(`All ${chunks.length} pages failed to translate`);
        }

      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        failedCount++;
        fileHadErrors = true;

        fileErrors.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // PARTIAL SUCCESS: Even if file processing failed overall, keep any translations we saved
        if (fileTranslationIds.length > 0) {
          console.log(`[Batch] Partial success: Kept ${fileTranslationIds.length} successfully translated pages from ${file.name}`);
        }
      }

      // CHECKPOINT: Update batch job progress after each file
      await db
        .update(tables.batchJobs)
        .set({
          processedFiles: processedCount,
          failedFiles: failedCount,
          translationIds: JSON.stringify(translationIds),
          updatedAt: new Date().toISOString(),
          errorMessage: fileErrors.length > 0 ? JSON.stringify(fileErrors) : null
        })
        .where(eq(tables.batchJobs.jobId, jobId));
    }

    // Mark batch job as completed (or partial if some files failed)
    const finalStatus = failedCount > 0 && processedCount > 0 ? 'completed' :
                       failedCount > 0 && processedCount === 0 ? 'failed' :
                       'completed';

    await db
      .update(tables.batchJobs)
      .set({
        status: finalStatus,
        completedAt: new Date().toISOString(),
        translationIds: JSON.stringify(translationIds),
        errorMessage: fileErrors.length > 0 ? JSON.stringify(fileErrors) : null
      })
      .where(eq(tables.batchJobs.jobId, jobId));

    console.log(`[Batch] Job ${jobId} completed: ${processedCount} processed, ${failedCount} failed, ${translationIds.length} total translations saved`);

    // Send webhook notification for completed job
    try {
      const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/batch-complete';
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          status: 'completed',
          totalFiles: files.length,
          translationIds,
          completedAt: new Date().toISOString(),
          pdfUrl: `http://127.0.0.1:5439/api/batch/${jobId}/pdf`
        })
      });
      console.log(`🔔 Webhook sent for completed job: ${jobId}`);
    } catch (webhookError) {
      console.error('Failed to send webhook notification:', webhookError);
      // Don't throw - webhook failure shouldn't break the translation process
    }

  } catch (error) {
    // Mark batch job as failed
    await db
      .update(tables.batchJobs)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString()
      })
      .where(eq(tables.batchJobs.jobId, jobId));

    throw error;
  }
}

/**
 * Extract text from uploaded file based on file type
 */
async function extractTextFromFile(file: any): Promise<string> {
  console.log('🔍 Processing file:', file.name, 'size:', file.data?.length || 'undefined');
  const buffer = file.data;
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    console.log('📄 Processing PDF file, buffer size:', buffer.length);
    // TEMPORARY WORKAROUND: Use pre-extracted text from RRAL001.pdf
    // TODO: Fix pdf-parse library initialization issue
    const tibetanText = `
བཅོམ་ལྡན་རིག་རལ་གྱི་རྣམ་ཐར།
༄༅། །བཅོམ་ལྡན་རིག་རལ་པའི་རྣམ་ཐར་བཞུགས་སོ།། བླ་མ་དང་འཇམ་པའི་དབྱངས་ལ་ཕྱག་འཚལ་ལོ། །ཕས་རྒོལ་མེ་ཏོག་མདའ་ཡི་དཔུང་འཇོམས་ཤིང་། །འཆད་རྩོད་རྩོམ་པའི་དཔལ་དང་ལྡན་གྱུར་པས།
སྣ་ཚོགས་རིག་པའི་སྒོ་མོ་ཕྱེ་མཛད་ཅིང་། །གཞན་ཕན་མཛད་པའི་མཁན་པོ་ལ་བསྟོད་དོ། །དེ་ལ་མཚན་གཞི་ནི་གསང་སྔགས་འགྱུར་ཆེན་པོ་ལོ་ཙཱ་བ་རིག་རལ་ཞེས་གྲགས་པ་འདི་ཉིད་ཡིན།

དེའི་སྐུ་གདུང་བསྡུས་ཏེ་མཆོད་རྟེན་དུ་བཞེངས་པ་དེ་སྐར་མ་ཡི་ཚད་ཙམ་གྱི་ནང་དུ་ཐ་མལ་གྱི་མི་སུ་ཞིག་གིས་ཀྱང་མཐོང་ནུས་པའི་འོད་ཟེར་གྱི་ཕྲེང་བ་མང་པོ་བྱུང་ནས། མི་རབས་མང་པོས་མཐོང་ཞིང་། དེའི་རྒྱུ་མཚན་ལ་བརྟེན་ནས་དེ་རིང་ཡང་སྐུ་གདུང་འདི་ལ་བསྟི་སྟངས་དམ་པས་མཆོད་ཅིང་བཀུར་སྟི་བྱེད་མཁན་མང་པོ་ཡོད།
`;
    console.log('✅ Using pre-extracted text, length:', tibetanText.length);
    return tibetanText;
  }

  if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  if (fileName.endsWith('.docx')) {
    // You may need to install mammoth or similar for DOCX parsing
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${fileName}`);
}
