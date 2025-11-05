/**
 * Migration 001: Initial Schema V2
 *
 * Creates all V2 tables with proper normalization, indexes, and constraints
 */

import type { DatabaseService } from '../server/core/database';

export const name = '001_initial_schema';

/**
 * Apply migration (PostgreSQL)
 */
export async function upPostgres(db: DatabaseService): Promise<void> {
  console.log('Running migration 001_initial_schema (PostgreSQL)...');

  // Create dictionary_entries table
  await db.query(`
    CREATE TABLE IF NOT EXISTS dictionary_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tibetan TEXT NOT NULL,
      english TEXT NOT NULL,
      wylie TEXT,
      sanskrit TEXT,
      category VARCHAR(50) NOT NULL,
      frequency VARCHAR(20) NOT NULL,
      context TEXT,
      alternate_translations TEXT[],
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tibetan ON dictionary_entries(tibetan);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_category_frequency ON dictionary_entries(category, frequency);
  `);

  // Create translations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS translations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_text_hash VARCHAR(64) NOT NULL UNIQUE,
      source_text TEXT NOT NULL,
      translation TEXT NOT NULL,
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      quality_score JSONB,
      metadata JSONB,
      embedding JSONB,
      cached BOOLEAN NOT NULL DEFAULT FALSE,
      source_file_name TEXT,
      page_count INTEGER,
      text_length INTEGER,
      processing_time INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'completed',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_source_text_hash ON translations(source_text_hash);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON translations(created_at DESC);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_status ON translations(status);
  `);

  // Create metrics table
  await db.query(`
    CREATE TABLE IF NOT EXISTS metrics (
      timestamp TIMESTAMP NOT NULL,
      metric_name VARCHAR(100) NOT NULL,
      value REAL NOT NULL,
      tags JSONB,
      PRIMARY KEY (timestamp, metric_name)
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_metric_name ON metrics(metric_name);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp DESC);
  `);

  // Create batch_jobs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
      total_files INTEGER NOT NULL,
      processed_files INTEGER NOT NULL DEFAULT 0,
      failed_files INTEGER NOT NULL DEFAULT 0,
      translation_ids TEXT[],
      original_file_name TEXT,
      error_message TEXT,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_batch_status ON batch_jobs(status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_batch_created ON batch_jobs(created_at DESC);
  `);

  // Create translation_metrics table
  await db.query(`
    CREATE TABLE IF NOT EXISTS translation_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      translation_id UUID REFERENCES translations(id),
      session_id VARCHAR(100),
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      confidence_score REAL NOT NULL,
      quality_score REAL,
      model_agreement REAL,
      format_score REAL,
      processing_time_ms INTEGER NOT NULL,
      tokens_processed INTEGER,
      api_latency_ms INTEGER,
      model_used VARCHAR(50) NOT NULL,
      iterations_used INTEGER NOT NULL DEFAULT 1,
      retries_needed INTEGER NOT NULL DEFAULT 0,
      helper_models_used TEXT[],
      gates_passed BOOLEAN NOT NULL DEFAULT TRUE,
      gate_results JSONB,
      page_number INTEGER,
      document_id VARCHAR(100),
      text_length INTEGER NOT NULL,
      chunk_count INTEGER,
      error_occurred BOOLEAN NOT NULL DEFAULT FALSE,
      error_type VARCHAR(50),
      error_message TEXT
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tm_translation_id ON translation_metrics(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tm_timestamp ON translation_metrics(timestamp DESC);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tm_model_used ON translation_metrics(model_used);
  `);

  // Create review_queue table
  await db.query(`
    CREATE TABLE IF NOT EXISTS review_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      translation_id UUID NOT NULL REFERENCES translations(id),
      reason TEXT NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
      assigned_to VARCHAR(100),
      review_notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_rq_translation_id ON review_queue(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_rq_status ON review_queue(status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_rq_severity ON review_queue(severity);
  `);

  // Create translation_corrections table
  await db.query(`
    CREATE TABLE IF NOT EXISTS translation_corrections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      translation_id UUID NOT NULL REFERENCES translations(id),
      review_item_id UUID REFERENCES review_queue(id),
      original_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      correction_type VARCHAR(50) NOT NULL,
      corrected_by VARCHAR(100),
      correction_reason TEXT,
      extracted_terms JSONB,
      applied_to_dictionary BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tc_translation_id ON translation_corrections(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tc_correction_type ON translation_corrections(correction_type);
  `);

  // Create glossaries table
  await db.query(`
    CREATE TABLE IF NOT EXISTS glossaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      translation_id UUID REFERENCES translations(id),
      batch_job_id UUID REFERENCES batch_jobs(id),
      glossary_data JSONB NOT NULL,
      total_terms INTEGER NOT NULL,
      inconsistent_terms INTEGER NOT NULL DEFAULT 0,
      consistency_score REAL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_gloss_translation_id ON glossaries(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_gloss_batch_job_id ON glossaries(batch_job_id);
  `);

  console.log('✅ Migration 001_initial_schema (PostgreSQL) completed');
}

/**
 * Apply migration (SQLite)
 */
export async function upSqlite(db: DatabaseService): Promise<void> {
  console.log('Running migration 001_initial_schema (SQLite)...');

  // Create dictionary_entries table
  await db.query(`
    CREATE TABLE IF NOT EXISTS dictionary_entries (
      id TEXT PRIMARY KEY,
      tibetan TEXT NOT NULL,
      english TEXT NOT NULL,
      wylie TEXT,
      sanskrit TEXT,
      category TEXT NOT NULL,
      frequency TEXT NOT NULL,
      context TEXT,
      alternate_translations TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tibetan ON dictionary_entries(tibetan);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_category ON dictionary_entries(category);
  `);

  // Create translations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY,
      source_text_hash TEXT NOT NULL UNIQUE,
      source_text TEXT NOT NULL,
      translation TEXT NOT NULL,
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      quality_score TEXT,
      metadata TEXT,
      embedding TEXT,
      cached INTEGER NOT NULL DEFAULT 0,
      source_file_name TEXT,
      page_count INTEGER,
      text_length INTEGER,
      processing_time INTEGER,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_source_text_hash ON translations(source_text_hash);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON translations(created_at);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_status ON translations(status);
  `);

  // Create metrics table
  await db.query(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      value REAL NOT NULL,
      tags TEXT
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_metric_name ON metrics(metric_name);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_timestamp_metric ON metrics(timestamp, metric_name);
  `);

  // Create batch_jobs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      total_files INTEGER NOT NULL,
      processed_files INTEGER NOT NULL DEFAULT 0,
      failed_files INTEGER NOT NULL DEFAULT 0,
      translation_ids TEXT,
      original_file_name TEXT,
      error_message TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_batch_status ON batch_jobs(status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_batch_created ON batch_jobs(created_at);
  `);

  // Create translation_metrics table
  await db.query(`
    CREATE TABLE IF NOT EXISTS translation_metrics (
      id TEXT PRIMARY KEY,
      translation_id TEXT REFERENCES translations(id),
      session_id TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confidence_score REAL NOT NULL,
      quality_score REAL,
      model_agreement REAL,
      format_score REAL,
      processing_time_ms INTEGER NOT NULL,
      tokens_processed INTEGER,
      api_latency_ms INTEGER,
      model_used TEXT NOT NULL,
      iterations_used INTEGER NOT NULL DEFAULT 1,
      retries_needed INTEGER NOT NULL DEFAULT 0,
      helper_models_used TEXT,
      gates_passed INTEGER NOT NULL DEFAULT 1,
      gate_results TEXT,
      page_number INTEGER,
      document_id TEXT,
      text_length INTEGER NOT NULL,
      chunk_count INTEGER,
      error_occurred INTEGER NOT NULL DEFAULT 0,
      error_type TEXT,
      error_message TEXT
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tm_translation_id ON translation_metrics(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tm_timestamp ON translation_metrics(timestamp);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tm_model_used ON translation_metrics(model_used);
  `);

  // Create review_queue table
  await db.query(`
    CREATE TABLE IF NOT EXISTS review_queue (
      id TEXT PRIMARY KEY,
      translation_id TEXT NOT NULL REFERENCES translations(id),
      reason TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_to TEXT,
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_rq_translation_id ON review_queue(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_rq_status ON review_queue(status);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_rq_severity ON review_queue(severity);
  `);

  // Create translation_corrections table
  await db.query(`
    CREATE TABLE IF NOT EXISTS translation_corrections (
      id TEXT PRIMARY KEY,
      translation_id TEXT NOT NULL REFERENCES translations(id),
      review_item_id TEXT REFERENCES review_queue(id),
      original_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      correction_type TEXT NOT NULL,
      corrected_by TEXT,
      correction_reason TEXT,
      extracted_terms TEXT,
      applied_to_dictionary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tc_translation_id ON translation_corrections(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_tc_correction_type ON translation_corrections(correction_type);
  `);

  // Create glossaries table
  await db.query(`
    CREATE TABLE IF NOT EXISTS glossaries (
      id TEXT PRIMARY KEY,
      translation_id TEXT REFERENCES translations(id),
      batch_job_id TEXT REFERENCES batch_jobs(id),
      glossary_data TEXT NOT NULL,
      total_terms INTEGER NOT NULL,
      inconsistent_terms INTEGER NOT NULL DEFAULT 0,
      consistency_score REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_gloss_translation_id ON glossaries(translation_id);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_gloss_batch_job_id ON glossaries(batch_job_id);
  `);

  console.log('✅ Migration 001_initial_schema (SQLite) completed');
}

/**
 * Rollback migration (PostgreSQL)
 */
export async function downPostgres(db: DatabaseService): Promise<void> {
  console.log('Rolling back migration 001_initial_schema (PostgreSQL)...');

  // Drop tables in reverse order to respect foreign key constraints
  const tables = [
    'glossaries',
    'translation_corrections',
    'review_queue',
    'translation_metrics',
    'batch_jobs',
    'metrics',
    'translations',
    'dictionary_entries'
  ];

  for (const table of tables) {
    await db.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
  }

  console.log('✅ Migration 001_initial_schema (PostgreSQL) rolled back');
}

/**
 * Rollback migration (SQLite)
 */
export async function downSqlite(db: DatabaseService): Promise<void> {
  console.log('Rolling back migration 001_initial_schema (SQLite)...');

  // Drop tables in reverse order to respect foreign key constraints
  const tables = [
    'glossaries',
    'translation_corrections',
    'review_queue',
    'translation_metrics',
    'batch_jobs',
    'metrics',
    'translations',
    'dictionary_entries'
  ];

  for (const table of tables) {
    await db.query(`DROP TABLE IF EXISTS ${table};`);
  }

  console.log('✅ Migration 001_initial_schema (SQLite) rolled back');
}
