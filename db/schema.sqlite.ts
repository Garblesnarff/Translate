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