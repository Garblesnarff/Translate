import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const translations = pgTable("translations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  sourceText: text("source_text").notNull(),
  translatedText: text("translated_text").notNull(),
  confidence: text("confidence").notNull(),
  sourceFileName: text("source_file_name"),
  pageCount: integer("page_count"),
  textLength: integer("text_length"),
  processingTime: integer("processing_time"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dictionary = pgTable("dictionary", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tibetan: text("tibetan").notNull(),
  english: text("english").notNull(),
  context: text("context"),
});

export const batchJobs = pgTable("batch_jobs", {
  jobId: text("id").primaryKey(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  totalFiles: integer("total_files").notNull(),
  processedFiles: integer("processed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  translationIds: text("translation_ids"),
  originalFileName: text("original_file_name"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertTranslationSchema = createInsertSchema(translations);
export const selectTranslationSchema = createSelectSchema(translations);
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type Translation = z.infer<typeof selectTranslationSchema>;

export const insertDictionarySchema = createInsertSchema(dictionary);
export const selectDictionarySchema = createSelectSchema(dictionary);
export type InsertDictionary = z.infer<typeof insertDictionarySchema>;
export type Dictionary = z.infer<typeof selectDictionarySchema>;

export const insertBatchJobSchema = createInsertSchema(batchJobs);
export const selectBatchJobSchema = createSelectSchema(batchJobs);
export type InsertBatchJob = z.infer<typeof insertBatchJobSchema>;
export type BatchJob = z.infer<typeof selectBatchJobSchema>;

// Translation metrics table for monitoring
export const translationMetrics = pgTable("translation_metrics", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  translationId: text("translation_id"),
  sessionId: text("session_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),

  // Quality metrics
  confidenceScore: text("confidence_score").notNull(), // stored as text for precision
  qualityScore: text("quality_score"),
  modelAgreement: text("model_agreement"),
  formatScore: text("format_score"),

  // Performance metrics
  processingTimeMs: integer("processing_time_ms").notNull(),
  tokensProcessed: integer("tokens_processed"),
  apiLatencyMs: integer("api_latency_ms"),

  // Usage metrics
  modelUsed: text("model_used").notNull(),
  iterationsUsed: integer("iterations_used").notNull(),
  retriesNeeded: integer("retries_needed").notNull(),
  helperModelsUsed: text("helper_models_used"), // JSON array

  // Gate metrics (Phase 2.4.3)
  gatesPassed: integer("gates_passed").notNull().default(1), // Boolean as 0/1
  gateResults: text("gate_results"), // JSON object
  failedGates: text("failed_gates"), // JSON array

  // Document metadata
  pageNumber: integer("page_number"),
  documentId: text("document_id"),
  textLength: integer("text_length").notNull(),
  chunkCount: integer("chunk_count"),

  // Error metrics
  errorOccurred: integer("error_occurred").notNull().default(0), // Boolean as 0/1
  errorType: text("error_type"),
  errorMessage: text("error_message"),
});

// Review queue table for human review workflow
export const reviewQueue = pgTable("review_queue", {
  id: text("id").primaryKey(),
  translationId: integer("translation_id").notNull().references(() => translations.id),
  reason: text("reason").notNull(),
  severity: text("severity", { enum: ["high", "medium", "low"] }).notNull(),
  status: text("status", { enum: ["pending", "in_review", "approved", "rejected"] }).notNull().default("pending"),
  assignedTo: text("assigned_to"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

// Translation corrections table for feedback loop
export const translationCorrections = pgTable("translation_corrections", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  translationId: integer("translation_id").notNull().references(() => translations.id),
  reviewItemId: text("review_item_id").references(() => reviewQueue.id),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  correctionType: text("correction_type").notNull(), // 'terminology', 'grammar', 'accuracy', 'formatting'
  correctedBy: text("corrected_by"),
  correctionReason: text("correction_reason"),
  extractedTerms: text("extracted_terms"), // JSON array of term pairs
  appliedToDictionary: integer("applied_to_dictionary").notNull().default(0), // boolean as integer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Glossaries table for terminology consistency tracking
export const glossaries = pgTable("glossaries", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  translationId: integer("translation_id").references(() => translations.id),
  batchJobId: text("batch_job_id").references(() => batchJobs.jobId),
  glossaryData: text("glossary_data").notNull(), // JSON string of glossary entries
  totalTerms: integer("total_terms").notNull(),
  inconsistentTerms: integer("inconsistent_terms").notNull(),
  consistencyScore: text("consistency_score"), // Average consistency score
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Manual review table for fallback system (Phase 2.3)
export const manualReview = pgTable("manual_review", {
  id: text("id").primaryKey(),
  sourceText: text("source_text").notNull(),
  pageNumber: integer("page_number"),
  attemptedTranslation: text("attempted_translation"),
  errorMessage: text("error_message").notNull(),
  strategyFailures: text("strategy_failures"), // JSON array of failed strategies
  status: text("status", { enum: ["pending", "completed", "skipped"] }).notNull().default("pending"),
  completedTranslation: text("completed_translation"),
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

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

export const insertGlossariesSchema = createInsertSchema(glossaries);
export const selectGlossariesSchema = createSelectSchema(glossaries);
export type InsertGlossary = z.infer<typeof insertGlossariesSchema>;
export type Glossary = z.infer<typeof selectGlossariesSchema>;

export const insertManualReviewSchema = createInsertSchema(manualReview);
export const selectManualReviewSchema = createSelectSchema(manualReview);
export type InsertManualReview = z.infer<typeof insertManualReviewSchema>;
export type ManualReviewRecord = z.infer<typeof selectManualReviewSchema>;

// API keys table for authentication (Phase 4.1.1)
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  userId: text("user_id"),
  permissions: text("permissions").notNull(), // JSON array: ['translate', 'jobs', 'admin']
  rateLimit: integer("rate_limit").notNull().default(100), // requests per hour
  requestsCount: integer("requests_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  revoked: integer("revoked").notNull().default(0), // boolean as integer
});

// Audit logs table for security events (Phase 4.1.4)
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  eventType: text("event_type").notNull(),
  userId: text("user_id"),
  apiKeyId: text("api_key_id").references(() => apiKeys.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  resource: text("resource"),
  action: text("action"),
  success: integer("success").notNull(), // boolean as integer
  details: text("details"), // JSON object
});

export const insertApiKeySchema = createInsertSchema(apiKeys);
export const selectApiKeySchema = createSelectSchema(apiKeys);
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = z.infer<typeof selectApiKeySchema>;

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = z.infer<typeof selectAuditLogSchema>;
