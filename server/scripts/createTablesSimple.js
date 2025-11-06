/**
 * Simple script to create security tables using better-sqlite3 directly
 */

import Database from 'better-sqlite3';

const db = new Database('./tibetan_translation.db');

console.log('🔐 Creating security tables...\n');

try {
  // Create api_keys table
  console.log('Creating api_keys table...');

  db.exec(`
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

  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);`);

  console.log('✅ api_keys table created');

  // Create audit_logs table
  console.log('Creating audit_logs table...');

  db.exec(`
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

  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_id ON audit_logs(api_key_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);

  console.log('✅ audit_logs table created');

  // Verify tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\n📋 All tables:', tables.map(t => t.name).join(', '));

  console.log('\n✅ Security tables created successfully!');
  console.log('\nNext steps:');
  console.log('1. Generate an API key: npx tsx server/scripts/generateApiKey.ts --name "My App" --permissions translate');
  console.log('2. Use the API key in requests: Authorization: Bearer <api-key>');

  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error creating security tables:', error);
  db.close();
  process.exit(1);
}
