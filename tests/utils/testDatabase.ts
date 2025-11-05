// File: tests/utils/testDatabase.ts
// Database utilities for testing

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../../db/schema.sqlite';
import { TestData } from './fixtures';
import path from 'path';
import fs from 'fs';

/**
 * Test database configuration
 */
export interface TestDatabaseConfig {
  name?: string;
  inMemory?: boolean;
  verbose?: boolean;
}

/**
 * Database service wrapper for testing
 */
export class TestDatabaseService {
  private db: any;
  private sqlite: Database.Database;
  private dbPath: string;

  constructor(private config: TestDatabaseConfig = {}) {
    const name = config.name || `test-${Date.now()}.db`;
    this.dbPath = config.inMemory ? ':memory:' : path.join(process.cwd(), 'tests', '.temp', name);
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    // Create temp directory if needed
    if (!this.config.inMemory) {
      const tempDir = path.dirname(this.dbPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    }

    // Create SQLite database
    this.sqlite = new Database(this.dbPath, {
      verbose: this.config.verbose ? console.log : undefined,
    });

    // Initialize Drizzle
    this.db = drizzle(this.sqlite, { schema });

    // Create tables
    await this.createTables();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    // Translations table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS translations (
        id TEXT PRIMARY KEY,
        sourceText TEXT NOT NULL,
        translatedText TEXT NOT NULL,
        confidence REAL,
        metadata TEXT,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      )
    `);

    // Dictionary table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS dictionary (
        id TEXT PRIMARY KEY,
        tibetan TEXT NOT NULL,
        english TEXT NOT NULL,
        wylie TEXT,
        sanskrit TEXT,
        category TEXT,
        frequency TEXT,
        context TEXT,
        createdAt INTEGER DEFAULT (unixepoch())
      )
    `);

    // Batch jobs table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS batchJobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        totalPages INTEGER,
        completedPages INTEGER DEFAULT 0,
        metadata TEXT,
        createdAt INTEGER DEFAULT (unixepoch()),
        updatedAt INTEGER DEFAULT (unixepoch())
      )
    `);

    // Metrics table (for monitoring)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER DEFAULT (unixepoch()),
        metricName TEXT NOT NULL,
        value REAL NOT NULL,
        tags TEXT
      )
    `);

    // Create indexes
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_translations_created ON translations(createdAt);
      CREATE INDEX IF NOT EXISTS idx_dictionary_tibetan ON dictionary(tibetan);
      CREATE INDEX IF NOT EXISTS idx_dictionary_category ON dictionary(category);
      CREATE INDEX IF NOT EXISTS idx_batchjobs_status ON batchJobs(status);
      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metricName);
    `);
  }

  /**
   * Get the Drizzle database instance
   */
  getDb(): any {
    return this.db;
  }

  /**
   * Get the raw SQLite database instance
   */
  getSqlite(): Database.Database {
    return this.sqlite;
  }

  /**
   * Execute raw SQL query
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.sqlite.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Execute raw SQL statement
   */
  async execute(sql: string, params: any[] = []): Promise<void> {
    const stmt = this.sqlite.prepare(sql);
    stmt.run(...params);
  }

  /**
   * Clean up all data from tables
   */
  async cleanup(): Promise<void> {
    this.sqlite.exec('DELETE FROM translations');
    this.sqlite.exec('DELETE FROM dictionary');
    this.sqlite.exec('DELETE FROM batchJobs');
    this.sqlite.exec('DELETE FROM metrics');

    // Reset autoincrement
    this.sqlite.exec('DELETE FROM sqlite_sequence');
  }

  /**
   * Close database connection and optionally delete file
   */
  async close(deleteFile = false): Promise<void> {
    if (this.sqlite) {
      this.sqlite.close();
    }

    if (deleteFile && !this.config.inMemory && fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }
  }

  /**
   * Seed database with test data
   */
  async seed(data?: typeof TestData): Promise<void> {
    const testData = data || TestData;

    // Seed dictionary entries
    if (testData.dictionary) {
      const entries = [
        ...testData.dictionary.common,
        ...testData.dictionary.religious,
        ...testData.dictionary.technical,
      ];

      for (const entry of entries) {
        await this.execute(
          `INSERT INTO dictionary (id, tibetan, english, wylie, sanskrit, category, frequency, context)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id,
            entry.tibetan,
            entry.english,
            entry.wylie || null,
            entry.sanskrit || null,
            entry.category,
            entry.frequency,
            entry.context || null,
          ]
        );
      }
    }

    // Seed some translations
    await this.execute(
      `INSERT INTO translations (id, sourceText, translatedText, confidence, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'test-trans-1',
        testData.tibetan.simple,
        testData.translations.valid,
        0.95,
        JSON.stringify({ test: true }),
      ]
    );

    // Seed a batch job
    await this.execute(
      `INSERT INTO batchJobs (id, status, totalPages, completedPages, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'test-job-1',
        'pending',
        10,
        0,
        JSON.stringify({ test: true }),
      ]
    );
  }

  /**
   * Get table counts (useful for assertions)
   */
  async getCounts(): Promise<Record<string, number>> {
    const translations = await this.query<{ count: number }>('SELECT COUNT(*) as count FROM translations');
    const dictionary = await this.query<{ count: number }>('SELECT COUNT(*) as count FROM dictionary');
    const batchJobs = await this.query<{ count: number }>('SELECT COUNT(*) as count FROM batchJobs');
    const metrics = await this.query<{ count: number }>('SELECT COUNT(*) as count FROM metrics');

    return {
      translations: translations[0].count,
      dictionary: dictionary[0].count,
      batchJobs: batchJobs[0].count,
      metrics: metrics[0].count,
    };
  }

  /**
   * Begin a transaction
   */
  beginTransaction(): void {
    this.sqlite.exec('BEGIN TRANSACTION');
  }

  /**
   * Commit a transaction
   */
  commitTransaction(): void {
    this.sqlite.exec('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  rollbackTransaction(): void {
    this.sqlite.exec('ROLLBACK');
  }
}

/**
 * Setup test database (convenience function)
 */
export async function setupTestDb(config?: TestDatabaseConfig): Promise<TestDatabaseService> {
  const db = new TestDatabaseService({
    inMemory: true, // Use in-memory by default for speed
    verbose: false,
    ...config,
  });

  await db.initialize();
  return db;
}

/**
 * Cleanup test database (convenience function)
 */
export async function cleanupTestDb(db: TestDatabaseService, deleteFile = false): Promise<void> {
  await db.cleanup();
  await db.close(deleteFile);
}

/**
 * Seed test database (convenience function)
 */
export async function seedTestData(db: TestDatabaseService, data?: typeof TestData): Promise<void> {
  await db.seed(data);
}

/**
 * Create a temporary test database with auto-cleanup
 */
export async function withTestDatabase<T>(
  fn: (db: TestDatabaseService) => Promise<T>,
  config?: TestDatabaseConfig
): Promise<T> {
  const db = await setupTestDb(config);

  try {
    return await fn(db);
  } finally {
    await cleanupTestDb(db, true);
  }
}

/**
 * Create a seeded test database with auto-cleanup
 */
export async function withSeededDatabase<T>(
  fn: (db: TestDatabaseService) => Promise<T>,
  data?: typeof TestData,
  config?: TestDatabaseConfig
): Promise<T> {
  return withTestDatabase(async (db) => {
    await seedTestData(db, data);
    return fn(db);
  }, config);
}

/**
 * Clean up all test databases in temp directory
 */
export function cleanupAllTestDatabases(): void {
  const tempDir = path.join(process.cwd(), 'tests', '.temp');

  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);

    for (const file of files) {
      if (file.endsWith('.db')) {
        const filePath = path.join(tempDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.warn(`Failed to delete test database: ${filePath}`, error);
        }
      }
    }
  }
}

/**
 * Export for use in tests
 */
export default {
  TestDatabaseService,
  setupTestDb,
  cleanupTestDb,
  seedTestData,
  withTestDatabase,
  withSeededDatabase,
  cleanupAllTestDatabases,
};
