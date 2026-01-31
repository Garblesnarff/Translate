/**
 * Migration 002: Security Tables
 *
 * Creates tables for Phase 4.1: Security & Authentication
 * - api_keys: API key authentication
 * - audit_logs: Security event logging
 */

import type { Db } from "../db/types";

export const id = "002_security_tables";
export const description = "Add API keys and audit logs tables for security";

export async function up(db: Db): Promise<void> {
  console.log("[migration] Creating api_keys table...");

  // Create api_keys table
  if (process.env.DATABASE_URL?.startsWith("postgresql")) {
    // PostgreSQL version
    await db.execute(`
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

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    `);
  } else {
    // SQLite version
    await db.execute(`
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

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    `);
  }

  console.log("[migration] Creating audit_logs table...");

  // Create audit_logs table
  if (process.env.DATABASE_URL?.startsWith("postgresql")) {
    // PostgreSQL version
    await db.execute(`
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

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);
  } else {
    // SQLite version
    await db.execute(`
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

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    `);
  }

  console.log("[migration] Security tables created successfully");
}

export async function down(db: Db): Promise<void> {
  console.log("[migration] Dropping security tables...");

  await db.execute(`DROP TABLE IF EXISTS audit_logs;`);
  await db.execute(`DROP TABLE IF EXISTS api_keys;`);

  console.log("[migration] Security tables dropped");
}
