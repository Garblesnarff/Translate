/**
 * PDF Controller
 *
 * Handles PDF generation requests.
 * Contains business logic for PDF-related endpoints.
 *
 * @author Translation Service Team
 */

import type { Request, Response, NextFunction } from "express";
import { z } from 'zod';
import { createTranslationError } from '../middleware/errorHandler';
import { PDFGenerator } from '../services/pdf/PDFGenerator';
import {
  PDFGenerationRequestSchema,
  type PDFGenerationRequest
} from '../schemas/translationSchemas';

/**
 * Generate PDF from translation pages
 */
export async function generatePDF(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pages = req.body.pages;
    if (!Array.isArray(pages)) {
      throw createTranslationError('Invalid pages data', 'INVALID_INPUT', 400);
    }

    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generatePDF(pages);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=translation.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createTranslationError(
        'Invalid PDF generation data',
        'VALIDATION_ERROR',
        400,
        error.errors
      ));
      return;
    }
    next(error);
  }
}
