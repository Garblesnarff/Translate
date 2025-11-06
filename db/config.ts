import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as sqliteDrizzle } from "drizzle-orm/better-sqlite3";
import pg from "pg";
const { Pool } = pg;
import Database from "better-sqlite3";
import * as pgSchema from "./schema";
import * as sqliteSchema from "./schema.sqlite";

let db: any = null;

export function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log("📁 No DATABASE_URL provided, using SQLite for development");
    const sqlite = new Database("./tibetan_translation.db");
    db = sqliteDrizzle(sqlite, { schema: sqliteSchema });
    return db;
  }
  
  if (databaseUrl.startsWith("sqlite:") || databaseUrl.endsWith(".db")) {
    console.log("📁 Using SQLite database");
    const dbPath = databaseUrl.replace("sqlite:", "");
    const sqlite = new Database(dbPath);
    db = sqliteDrizzle(sqlite, { schema: sqliteSchema });
    return db;
  }
  
  if (databaseUrl.startsWith("postgresql:") || databaseUrl.startsWith("postgres:")) {
    console.log("🐘 Using PostgreSQL database");
    const pool = new Pool({
      connectionString: databaseUrl,
    });
    db = pgDrizzle(pool, { schema: pgSchema });
    return db;
  }
  
  throw new Error(`Unsupported database URL format: ${databaseUrl}`);
}

export function getDatabase() {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

// Export the appropriate schema tables based on database type
export function getTables() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.startsWith("sqlite:") || databaseUrl.endsWith(".db")) {
    return {
      translations: sqliteSchema.translations,
      batchJobs: sqliteSchema.batchJobs,
      dictionary: sqliteSchema.dictionary,
      apiKeys: sqliteSchema.apiKeys,
      auditLogs: sqliteSchema.auditLogs,
    };
  } else {
    return {
      translations: pgSchema.translations,
      batchJobs: pgSchema.batchJobs,
      dictionary: pgSchema.dictionary,
      apiKeys: pgSchema.apiKeys,
      auditLogs: pgSchema.auditLogs,
    };
  }
}