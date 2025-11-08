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

import {
  extractEntities,
  getExtractionStatus,
  getEntitiesForTranslation,
  getRelationshipsForTranslation,
  getKnowledgeGraphStats,
  handleBatchExtraction,
  getBatchExtractionStatus
} from './controllers/knowledgeGraphController';

import {
  getAggregateMetrics,
  getQualityReport,
  getRecentExtractionJobs
} from './controllers/metricsController';

import {
  handleFullSync,
  handleIncrementalSync,
  handleSyncEntity,
  handleSyncRelationship,
  handleConsistencyCheck,
  handleSyncStatus
} from './controllers/syncController';

import {
  getLineage,
  getIncarnationLine,
  getShortestPath,
  getAllPaths,
  getNetwork,
  getContemporaries,
  getTimeline,
  getEntityTimeline,
  getTextsByAuthor,
  getCitationNetwork,
  getNearby,
  getPersonJourney,
  getMostInfluential,
  detectCommunities,
  suggestRelationships,
  searchEntities,
  customQuery,
  getQueryMetrics,
  getSlowQueries,
  clearCache
} from './controllers/graphQueryController';

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

  // ====================================
  // Knowledge Graph Routes
  // ====================================

  // Extract entities from translation
  app.post('/api/kg/extract/:translationId',
    limiter,
    requestLogger,
    extractEntities
  );

  // Get extraction job status
  app.get('/api/kg/extract/status/:jobId',
    limiter,
    requestLogger,
    getExtractionStatus
  );

  // Get entities for translation
  app.get('/api/kg/entities/:translationId',
    limiter,
    requestLogger,
    getEntitiesForTranslation
  );

  // Get relationships for translation
  app.get('/api/kg/relationships/:translationId',
    limiter,
    requestLogger,
    getRelationshipsForTranslation
  );

  // Get knowledge graph statistics
  app.get('/api/kg/stats',
    limiter,
    requestLogger,
    getKnowledgeGraphStats
  );

  // ====================================
  // Batch Entity Extraction Routes
  // ====================================

  // Start batch extraction from multiple translations
  app.post('/api/extract/batch',
    limiter,
    requestLogger,
    handleBatchExtraction
  );

  // Get batch extraction job status
  app.get('/api/extract/batch/:batchJobId',
    limiter,
    requestLogger,
    getBatchExtractionStatus
  );

  // ====================================
  // Metrics and Monitoring Routes
  // ====================================

  // Get aggregate metrics
  app.get('/api/metrics/aggregate',
    limiter,
    requestLogger,
    getAggregateMetrics
  );

  // Get quality report
  app.get('/api/metrics/quality',
    limiter,
    requestLogger,
    getQualityReport
  );

  // Get recent extraction jobs
  app.get('/api/extract/jobs',
    limiter,
    requestLogger,
    getRecentExtractionJobs
  );

  // ====================================
  // Graph Synchronization Routes
  // ====================================

  // Full synchronization (PostgreSQL → Neo4j)
  app.post('/api/sync/full',
    limiter,
    requestLogger,
    handleFullSync
  );

  // Incremental synchronization
  app.post('/api/sync/incremental',
    limiter,
    requestLogger,
    handleIncrementalSync
  );

  // Sync single entity
  app.post('/api/sync/entity/:entityId',
    limiter,
    requestLogger,
    handleSyncEntity
  );

  // Sync single relationship
  app.post('/api/sync/relationship/:relationshipId',
    limiter,
    requestLogger,
    handleSyncRelationship
  );

  // Check consistency between databases
  app.get('/api/sync/consistency',
    limiter,
    requestLogger,
    handleConsistencyCheck
  );

  // Get sync status and metrics
  app.get('/api/sync/status',
    limiter,
    requestLogger,
    handleSyncStatus
  );

  // ====================================
  // Graph Query Routes (Phase 4.4)
  // ====================================

  // LINEAGE QUERIES
  app.get('/api/graph/lineage/:personId',
    limiter,
    requestLogger,
    getLineage
  );

  app.get('/api/graph/incarnation/:personId',
    limiter,
    requestLogger,
    getIncarnationLine
  );

  // PATH QUERIES
  app.get('/api/graph/path',
    limiter,
    requestLogger,
    getShortestPath
  );

  app.get('/api/graph/paths/all',
    limiter,
    requestLogger,
    getAllPaths
  );

  // NETWORK QUERIES
  app.get('/api/graph/network/:centerId',
    limiter,
    requestLogger,
    getNetwork
  );

  app.get('/api/graph/contemporaries/:personId',
    limiter,
    requestLogger,
    getContemporaries
  );

  // TIMELINE QUERIES
  app.get('/api/graph/timeline',
    limiter,
    requestLogger,
    getTimeline
  );

  app.get('/api/graph/entity/:entityId/timeline',
    limiter,
    requestLogger,
    getEntityTimeline
  );

  // AUTHORSHIP QUERIES
  app.get('/api/graph/author/:authorId/texts',
    limiter,
    requestLogger,
    getTextsByAuthor
  );

  app.get('/api/graph/text/:textId/citations',
    limiter,
    requestLogger,
    getCitationNetwork
  );

  // GEOGRAPHIC QUERIES
  app.get('/api/graph/nearby',
    limiter,
    requestLogger,
    getNearby
  );

  app.get('/api/graph/person/:personId/journey',
    limiter,
    requestLogger,
    getPersonJourney
  );

  // ANALYSIS QUERIES
  app.get('/api/graph/influential',
    limiter,
    requestLogger,
    getMostInfluential
  );

  app.get('/api/graph/communities',
    limiter,
    requestLogger,
    detectCommunities
  );

  app.get('/api/graph/suggest-relationships/:entityId',
    limiter,
    requestLogger,
    suggestRelationships
  );

  // SEARCH QUERIES
  app.get('/api/graph/search',
    limiter,
    requestLogger,
    searchEntities
  );

  app.post('/api/graph/query',
    limiter,
    requestLogger,
    customQuery
  );

  // METRICS & ADMIN
  app.get('/api/graph/metrics',
    limiter,
    requestLogger,
    getQueryMetrics
  );

  app.get('/api/graph/slow-queries',
    limiter,
    requestLogger,
    getSlowQueries
  );

  app.post('/api/graph/cache/clear',
    limiter,
    requestLogger,
    clearCache
  );

  // Register error handler
  app.use(errorHandler);
}
