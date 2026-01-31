// File: tests/examples/database.example.test.ts
// Example tests demonstrating database utilities

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TestDatabaseService,
  setupTestDb,
  cleanupTestDb,
  seedTestData,
  withTestDatabase,
  withSeededDatabase,
  TestData,
} from '../utils';

describe('Database Utilities Examples', () => {
  describe('Basic Database Operations', () => {
    let db: TestDatabaseService;

    beforeEach(async () => {
      db = await setupTestDb();
    });

    afterEach(async () => {
      await cleanupTestDb(db, true);
    });

    it('should create in-memory database', async () => {
      expect(db).toBeDefined();
      expect(db.getDb()).toBeDefined();
    });

    it('should execute queries', async () => {
      await db.execute(
        'INSERT INTO translations (id, sourceText, translatedText) VALUES (?, ?, ?)',
        ['test-1', 'source', 'translation']
      );

      const results = await db.query('SELECT * FROM translations WHERE id = ?', ['test-1']);

      expect(results).toHaveLength(1);
      expect(results[0].sourceText).toBe('source');
    });

    it('should clean up data', async () => {
      await db.execute(
        'INSERT INTO translations (id, sourceText, translatedText) VALUES (?, ?, ?)',
        ['test-1', 'source', 'translation']
      );

      expect((await db.getCounts()).translations).toBe(1);

      await db.cleanup();

      expect((await db.getCounts()).translations).toBe(0);
    });
  });

  describe('Database Seeding', () => {
    let db: TestDatabaseService;

    beforeEach(async () => {
      db = await setupTestDb();
    });

    afterEach(async () => {
      await cleanupTestDb(db, true);
    });

    it('should seed database with test data', async () => {
      await seedTestData(db);

      const counts = await db.getCounts();

      expect(counts.dictionary).toBeGreaterThan(0);
      expect(counts.translations).toBeGreaterThan(0);
      expect(counts.batchJobs).toBeGreaterThan(0);
    });

    it('should seed with custom data', async () => {
      const customData = {
        ...TestData,
        dictionary: {
          common: [
            {
              id: 'custom-1',
              tibetan: 'test',
              english: 'test',
              category: 'test',
              frequency: 'common',
            },
          ],
          religious: [],
          technical: [],
        },
      };

      await seedTestData(db, customData);

      const results = await db.query('SELECT * FROM dictionary WHERE id = ?', ['custom-1']);

      expect(results).toHaveLength(1);
      expect(results[0].tibetan).toBe('test');
    });
  });

  describe('Transaction Support', () => {
    let db: TestDatabaseService;

    beforeEach(async () => {
      db = await setupTestDb();
    });

    afterEach(async () => {
      await cleanupTestDb(db, true);
    });

    it('should support transactions with commit', async () => {
      db.beginTransaction();

      await db.execute(
        'INSERT INTO translations (id, sourceText, translatedText) VALUES (?, ?, ?)',
        ['test-1', 'source', 'translation']
      );

      db.commitTransaction();

      const results = await db.query('SELECT * FROM translations');
      expect(results).toHaveLength(1);
    });

    it('should support transactions with rollback', async () => {
      db.beginTransaction();

      await db.execute(
        'INSERT INTO translations (id, sourceText, translatedText) VALUES (?, ?, ?)',
        ['test-1', 'source', 'translation']
      );

      db.rollbackTransaction();

      const results = await db.query('SELECT * FROM translations');
      expect(results).toHaveLength(0);
    });
  });

  describe('Convenience Functions', () => {
    it('should use withTestDatabase for auto-cleanup', async () => {
      const result = await withTestDatabase(async (db) => {
        await db.execute(
          'INSERT INTO translations (id, sourceText, translatedText) VALUES (?, ?, ?)',
          ['test-1', 'source', 'translation']
        );

        const results = await db.query('SELECT * FROM translations');
        return results.length;
      });

      expect(result).toBe(1);
      // Database is automatically cleaned up here
    });

    it('should use withSeededDatabase for tests with data', async () => {
      await withSeededDatabase(async (db) => {
        const counts = await db.getCounts();

        expect(counts.dictionary).toBeGreaterThan(0);
        expect(counts.translations).toBeGreaterThan(0);
      });
    });

    it('should support custom config', async () => {
      await withTestDatabase(
        async (db) => {
          expect(db).toBeDefined();
        },
        { verbose: false, inMemory: true }
      );
    });
  });

  describe('Table Counts and Assertions', () => {
    it('should get accurate table counts', async () => {
      await withSeededDatabase(async (db) => {
        const counts = await db.getCounts();

        expect(counts).toHaveProperty('translations');
        expect(counts).toHaveProperty('dictionary');
        expect(counts).toHaveProperty('batchJobs');
        expect(counts).toHaveProperty('metrics');

        expect(typeof counts.translations).toBe('number');
        expect(typeof counts.dictionary).toBe('number');
      });
    });
  });
});
