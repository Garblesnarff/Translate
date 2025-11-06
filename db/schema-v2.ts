/**
 * Database Schema V2 - Optimized and Normalized
 *
 * Key improvements over V1:
 * - Proper normalization (no text for numeric fields)
 * - Hash-based deduplication for translations
 * - Comprehensive dictionary with Wylie, Sanskrit, frequency
 * - Time-series optimized metrics table
 * - Vector embeddings support (pgvector)
 * - Proper indexes for performance
 * - Foreign key constraints
 */

import { pgTable, text, integer, timestamp, jsonb, boolean, real, uuid, index, varchar, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

/**
 * Dictionary Entries Table
 * Properly normalized with all required fields
 */
export const dictionaryEntries = pgTable("dictionary_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tibetan: text("tibetan").notNull(),
  english: text("english").notNull(),
  wylie: text("wylie"), // Wylie transliteration
  sanskrit: text("sanskrit"), // Sanskrit equivalent if available
  category: varchar("category", { length: 50 }).notNull(), // e.g., 'buddhist_term', 'philosophy', 'general'
  frequency: varchar("frequency", { length: 20 }).notNull(), // 'very_common', 'common', 'uncommon', 'rare'
  context: text("context"), // Usage context or notes
  alternateTranslations: text("alternate_translations").array(), // Array of alternative translations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance
  tibetanIdx: index("idx_tibetan").on(table.tibetan),
  categoryFrequencyIdx: index("idx_category_frequency").on(table.category, table.frequency),
}));

/**
 * Translations Table
 * With hash-based deduplication and embedding support
 */
export const translations = pgTable("translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceTextHash: varchar("source_text_hash", { length: 64 }).notNull().unique(), // SHA-256 hash for deduplication
  sourceText: text("source_text").notNull(),
  translation: text("translation").notNull(),
  confidence: real("confidence").notNull(), // 0.0 to 1.0
  qualityScore: jsonb("quality_score"), // Complex nested quality metrics
  metadata: jsonb("metadata"), // Additional metadata (model used, processing time, etc.)
  embedding: jsonb("embedding"), // Vector embedding as JSONB (pgvector would be better but requires extension)
  cached: boolean("cached").default(false).notNull(), // Whether this came from cache
  sourceFileName: text("source_file_name"),
  pageCount: integer("page_count"),
  textLength: integer("text_length"),
  processingTime: integer("processing_time"), // milliseconds
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance
  hashIdx: index("idx_source_text_hash").on(table.sourceTextHash),
  createdIdx: index("idx_created_at").on(table.createdAt.desc()),
  statusIdx: index("idx_status").on(table.status),
}));

/**
 * Metrics Table
 * Time-series optimized for monitoring and analytics
 * Designed to be compatible with TimescaleDB hypertables
 */
export const metrics = pgTable("metrics", {
  timestamp: timestamp("timestamp").notNull(),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  value: real("value").notNull(),
  tags: jsonb("tags"), // Flexible tagging (e.g., {model: 'gemini', status: 'success'})
}, (table) => ({
  // Composite primary key for time-series data
  pk: primaryKey({ columns: [table.timestamp, table.metricName] }),
  // Indexes for common query patterns
  metricNameIdx: index("idx_metric_name").on(table.metricName),
  timestampIdx: index("idx_timestamp").on(table.timestamp.desc()),
}));

/**
 * Batch Jobs Table
 * Tracks batch translation jobs
 */
export const batchJobs = pgTable("batch_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: varchar("status", { length: 20, enum: ["pending", "processing", "completed", "failed", "cancelled"] }).notNull().default("pending"),
  totalFiles: integer("total_files").notNull(),
  processedFiles: integer("processed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  translationIds: text("translation_ids").array(), // Array of translation UUIDs
  originalFileName: text("original_file_name"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Additional job metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("idx_batch_status").on(table.status),
  createdIdx: index("idx_batch_created").on(table.createdAt.desc()),
}));

/**
 * Translation Metrics Table
 * Detailed metrics for each translation operation
 */
export const translationMetrics = pgTable("translation_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  translationId: uuid("translation_id").references(() => translations.id),
  sessionId: varchar("session_id", { length: 100 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),

  // Quality metrics (stored as real numbers, not text!)
  confidenceScore: real("confidence_score").notNull(),
  qualityScore: real("quality_score"),
  modelAgreement: real("model_agreement"),
  formatScore: real("format_score"),

  // Performance metrics
  processingTimeMs: integer("processing_time_ms").notNull(),
  tokensProcessed: integer("tokens_processed"),
  apiLatencyMs: integer("api_latency_ms"),

  // Usage metrics
  modelUsed: varchar("model_used", { length: 50 }).notNull(),
  iterationsUsed: integer("iterations_used").notNull().default(1),
  retriesNeeded: integer("retries_needed").notNull().default(0),
  helperModelsUsed: text("helper_models_used").array(),

  // Gate metrics
  gatesPassed: boolean("gates_passed").notNull().default(true),
  gateResults: jsonb("gate_results"),

  // Document metadata
  pageNumber: integer("page_number"),
  documentId: varchar("document_id", { length: 100 }),
  textLength: integer("text_length").notNull(),
  chunkCount: integer("chunk_count"),

  // Error metrics
  errorOccurred: boolean("error_occurred").notNull().default(false),
  errorType: varchar("error_type", { length: 50 }),
  errorMessage: text("error_message"),
}, (table) => ({
  translationIdIdx: index("idx_tm_translation_id").on(table.translationId),
  timestampIdx: index("idx_tm_timestamp").on(table.timestamp.desc()),
  modelUsedIdx: index("idx_tm_model_used").on(table.modelUsed),
}));

/**
 * Review Queue Table
 * For human review workflow
 */
export const reviewQueue = pgTable("review_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  translationId: uuid("translation_id").notNull().references(() => translations.id),
  reason: text("reason").notNull(),
  severity: varchar("severity", { length: 20, enum: ["high", "medium", "low"] }).notNull(),
  status: varchar("status", { length: 20, enum: ["pending", "in_review", "approved", "rejected"] }).notNull().default("pending"),
  assignedTo: varchar("assigned_to", { length: 100 }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
}, (table) => ({
  translationIdIdx: index("idx_rq_translation_id").on(table.translationId),
  statusIdx: index("idx_rq_status").on(table.status),
  severityIdx: index("idx_rq_severity").on(table.severity),
}));

/**
 * Translation Corrections Table
 * For feedback loop and continuous improvement
 */
export const translationCorrections = pgTable("translation_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  translationId: uuid("translation_id").notNull().references(() => translations.id),
  reviewItemId: uuid("review_item_id").references(() => reviewQueue.id),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  correctionType: varchar("correction_type", { length: 50 }).notNull(), // 'terminology', 'grammar', 'accuracy', 'formatting'
  correctedBy: varchar("corrected_by", { length: 100 }),
  correctionReason: text("correction_reason"),
  extractedTerms: jsonb("extracted_terms"), // Array of term pairs
  appliedToDictionary: boolean("applied_to_dictionary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  translationIdIdx: index("idx_tc_translation_id").on(table.translationId),
  correctionTypeIdx: index("idx_tc_correction_type").on(table.correctionType),
}));

/**
 * Glossaries Table
 * For terminology consistency tracking
 */
export const glossaries = pgTable("glossaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  translationId: uuid("translation_id").references(() => translations.id),
  batchJobId: uuid("batch_job_id").references(() => batchJobs.id),
  glossaryData: jsonb("glossary_data").notNull(), // Structured glossary entries
  totalTerms: integer("total_terms").notNull(),
  inconsistentTerms: integer("inconsistent_terms").notNull().default(0),
  consistencyScore: real("consistency_score"), // 0.0 to 1.0
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  translationIdIdx: index("idx_gloss_translation_id").on(table.translationId),
  batchJobIdIdx: index("idx_gloss_batch_job_id").on(table.batchJobId),
}));

/**
 * Jobs Table (Phase 3.2)
 * Background job queue for long-running translation tasks
 */
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull().default("translation"), // Job type
  status: varchar("status", { length: 20, enum: ["pending", "processing", "completed", "failed", "cancelled"] }).notNull().default("pending"),
  request: jsonb("request").notNull(), // TranslationRequest
  result: jsonb("result"), // TranslationResult
  error: text("error"), // Error message if failed
  progress: real("progress").notNull().default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => ({
  statusIdx: index("idx_jobs_status").on(table.status),
  createdIdx: index("idx_jobs_created").on(table.createdAt.desc()),
  typeStatusIdx: index("idx_jobs_type_status").on(table.type, table.status),
}));

/**
 * Migration Tracking Table
 * Tracks applied migrations
 */
export const migrations = pgTable("migrations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
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
