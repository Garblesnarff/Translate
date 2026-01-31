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

// ============================================================================
// KNOWLEDGE GRAPH TABLES (Phase 0: Foundation)
// ============================================================================

// Entities table - stores all extracted entities (people, places, texts, events, etc.)
export const entities = sqliteTable("entities", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["person", "place", "text", "event", "lineage", "concept", "institution", "deity"]
  }).notNull(),
  canonicalName: text("canonical_name").notNull(),
  names: text("names").notNull(), // JSON: {tibetan: [], english: [], phonetic: [], wylie: []}
  attributes: text("attributes").notNull().default('{}'), // JSON: flexible schema per type
  dates: text("dates"), // JSON: {birth: {...}, death: {...}, founded: {...}}
  confidence: text("confidence").notNull().default('0.5'), // stored as text for precision
  verified: integer("verified").notNull().default(0), // boolean as integer
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().default('ai'),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
});

// Relationships table - stores connections between entities
export const relationships = sqliteTable("relationships", {
  id: text("id").primaryKey(),
  subjectId: text("subject_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  predicate: text("predicate").notNull(), // teacher_of, student_of, wrote, lived_at, etc.
  objectId: text("object_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  properties: text("properties").notNull().default('{}'), // JSON: {date: {...}, location: '...', teaching: '...'}
  confidence: text("confidence").notNull().default('0.5'),
  verified: integer("verified").notNull().default(0),
  sourceDocumentId: integer("source_document_id").references(() => translations.id),
  sourcePage: text("source_page"),
  sourceQuote: text("source_quote"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").notNull().default('ai'),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
});

// Lineages table - stores transmission lineages, incarnation lineages, etc.
export const lineages = sqliteTable("lineages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tibetanName: text("tibetan_name"),
  lineageType: text("lineage_type", {
    enum: ["incarnation", "transmission", "ordination", "family", "institutional"]
  }).notNull(),
  tradition: text("tradition"), // Nyingma, Kagyu, Sakya, Gelug, Bon, Rimé
  teaching: text("teaching"), // What's being transmitted
  originTextId: text("origin_text_id").references(() => entities.id),
  originDate: text("origin_date"), // JSON: DateInfo
  chain: text("chain").notNull().default('[]'), // JSON: [{position: 1, personId: '...', date: {...}}]
  branches: text("branches").default('[]'), // JSON: [lineage_id_1, lineage_id_2]
  sources: text("sources").default('[]'), // JSON: [SourceReference]
  confidence: text("confidence").notNull().default('0.5'),
  verified: integer("verified").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Extraction jobs table - tracks entity extraction progress
export const extractionJobs = sqliteTable("extraction_jobs", {
  id: text("id").primaryKey(),
  translationId: integer("translation_id").notNull().references(() => translations.id),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"]
  }).notNull().default("pending"),
  entitiesExtracted: integer("entities_extracted").notNull().default(0),
  relationshipsExtracted: integer("relationships_extracted").notNull().default(0),
  confidenceAvg: text("confidence_avg"), // stored as text for precision
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Batch extraction jobs table - tracks batch processing of multiple documents
export const batchExtractionJobs = sqliteTable("batch_extraction_jobs", {
  id: text("id").primaryKey(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"]
  }).notNull().default("pending"),
  totalDocuments: integer("total_documents").notNull().default(0),
  documentsProcessed: integer("documents_processed").notNull().default(0),
  documentsFailed: integer("documents_failed").notNull().default(0),
  totalEntities: integer("total_entities").notNull().default(0),
  totalRelationships: integer("total_relationships").notNull().default(0),
  avgConfidence: text("avg_confidence"),
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Export schemas and types for knowledge graph tables
export const insertEntitySchema = createInsertSchema(entities);
export const selectEntitySchema = createSelectSchema(entities);
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = z.infer<typeof selectEntitySchema>;

export const insertRelationshipSchema = createInsertSchema(relationships);
export const selectRelationshipSchema = createSelectSchema(relationships);
export type InsertRelationship = z.infer<typeof insertRelationshipSchema>;
export type Relationship = z.infer<typeof selectRelationshipSchema>;

export const insertLineageSchema = createInsertSchema(lineages);
export const selectLineageSchema = createSelectSchema(lineages);
export type InsertLineage = z.infer<typeof insertLineageSchema>;
export type Lineage = z.infer<typeof selectLineageSchema>;

export const insertExtractionJobSchema = createInsertSchema(extractionJobs);
export const selectExtractionJobSchema = createSelectSchema(extractionJobs);
export type InsertExtractionJob = z.infer<typeof insertExtractionJobSchema>;
export type ExtractionJob = z.infer<typeof selectExtractionJobSchema>;

export const insertBatchExtractionJobSchema = createInsertSchema(batchExtractionJobs);
export const selectBatchExtractionJobSchema = createSelectSchema(batchExtractionJobs);
export type InsertBatchExtractionJob = z.infer<typeof insertBatchExtractionJobSchema>;
export type BatchExtractionJob = z.infer<typeof selectBatchExtractionJobSchema>;