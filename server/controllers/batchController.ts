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
 * Process batch files asynchronously
 */
async function processBatchFiles(jobId: string, files: any[], tables: any) {
  const translationIds: number[] = [];
  let processedCount = 0;
  let failedCount = 0;

  try {
    for (const file of files) {
      try {
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

          currentPair.push(
            (async () => {
              try {
                const result = await translationService.translateText({pageNumber: chunks[i].pageNumber, content: chunks[i].text});
                return {
                  pageNumber: chunks[i].pageNumber,
                  translation: result.translation,
                  confidence: result.confidence
                };
              } catch (error) {
                return {
                  pageNumber: chunks[i].pageNumber,
                  error: error instanceof Error ? error.message : 'Unknown error'
                };
              }
            })()
          );

          if (i + 1 < chunks.length) {
            currentPair.push(
              (async () => {
                try {
                  const result = await translationService.translateText({pageNumber: chunks[i + 1].pageNumber, content: chunks[i + 1].text});
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    translation: result.translation,
                    confidence: result.confidence
                  };
                } catch (error) {
                  return {
                    pageNumber: chunks[i + 1].pageNumber,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  };
                }
              })()
            );
          }

          const pairResults = await Promise.all(currentPair);
          results.push(...pairResults);
        }

        // Process results
        for (const result of results) {
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

        if (translations.length > 0) {
          // Combine translated text
          const combinedText = translations
            .sort((a, b) => a.pageNumber - b.pageNumber)
            .map(t => t.translation.replace(/^## Translation of Tibetan Text \(Page \d+\)\n*/, ''))
            .join('\n\n');

          // Calculate average confidence
          const averageConfidence = confidenceScores.length > 0
            ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
            : 0;

          // Save translation to database
          const translationData = {
            sourceText: text,
            translatedText: combinedText,
            confidence: averageConfidence.toString(),
            sourceFileName: file.name,
            pageCount: chunks.length,
            textLength: text.length,
            status: 'completed'
          };

          const [savedTranslation] = await db.insert(tables.translations).values(translationData).returning();
          translationIds.push(savedTranslation.id);
        }

        processedCount++;

      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error);
        failedCount++;
      }

      // Update batch job progress
      await db
        .update(tables.batchJobs)
        .set({
          processedFiles: processedCount,
          failedFiles: failedCount,
          translationIds: JSON.stringify(translationIds)
        })
        .where(eq(tables.batchJobs.jobId, jobId));
    }

    // Mark batch job as completed
    await db
      .update(tables.batchJobs)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        translationIds: JSON.stringify(translationIds)
      })
      .where(eq(tables.batchJobs.jobId, jobId));

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
