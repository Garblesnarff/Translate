/**
 * Migration Runner
 *
 * Executes database migrations in order
 * Tracks applied migrations in the database
 */

import type { DatabaseService } from '../server/core/database';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  name: string;
  upPostgres?: (db: DatabaseService) => Promise<void>;
  upSqlite?: (db: DatabaseService) => Promise<void>;
  downPostgres?: (db: DatabaseService) => Promise<void>;
  downSqlite?: (db: DatabaseService) => Promise<void>;
}

export class MigrationRunner {
  constructor(
    private db: DatabaseService,
    private migrationsDir: string = path.join(__dirname)
  ) {}

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const isPostgres = this.db.dialect === 'postgres';

    if (isPostgres) {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    } else {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<string[]> {
    const result = await this.db.query<{ name: string }>(`
      SELECT name FROM migrations ORDER BY id ASC
    `);

    return result.map(r => r.name);
  }

  /**
   * Mark migration as applied
   */
  private async markMigrationApplied(name: string): Promise<void> {
    await this.db.query(
      `INSERT INTO migrations (name) VALUES ($1)`,
      [name]
    );
  }

  /**
   * Remove migration from applied list
   */
  private async unmarkMigration(name: string): Promise<void> {
    await this.db.query(
      `DELETE FROM migrations WHERE name = $1`,
      [name]
    );
  }

  /**
   * Load all migration files
   */
  private async loadMigrations(): Promise<Migration[]> {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.match(/^\d+_.*\.ts$/) && f !== 'migrationRunner.ts')
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const filepath = path.join(this.migrationsDir, file);
      const module = await import(filepath);
      migrations.push(module);
    }

    return migrations;
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<void> {
    console.log('🔄 Starting migration process...');

    await this.ensureMigrationsTable();

    const applied = await this.getAppliedMigrations();
    const migrations = await this.loadMigrations();
    const pending = migrations.filter(m => !applied.includes(m.name));

    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pending.length} pending migration(s)`);

    const isPostgres = this.db.dialect === 'postgres';

    for (const migration of pending) {
      console.log(`⏳ Applying migration: ${migration.name}`);

      try {
        await this.db.transaction(async () => {
          if (isPostgres && migration.upPostgres) {
            await migration.upPostgres(this.db);
          } else if (!isPostgres && migration.upSqlite) {
            await migration.upSqlite(this.db);
          } else {
            throw new Error(`Migration ${migration.name} does not support ${this.db.dialect}`);
          }

          await this.markMigrationApplied(migration.name);
        });

        console.log(`✅ Applied migration: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Failed to apply migration: ${migration.name}`, error);
        throw error;
      }
    }

    console.log('✅ Migration process completed');
  }

  /**
   * Rollback last N migrations
   */
  async rollback(count: number = 1): Promise<void> {
    console.log(`🔄 Rolling back ${count} migration(s)...`);

    await this.ensureMigrationsTable();

    const applied = await this.getAppliedMigrations();
    const toRollback = applied.slice(-count).reverse();

    if (toRollback.length === 0) {
      console.log('✅ No migrations to rollback');
      return;
    }

    const migrations = await this.loadMigrations();
    const isPostgres = this.db.dialect === 'postgres';

    for (const name of toRollback) {
      const migration = migrations.find(m => m.name === name);
      if (!migration) {
        console.warn(`⚠️ Migration file not found: ${name}`);
        continue;
      }

      console.log(`⏳ Rolling back migration: ${name}`);

      try {
        await this.db.transaction(async () => {
          if (isPostgres && migration.downPostgres) {
            await migration.downPostgres(this.db);
          } else if (!isPostgres && migration.downSqlite) {
            await migration.downSqlite(this.db);
          } else {
            throw new Error(`Migration ${name} does not support rollback for ${this.db.dialect}`);
          }

          await this.unmarkMigration(name);
        });

        console.log(`✅ Rolled back migration: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to rollback migration: ${name}`, error);
        throw error;
      }
    }

    console.log('✅ Rollback completed');
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    await this.ensureMigrationsTable();

    const applied = await this.getAppliedMigrations();
    const migrations = await this.loadMigrations();

    console.log('\n📊 Migration Status:\n');
    console.log('Applied migrations:');

    if (applied.length === 0) {
      console.log('  (none)');
    } else {
      applied.forEach(name => console.log(`  ✅ ${name}`));
    }

    const pending = migrations.filter(m => !applied.includes(m.name));

    console.log('\nPending migrations:');

    if (pending.length === 0) {
      console.log('  (none)');
    } else {
      pending.forEach(m => console.log(`  ⏳ ${m.name}`));
    }

    console.log('');
  }
}

/**
 * CLI for running migrations
 */
export async function runMigrationCLI() {
  const command = process.argv[2] || 'migrate';

  // Import database service
  const { DatabaseService } = await import('../server/core/database');
  const db = new DatabaseService();

  const runner = new MigrationRunner(db);

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await runner.migrate();
        break;

      case 'rollback':
      case 'down':
        const count = parseInt(process.argv[3] || '1', 10);
        await runner.rollback(count);
        break;

      case 'status':
        await runner.status();
        break;

      default:
        console.log('Usage:');
        console.log('  npm run migrate             - Run pending migrations');
        console.log('  npm run migrate:rollback [N] - Rollback last N migrations (default: 1)');
        console.log('  npm run migrate:status      - Show migration status');
        process.exit(1);
    }

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await db.close();
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  runMigrationCLI();
}
