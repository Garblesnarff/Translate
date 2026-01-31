# Database Migrations V2

This directory contains database migrations for the V2 schema.

## Quick Start

```bash
# Run all pending migrations
npm run migrate:v2

# Check migration status
npm run migrate:v2:status

# Rollback last migration
npm run migrate:v2:rollback

# Rollback last 3 migrations
npm run migrate:v2:rollback 3
```

## How It Works

1. **Migration Files** - Named `NNN_description.ts` (e.g., `001_initial_schema.ts`)
2. **Applied Migrations** - Tracked in `migrations` table
3. **Automatic Detection** - Runner automatically detects and runs pending migrations
4. **Dual Database** - Each migration has `upPostgres`/`upSqlite` and `downPostgres`/`downSqlite`

## Creating a New Migration

### Step 1: Create File

Create a new file: `migrations-v2/002_add_embeddings.ts`

```typescript
export const name = '002_add_embeddings';

export async function upPostgres(db: DatabaseService): Promise<void> {
  console.log('Adding embeddings support (PostgreSQL)...');

  // Add embedding column
  await db.query(`
    ALTER TABLE translations
    ADD COLUMN embedding_v2 vector(768);
  `);

  // Add index
  await db.query(`
    CREATE INDEX idx_embedding ON translations
    USING ivfflat (embedding_v2 vector_cosine_ops);
  `);

  console.log('✅ Embeddings support added');
}

export async function upSqlite(db: DatabaseService): Promise<void> {
  console.log('Adding embeddings support (SQLite)...');

  // SQLite doesn't support ALTER COLUMN directly
  // Need to recreate table (or use TEXT for embedding)
  await db.query(`
    ALTER TABLE translations
    ADD COLUMN embedding_v2 TEXT;
  `);

  console.log('✅ Embeddings support added');
}

export async function downPostgres(db: DatabaseService): Promise<void> {
  await db.query(`ALTER TABLE translations DROP COLUMN embedding_v2;`);
}

export async function downSqlite(db: DatabaseService): Promise<void> {
  // SQLite doesn't support DROP COLUMN in older versions
  console.log('⚠️ Manual rollback required for SQLite');
}
```

### Step 2: Run Migration

```bash
npm run migrate:v2
```

Output:
```
🔄 Starting migration process...
📋 Found 1 pending migration(s)
⏳ Applying migration: 002_add_embeddings
Adding embeddings support (PostgreSQL)...
✅ Embeddings support added
✅ Applied migration: 002_add_embeddings
✅ Migration process completed
```

## Migration Best Practices

### 1. Always Support Both Databases

```typescript
// ✅ Good
export async function upPostgres(db) { /* PostgreSQL-specific */ }
export async function upSqlite(db) { /* SQLite-specific */ }

// ❌ Bad
export async function up(db) { /* Only works for one DB */ }
```

### 2. Make Migrations Idempotent

```typescript
// ✅ Good (can run multiple times safely)
await db.query(`
  CREATE TABLE IF NOT EXISTS new_table (...)
`);

// ❌ Bad (fails if table exists)
await db.query(`
  CREATE TABLE new_table (...)
`);
```

### 3. Test Rollback

Always test that `down()` properly undoes `up()`:

```bash
npm run migrate:v2        # Apply
npm run migrate:v2:rollback  # Rollback
npm run migrate:v2        # Should work again
```

### 4. Use Transactions

The migration runner automatically wraps migrations in transactions, but for complex operations:

```typescript
export async function upPostgres(db: DatabaseService): Promise<void> {
  // Multiple operations - all succeed or all fail
  await db.query(`CREATE TABLE ...`);
  await db.query(`CREATE INDEX ...`);
  await db.query(`INSERT INTO ...`);
}
```

### 5. Data Migrations

When migrating data, process in batches:

```typescript
export async function upPostgres(db: DatabaseService): Promise<void> {
  // Add new column
  await db.query(`ALTER TABLE translations ADD COLUMN new_field TEXT`);

  // Migrate data in batches
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const rows = await db.query(
      `SELECT id, old_field FROM translations LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    );

    if (rows.length === 0) break;

    for (const row of rows) {
      await db.query(
        `UPDATE translations SET new_field = $1 WHERE id = $2`,
        [transformData(row.old_field), row.id]
      );
    }

    offset += batchSize;
    console.log(`Processed ${offset} rows...`);
  }

  // Drop old column
  await db.query(`ALTER TABLE translations DROP COLUMN old_field`);
}
```

## Migration File Naming

Format: `NNN_description.ts`

- `NNN` - Sequential number (001, 002, 003...)
- `description` - Snake_case description
- `.ts` - TypeScript extension

Examples:
- ✅ `001_initial_schema.ts`
- ✅ `002_add_embeddings.ts`
- ✅ `003_create_user_tables.ts`
- ❌ `add_embeddings.ts` (missing number)
- ❌ `2_embeddings.ts` (not zero-padded)
- ❌ `002-add-embeddings.ts` (wrong separator)

## Troubleshooting

### Migration Failed Midway

If a migration fails, it will be rolled back automatically. Fix the migration file and run again:

```bash
npm run migrate:v2
```

### Manual Rollback Needed

If automatic rollback fails:

```sql
-- Connect to database
psql $DATABASE_URL

-- Remove from migrations table
DELETE FROM migrations WHERE name = '002_add_embeddings';

-- Manually undo changes
DROP TABLE IF EXISTS new_table;
```

### Check What's Applied

```bash
npm run migrate:v2:status
```

Output:
```
📊 Migration Status:

Applied migrations:
  ✅ 001_initial_schema

Pending migrations:
  ⏳ 002_add_embeddings
  ⏳ 003_create_user_tables
```

### Migrations Table Doesn't Exist

If you get "table 'migrations' does not exist", the migration system will create it automatically on first run.

## Production Deployment

### 1. Backup Database

```bash
# PostgreSQL
pg_dump $DATABASE_URL > backup.sql

# SQLite
cp tibetan_translation_v2.db tibetan_translation_v2.db.backup
```

### 2. Run Migrations

```bash
npm run migrate:v2
```

### 3. Verify

```bash
# Check status
npm run migrate:v2:status

# Verify tables exist
psql $DATABASE_URL -c "\dt"

# Spot check data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM translations;"
```

### 4. Rollback If Needed

```bash
npm run migrate:v2:rollback
```

## Advanced Usage

### Programmatic Migration

```typescript
import { DatabaseService } from '../server/core/database';
import { MigrationRunner } from './migrationRunner';

const db = new DatabaseService();
const runner = new MigrationRunner(db);

// Run all pending
await runner.migrate();

// Get status
await runner.status();

// Rollback
await runner.rollback(1);

await db.close();
```

### Custom Migration Directory

```typescript
const runner = new MigrationRunner(db, '/custom/migrations/path');
await runner.migrate();
```

## FAQ

**Q: Can I skip a migration?**
A: No, migrations must be applied in order. If you need to skip one, delete it before running.

**Q: What if I need to change an already-applied migration?**
A: Create a new migration to make the change. Never modify applied migrations.

**Q: Can I run migrations in parallel?**
A: No, migrations are intentionally sequential to maintain order.

**Q: What happens if I delete a migration file?**
A: The system will still consider it "applied" (it's in the migrations table). To re-run, remove from the table first.

**Q: How do I handle production data?**
A: Always test migrations on a copy of production data first. Use batch processing for large datasets.

## Migration History

| Version | Date | Description |
|---------|------|-------------|
| 001 | 2024-11-05 | Initial V2 schema with all tables |

