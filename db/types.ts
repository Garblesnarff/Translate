// Export unified types that work with both PostgreSQL and SQLite schemas
export type InsertTranslation = {
  sourceText: string;
  translatedText: string;
  confidence: string;
  sourceFileName?: string | null;
  pageCount?: number | null;
  processingTime?: number | null;
  topics?: string | null;
  textLength?: number | null;
  status?: string;
};

export type Translation = {
  id: number;
  sourceText: string;
  translatedText: string;
  confidence: string;
  sourceFileName?: string | null;
  pageCount?: number | null;
  processingTime?: number | null;
  topics?: string | null;
  textLength?: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertBatchJob = {
  jobId: string;
  totalFiles: number;
  processedFiles?: number;
  failedFiles?: number;
  status?: string;
  translationIds?: string | null;
  errorMessage?: string | null;
};

export type BatchJob = {
  id: number;
  jobId: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  translationIds?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
};

export type InsertDictionary = {
  tibetan: string;
  english: string;
  context?: string | null;
};

export type Dictionary = {
  id: number;
  tibetan: string;
  english: string;
  context?: string | null;
};