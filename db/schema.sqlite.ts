import { text, integer } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const translations = sqliteTable("translations", {
  id: integer().primaryKey({ autoIncrement: true }),
  sourceText: text("source_text").notNull(),
  translatedText: text("translated_text").notNull(),
  confidence: text("confidence").notNull(),
  sourceFileName: text("source_file_name"),
  pageCount: integer("page_count"),
  textLength: integer("text_length"),
  processingTime: integer("processing_time"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dictionary = sqliteTable("dictionary", {
  id: integer().primaryKey({ autoIncrement: true }),
  tibetan: text("tibetan").notNull(),
  english: text("english").notNull(),
  context: text("context"),
});

export const batchJobs = sqliteTable("batch_jobs", {
  jobId: text("id").primaryKey(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  totalFiles: integer("total_files").notNull(),
  processedFiles: integer("processed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  translationIds: text("translation_ids"),
  originalFileName: text("original_file_name"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
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
export const translationMetrics = sqliteTable("translation_metrics", {
  id: integer().primaryKey({ autoIncrement: true }),
  translationId: text("translation_id"),
  sessionId: text("session_id"),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),

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

export const insertTranslationMetricsSchema = createInsertSchema(translationMetrics);
export const selectTranslationMetricsSchema = createSelectSchema(translationMetrics);
export type InsertTranslationMetrics = z.infer<typeof insertTranslationMetricsSchema>;
export type TranslationMetricsRecord = z.infer<typeof selectTranslationMetricsSchema>;

// API keys table for authentication (Phase 4.1.1)
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  userId: text("user_id"),
  permissions: text("permissions").notNull(), // JSON array: ['translate', 'jobs', 'admin']
  rateLimit: integer("rate_limit").notNull().default(100), // requests per hour
  requestsCount: integer("requests_count").notNull().default(0),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at"),
  revoked: integer("revoked").notNull().default(0), // boolean as integer
});

// Audit logs table for security events (Phase 4.1.4)
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
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