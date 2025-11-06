/**
 * Routes Configuration
 *
 * Clean, organized route definitions using controller pattern.
 * This file maps URL paths to their corresponding controller functions.
 *
 * @author Translation Service Team
 */

import type { Express } from "express";
import fileUpload from 'express-fileupload';
import rateLimit from 'express-rate-limit';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import swaggerRouter from './routes/swagger';

// Import controllers
import {
  handleTranslation,
  handleStreamingTranslation,
  getTranslationCapabilities,
  getTranslationConfig,
  updateTranslationConfig,
  getRecentTranslations,
  getTranslation,
  cancelTranslationSession,
  getActiveSessions
} from './controllers/translationController';

import {
  handleBatchTranslation,
  getBatchJobStatus,
  generateBatchPDF
} from './controllers/batchController';

import { generatePDF } from './controllers/pdfController';

import {
  getSystemStatus,
  getDictionaryEntries
} from './controllers/statusController';

// Configure rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many translation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Registers all application routes and middleware
 * @param app Express application instance
 */
export function registerRoutes(app: Express) {
  // Enable trust proxy to properly handle X-Forwarded-For header
  app.set('trust proxy', 1);

  // Enable file upload middleware
  app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    abortOnLimit: true
  }));

  // ====================================
  // API Documentation (Swagger UI)
  // ====================================
  app.use('/api-docs', swaggerRouter);

  // ====================================
  // Translation Routes
  // ====================================

  // Main translation endpoint
  app.post('/api/translate',
    limiter,
    requestLogger,
    handleTranslation
  );

  // Streaming translation endpoint
  app.post('/api/translate/stream',
    limiter,
    requestLogger,
    handleStreamingTranslation
  );

  // Translation capabilities
  app.get('/api/translation/capabilities',
    limiter,
    requestLogger,
    getTranslationCapabilities
  );

  // Translation configuration
  app.get('/api/translation/config',
    limiter,
    requestLogger,
    getTranslationConfig
  );

  app.post('/api/translation/config',
    limiter,
    requestLogger,
    updateTranslationConfig
  );

  // ====================================
  // Batch Processing Routes
  // ====================================

  // Batch translation
  app.post('/api/batch/translate',
    limiter,
    requestLogger,
    handleBatchTranslation
  );

  // Batch job status
  app.get('/api/batch/status/:jobId',
    limiter,
    requestLogger,
    getBatchJobStatus
  );

  // Batch PDF generation
  app.get('/api/batch/:jobId/pdf',
    limiter,
    requestLogger,
    generateBatchPDF
  );

  // ====================================
  // PDF Generation Routes
  // ====================================

  // Generate PDF from pages
  app.post('/api/generate-pdf',
    limiter,
    requestLogger,
    generatePDF
  );

  // ====================================
  // History Routes
  // ====================================

  // Recent translations
  app.get('/api/translations/recent',
    limiter,
    requestLogger,
    getRecentTranslations
  );

  // Specific translation
  app.get('/api/translations/:id',
    limiter,
    requestLogger,
    getTranslation
  );

  // ====================================
  // Session Management Routes
  // ====================================

  // Cancel translation session
  app.post('/api/translate/cancel/:sessionId',
    limiter,
    requestLogger,
    cancelTranslationSession
  );

  // Active sessions
  app.get('/api/translate/sessions',
    limiter,
    requestLogger,
    getActiveSessions
  );

  // ====================================
  // Status and Dictionary Routes
  // ====================================

  // System status
  app.get('/api/status',
    limiter,
    requestLogger,
    getSystemStatus
  );

  // Dictionary entries
  app.get('/api/dictionary/entries',
    limiter,
    requestLogger,
    getDictionaryEntries
  );

  // Register error handler
  app.use(errorHandler);
}
