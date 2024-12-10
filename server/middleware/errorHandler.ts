import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Custom error type for translation-related errors
 */
export interface TranslationError extends Error {
  code: string;
  status: number;
  details?: unknown;
}

/**
 * Creates a standardized translation error with consistent structure
 * @param message - Error message
 * @param code - Error code for client-side handling
 * @param status - HTTP status code
 * @param details - Additional error details
 */
export const createTranslationError = (
  message: string,
  code: string,
  status: number = 500,
  details?: unknown
): TranslationError => {
  const error = new Error(message) as TranslationError;
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
};

/**
 * Global error handling middleware
 * Processes different types of errors and returns standardized error responses
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  if ((err as TranslationError).code) {
    const translationError = err as TranslationError;
    return res.status(translationError.status).json({
      message: translationError.message,
      code: translationError.code,
      details: translationError.details
    });
  }

  // Default error response
  res.status(500).json({
    message: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};
