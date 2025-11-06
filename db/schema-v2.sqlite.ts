/**
 * Database Schema V2 - SQLite Variant
 *
 * Differences from PostgreSQL version:
 * - TEXT instead of UUID (using UUIDs as strings)
 * - REAL instead of real
 * - TEXT for arrays (stored as JSON)
 * - TEXT for JSONB (stored as JSON strings)
 * - Simplified index syntax
 */

import { text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

/**
 * Dictionary Entries Table
 * Properly normalized with all required fields
 */
export const dictionaryEntries = sqliteTable("dictionary_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tibetan: text("tibetan").notNull(),
  english: text("english").notNull(),
  wylie: text("wylie"),
  sanskrit: text("sanskrit"),
  category: text("category").notNull(), // e.g., 'buddhist_term', 'philosophy', 'general'
  frequency: text("frequency").notNull(), // 'very_common', 'common', 'uncommon', 'rare'
  context: text("context"),
  alternateTranslations: text("alternate_translations"), // JSON array string
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tibetanIdx: index("idx_tibetan").on(table.tibetan),
  categoryIdx: index("idx_category").on(table.category),
}));

/**
 * Translations Table
 * With hash-based deduplication and embedding support
 */
export const translations = sqliteTable("translations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceTextHash: text("source_text_hash").notNull().unique(),
  sourceText: text("source_text").notNull(),
  translation: text("translation").notNull(),
  confidence: real("confidence").notNull(), // 0.0 to 1.0
  qualityScore: text("quality_score"), // JSON object
  metadata: text("metadata"), // JSON object
  embedding: text("embedding"), // JSON array
  cached: integer("cached").notNull().default(0), // boolean as 0/1
  sourceFileName: text("source_file_name"),
  pageCount: integer("page_count"),
  textLength: integer("text_length"),
  processingTime: integer("processing_time"),
  status: text("status").notNull().default("completed"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  hashIdx: index("idx_source_text_hash").on(table.sourceTextHash),
  createdIdx: index("idx_created_at").on(table.createdAt),
  statusIdx: index("idx_status").on(table.status),
}));

/**
 * Metrics Table
 * Time-series optimized for monitoring and analytics
 */
export const metrics = sqliteTable("metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }), // SQLite needs a separate ID for compound keys
  timestamp: text("timestamp").notNull(),
  metricName: text("metric_name").notNull(),
  value: real("value").notNull(),
  tags: text("tags"), // JSON object
}, (table) => ({
  metricNameIdx: index("idx_metric_name").on(table.metricName),
  timestampIdx: index("idx_timestamp").on(table.timestamp),
  // Composite index for common queries
  timestampMetricIdx: index("idx_timestamp_metric").on(table.timestamp, table.metricName),
}));

/**
 * Batch Jobs Table
 */
export const batchJobs = sqliteTable("batch_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  status: text("status").notNull().default("pending"),
  totalFiles: integer("total_files").notNull(),
  processedFiles: integer("processed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  translationIds: text("translation_ids"), // JSON array
  originalFileName: text("original_file_name"),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON object
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => ({
  statusIdx: index("idx_batch_status").on(table.status),
  createdIdx: index("idx_batch_created").on(table.createdAt),
}));

/**
 * Translation Metrics Table
 */
export const translationMetrics = sqliteTable("translation_metrics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  translationId: text("translation_id").references(() => translations.id),
  sessionId: text("session_id"),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),

  // Quality metrics
  confidenceScore: real("confidence_score").notNull(),
  qualityScore: real("quality_score"),
  modelAgreement: real("model_agreement"),
  formatScore: real("format_score"),

  // Performance metrics
  processingTimeMs: integer("processing_time_ms").notNull(),
  tokensProcessed: integer("tokens_processed"),
  apiLatencyMs: integer("api_latency_ms"),

  // Usage metrics
  modelUsed: text("model_used").notNull(),
  iterationsUsed: integer("iterations_used").notNull().default(1),
  retriesNeeded: integer("retries_needed").notNull().default(0),
  helperModelsUsed: text("helper_models_used"), // JSON array

  // Gate metrics
  gatesPassed: integer("gates_passed").notNull().default(1), // boolean as 0/1
  gateResults: text("gate_results"), // JSON object

  // Document metadata
  pageNumber: integer("page_number"),
  documentId: text("document_id"),
  textLength: integer("text_length").notNull(),
  chunkCount: integer("chunk_count"),

  // Error metrics
  errorOccurred: integer("error_occurred").notNull().default(0), // boolean as 0/1
  errorType: text("error_type"),
  errorMessage: text("error_message"),
}, (table) => ({
  translationIdIdx: index("idx_tm_translation_id").on(table.translationId),
  timestampIdx: index("idx_tm_timestamp").on(table.timestamp),
  modelUsedIdx: index("idx_tm_model_used").on(table.modelUsed),
}));

/**
 * Review Queue Table
 */
export const reviewQueue = sqliteTable("review_queue", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  translationId: text("translation_id").notNull().references(() => translations.id),
  reason: text("reason").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("pending"),
  assignedTo: text("assigned_to"),
  reviewNotes: text("review_notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
}, (table) => ({
  translationIdIdx: index("idx_rq_translation_id").on(table.translationId),
  statusIdx: index("idx_rq_status").on(table.status),
  severityIdx: index("idx_rq_severity").on(table.severity),
}));

/**
 * Translation Corrections Table
 */
export const translationCorrections = sqliteTable("translation_corrections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  translationId: text("translation_id").notNull().references(() => translations.id),
  reviewItemId: text("review_item_id").references(() => reviewQueue.id),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  correctionType: text("correction_type").notNull(),
  correctedBy: text("corrected_by"),
  correctionReason: text("correction_reason"),
  extractedTerms: text("extracted_terms"), // JSON array
  appliedToDictionary: integer("applied_to_dictionary").notNull().default(0), // boolean as 0/1
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  translationIdIdx: index("idx_tc_translation_id").on(table.translationId),
  correctionTypeIdx: index("idx_tc_correction_type").on(table.correctionType),
}));

/**
 * Glossaries Table
 */
export const glossaries = sqliteTable("glossaries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  translationId: text("translation_id").references(() => translations.id),
  batchJobId: text("batch_job_id").references(() => batchJobs.id),
  glossaryData: text("glossary_data").notNull(), // JSON object
  totalTerms: integer("total_terms").notNull(),
  inconsistentTerms: integer("inconsistent_terms").notNull().default(0),
  consistencyScore: real("consistency_score"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  translationIdIdx: index("idx_gloss_translation_id").on(table.translationId),
  batchJobIdIdx: index("idx_gloss_batch_job_id").on(table.batchJobId),
}));

/**
 * Jobs Table (Phase 3.2)
 * Background job queue for long-running translation tasks
 */
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull().default("translation"), // Job type
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled
  request: text("request").notNull(), // JSON object (TranslationRequest)
  result: text("result"), // JSON object (TranslationResult)
  error: text("error"), // Error message if failed
  progress: real("progress").notNull().default(0), // 0-100
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  cancelledAt: text("cancelled_at"),
}, (table) => ({
  statusIdx: index("idx_jobs_status").on(table.status),
  createdIdx: index("idx_jobs_created").on(table.createdAt),
  typeStatusIdx: index("idx_jobs_type_status").on(table.type, table.status),
}));

/**
 * Migration Tracking Table
 */
export const migrations = sqliteTable("migrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  appliedAt: text("applied_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ===== Zod Schemas for Validation =====

export const insertDictionaryEntrySchema = createInsertSchema(dictionaryEntries);
export const selectDictionaryEntrySchema = createSelectSchema(dictionaryEntries);
export type InsertDictionaryEntry = z.infer<typeof insertDictionaryEntrySchema>;
export type DictionaryEntry = z.infer<typeof selectDictionaryEntrySchema>;

export const insertTranslationSchema = createInsertSchema(translations);
export const selectTranslationSchema = createSelectSchema(translations);
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type Translation = z.infer<typeof selectTranslationSchema>;

export const insertMetricSchema = createInsertSchema(metrics);
export const selectMetricSchema = createSelectSchema(metrics);
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = z.infer<typeof selectMetricSchema>;

export const insertBatchJobSchema = createInsertSchema(batchJobs);
export const selectBatchJobSchema = createSelectSchema(batchJobs);
export type InsertBatchJob = z.infer<typeof insertBatchJobSchema>;
export type BatchJob = z.infer<typeof selectBatchJobSchema>;

export const insertTranslationMetricsSchema = createInsertSchema(translationMetrics);
export const selectTranslationMetricsSchema = createSelectSchema(translationMetrics);
export type InsertTranslationMetrics = z.infer<typeof insertTranslationMetricsSchema>;
export type TranslationMetricsRecord = z.infer<typeof selectTranslationMetricsSchema>;

export const insertReviewQueueSchema = createInsertSchema(reviewQueue);
export const selectReviewQueueSchema = createSelectSchema(reviewQueue);
export type InsertReviewQueue = z.infer<typeof insertReviewQueueSchema>;
export type ReviewQueueRecord = z.infer<typeof selectReviewQueueSchema>;

export const insertTranslationCorrectionsSchema = createInsertSchema(translationCorrections);
export const selectTranslationCorrectionsSchema = createSelectSchema(translationCorrections);
export type InsertTranslationCorrections = z.infer<typeof insertTranslationCorrectionsSchema>;
export type TranslationCorrectionsRecord = z.infer<typeof selectTranslationCorrectionsSchema>;

export const insertGlossarySchema = createInsertSchema(glossaries);
export const selectGlossarySchema = createSelectSchema(glossaries);
export type InsertGlossary = z.infer<typeof insertGlossarySchema>;
export type Glossary = z.infer<typeof selectGlossarySchema>;

export const insertMigrationSchema = createInsertSchema(migrations);
export const selectMigrationSchema = createSelectSchema(migrations);
export type InsertMigration = z.infer<typeof insertMigrationSchema>;
export type Migration = z.infer<typeof selectMigrationSchema>;

export const insertJobSchema = createInsertSchema(jobs);
export const selectJobSchema = createSelectSchema(jobs);
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = z.infer<typeof selectJobSchema>;
