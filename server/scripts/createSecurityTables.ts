/**
 * Create Security Tables Script
 *
 * Creates api_keys and audit_logs tables for Phase 4.1 security
 */

import { getDatabase } from "@db/config";
import { sql } from "drizzle-orm";

async function createSecurityTables() {
  console.log("🔐 Creating security tables...\n");

  try {
    const db = getDatabase();
    const isPostgres = process.env.DATABASE_URL?.startsWith("postgresql");

    console.log(`Database type: ${isPostgres ? "PostgreSQL" : "SQLite"}`);

    // Create api_keys table
    console.log("Creating api_keys table...");

    if (isPostgres) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          user_id TEXT,
          permissions TEXT NOT NULL,
          rate_limit INTEGER NOT NULL DEFAULT 100,
          requests_count INTEGER NOT NULL DEFAULT 0,
          last_used_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP,
          revoked INTEGER NOT NULL DEFAULT 0
        );
      `);
    } else {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          user_id TEXT,
          permissions TEXT NOT NULL,
          rate_limit INTEGER NOT NULL DEFAULT 100,
          requests_count INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TEXT,
          revoked INTEGER NOT NULL DEFAULT 0
        );
      `);
    }

    // Create indices for api_keys
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);`);

    console.log("✅ api_keys table created");

    // Create audit_logs table
    console.log("Creating audit_logs table...");

    if (isPostgres) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          event_type TEXT NOT NULL,
          user_id TEXT,
          api_key_id TEXT REFERENCES api_keys(id),
          ip_address TEXT,
          user_agent TEXT,
          resource TEXT,
          action TEXT,
          success INTEGER NOT NULL,
          details TEXT
        );
      `);
    } else {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          event_type TEXT NOT NULL,
          user_id TEXT,
          api_key_id TEXT REFERENCES api_keys(id),
          ip_address TEXT,
          user_agent TEXT,
          resource TEXT,
          action TEXT,
          success INTEGER NOT NULL,
          details TEXT
        );
      `);
    }

    // Create indices for audit_logs
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);

    console.log("✅ audit_logs table created");

    console.log("\n✅ Security tables created successfully!");
    console.log("\nNext steps:");
    console.log("1. Generate an API key: tsx server/scripts/generateApiKey.ts --name 'My App' --permissions translate");
    console.log("2. Use the API key in requests: Authorization: Bearer <api-key>");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating security tables:", error);
    process.exit(1);
  }
}

createSecurityTables();
