/**
 * Database Service V2
 *
 * Provides:
 * - Connection pooling (PostgreSQL)
 * - Transaction support
 * - Automatic reconnection
 * - Graceful shutdown
 * - Query execution with proper typing
 * - Support for both PostgreSQL and SQLite
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import Database from 'better-sqlite3';
import type { Database as SQLiteDatabase } from 'better-sqlite3';

export interface DatabaseConfig {
  // Database type
  dialect?: 'postgres' | 'sqlite';

  // PostgreSQL configuration
  connectionString?: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;

  // SQLite configuration
  sqlitePath?: string;

  // Health check configuration
  healthCheckInterval?: number; // milliseconds (default: 30000)
  enableHealthChecks?: boolean; // default: true

  // Retry configuration
  maxRetries?: number; // default: 3
  retryDelayMs?: number; // default: 1000

  // Monitoring configuration
  enableLeakDetection?: boolean; // default: true
  leakDetectionInterval?: number; // milliseconds (default: 300000)
  leakThresholdMs?: number; // milliseconds (default: 60000)
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (tx: Transaction) => Promise<T>;

/**
 * Transaction interface (abstraction over both PG and SQLite)
 */
export interface Transaction {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
}

/**
 * Active query tracking for leak detection
 */
interface ActiveQuery {
  sql: string;
  startTime: number;
  params?: any[];
}

/**
 * Database Service
 * Handles connection pooling, queries, and transactions
 */
export class DatabaseService {
  public readonly dialect: 'postgres' | 'sqlite';
  private pool?: Pool;
  private sqlite?: SQLiteDatabase;
  private isShuttingDown = false;
  private config: DatabaseConfig;

  // Health check
  private healthCheckInterval?: NodeJS.Timeout;
  private lastHealthCheck?: Date;
  private healthCheckFailures = 0;

  // Leak detection
  private activeQueries = new Map<string, ActiveQuery>();
  private leakDetectionInterval?: NodeJS.Timeout;

  // Metrics
  private metrics = {
    totalQueries: 0,
    failedQueries: 0,
    retries: 0,
    connectionErrors: 0,
  };

  constructor(config?: DatabaseConfig) {
    this.config = config || {};
    const databaseUrl = config?.connectionString || process.env.DATABASE_URL;

    // Determine dialect
    if (config?.dialect === 'sqlite' || !databaseUrl || databaseUrl.includes('.db')) {
      this.dialect = 'sqlite';
      const dbPath = config?.sqlitePath || databaseUrl?.replace('sqlite:', '') || './tibetan_translation_v2.db';
      this.sqlite = new Database(dbPath);
      console.log(`📁 DatabaseService initialized (SQLite): ${dbPath}`);
    } else {
      this.dialect = 'postgres';
      this.pool = this.createPool(config, databaseUrl);
      console.log('🐘 DatabaseService initialized (PostgreSQL)');
    }

    // Start health checks (default: enabled)
    if (this.config.enableHealthChecks !== false) {
      this.startHealthChecks();
    }

    // Start leak detection (default: enabled)
    if (this.config.enableLeakDetection !== false) {
      this.startLeakDetection();
    }
  }

  /**
   * Create PostgreSQL connection pool
   */
  private createPool(config?: DatabaseConfig, connectionString?: string): Pool {
    const poolConfig: PoolConfig = {
      connectionString,
      max: config?.maxConnections || 20,
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 2000,
    };

    const pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
      // Don't exit - let the app handle it
    });

    // Handle connection errors
    pool.on('connect', (client) => {
      console.log('✅ New database connection established');
    });

    pool.on('acquire', () => {
      // Client acquired from pool
    });

    pool.on('remove', () => {
      console.log('🔌 Database connection removed from pool');
    });

    return pool;
  }

  /**
   * Execute a query with retry logic
   * Returns array of results
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    const queryId = `query_${Date.now()}_${Math.random()}`;
    this.trackQuery(queryId, sql, params);

    try {
      this.metrics.totalQueries++;

      // Execute with retry logic
      const result = await this.queryWithRetry<T>(sql, params);

      this.releaseQuery(queryId);
      return result;
    } catch (error) {
      this.metrics.failedQueries++;
      this.releaseQuery(queryId);
      throw error;
    }
  }

  /**
   * Execute query with exponential backoff retry
   */
  private async queryWithRetry<T>(sql: string, params?: any[]): Promise<T[]> {
    const maxRetries = this.config.maxRetries || 3;
    const baseDelay = this.config.retryDelayMs || 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (this.dialect === 'postgres') {
          return await this.queryPostgres<T>(sql, params);
        } else {
          return await this.querySqlite<T>(sql, params);
        }
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        // Only retry if not the last attempt
        if (attempt < maxRetries - 1) {
          this.metrics.retries++;
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000); // Max 10s
          console.warn(`Query failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Query failed after all retries');
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: any): boolean {
    const message = error.message?.toLowerCase() || '';

    // Don't retry syntax errors, permission errors, etc.
    const nonRetryableErrors = [
      'syntax error',
      'permission denied',
      'does not exist',
      'duplicate key',
      'unique constraint',
      'foreign key',
      'check constraint',
    ];

    return nonRetryableErrors.some(err => message.includes(err));
  }

  /**
   * PostgreSQL query execution
   */
  private async queryPostgres<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      const result = await client.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * SQLite query execution
   */
  private querySqlite<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.sqlite) {
      throw new Error('SQLite database not initialized');
    }

    try {
      // Determine query type
      const isSelect = sql.trim().toLowerCase().startsWith('select');
      const isInsert = sql.trim().toLowerCase().startsWith('insert');

      if (isSelect) {
        const stmt = this.sqlite.prepare(sql);
        const rows = params ? stmt.all(...params) : stmt.all();
        return Promise.resolve(rows as T[]);
      } else if (isInsert) {
        const stmt = this.sqlite.prepare(sql);
        const result = params ? stmt.run(...params) : stmt.run();
        return Promise.resolve([{ id: result.lastInsertRowid } as any]);
      } else {
        // UPDATE, DELETE, CREATE, etc.
        const stmt = this.sqlite.prepare(sql);
        params ? stmt.run(...params) : stmt.run();
        return Promise.resolve([]);
      }
    } catch (error) {
      console.error('SQLite query error:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   * Automatically commits on success, rolls back on error
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    if (this.dialect === 'postgres') {
      return this.transactionPostgres(callback);
    } else {
      return this.transactionSqlite(callback);
    }
  }

  /**
   * PostgreSQL transaction
   */
  private async transactionPostgres<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const tx: Transaction = {
        query: async <R = any>(sql: string, params?: any[]) => {
          const result = await client.query(sql, params);
          return result.rows as R[];
        },
      };

      const result = await callback(tx);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * SQLite transaction
   */
  private async transactionSqlite<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.sqlite) {
      throw new Error('SQLite database not initialized');
    }

    try {
      this.sqlite.exec('BEGIN TRANSACTION');

      const tx: Transaction = {
        query: async <R = any>(sql: string, params?: any[]) => {
          return this.querySqlite<R>(sql, params);
        },
      };

      const result = await callback(tx);

      this.sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Execute a single query (shorthand for query() with single result)
   */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Insert a record and return its ID
   */
  async insert<T = any>(table: string, data: Record<string, any>): Promise<string> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (this.dialect === 'postgres') {
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING id`;
      const result = await this.queryOne<{ id: string }>(sql, values);
      return result?.id || '';
    } else {
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      const result = await this.query(sql, values);
      return result[0]?.id?.toString() || '';
    }
  }

  /**
   * Update a record
   */
  async update(table: string, id: string, data: Record<string, any>): Promise<void> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (this.dialect === 'postgres') {
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      const sql = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`;
      await this.query(sql, [...values, id]);
    } else {
      const setClause = keys.map(key => `${key} = ?`).join(', ');
      const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
      await this.query(sql, [...values, id]);
    }
  }

  /**
   * Delete a record
   */
  async delete(table: string, id: string): Promise<void> {
    if (this.dialect === 'postgres') {
      await this.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    } else {
      await this.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    }
  }

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.dialect === 'postgres') {
        await this.query('SELECT 1');
      } else {
        await this.query('SELECT 1');
      }
      this.lastHealthCheck = new Date();
      this.healthCheckFailures = 0;
      return true;
    } catch (error) {
      this.healthCheckFailures++;
      console.error(`Database health check failed (${this.healthCheckFailures} consecutive failures):`, error);
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const interval = this.config.healthCheckInterval || 30000; // 30 seconds

    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.healthCheck();

      if (!healthy && this.healthCheckFailures >= 3) {
        console.error('⚠️  Database health checks failing consistently. Consider restarting the service.');
        this.metrics.connectionErrors++;
      }
    }, interval);

    console.log(`✅ Health checks started (interval: ${interval}ms)`);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('Health checks stopped');
    }
  }

  /**
   * Track active query
   */
  private trackQuery(id: string, sql: string, params?: any[]): void {
    this.activeQueries.set(id, {
      sql,
      startTime: Date.now(),
      params,
    });
  }

  /**
   * Release active query
   */
  private releaseQuery(id: string): void {
    this.activeQueries.delete(id);
  }

  /**
   * Start leak detection
   */
  private startLeakDetection(): void {
    const interval = this.config.leakDetectionInterval || 5 * 60 * 1000; // 5 minutes
    const threshold = this.config.leakThresholdMs || 60000; // 1 minute

    this.leakDetectionInterval = setInterval(() => {
      const now = Date.now();
      const leaks: Array<{ id: string; sql: string; duration: number }> = [];

      // Convert to array to avoid iterator issues
      Array.from(this.activeQueries.entries()).forEach(([id, query]) => {
        const duration = now - query.startTime;
        if (duration > threshold) {
          leaks.push({
            id,
            sql: query.sql.substring(0, 100),
            duration,
          });
        }
      });

      if (leaks.length > 0) {
        console.error(`⚠️  Potential connection leaks detected (${leaks.length} queries):`);
        leaks.forEach(leak => {
          console.error(`  - Query running for ${(leak.duration / 1000).toFixed(2)}s: ${leak.sql}`);
        });
      }
    }, interval);

    console.log(`✅ Leak detection started (interval: ${interval}ms, threshold: ${threshold}ms)`);
  }

  /**
   * Stop leak detection
   */
  private stopLeakDetection(): void {
    if (this.leakDetectionInterval) {
      clearInterval(this.leakDetectionInterval);
      this.leakDetectionInterval = undefined;
      console.log('Leak detection stopped');
    }
  }

  /**
   * Get database metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeQueries: this.activeQueries.size,
      lastHealthCheck: this.lastHealthCheck,
      healthCheckFailures: this.healthCheckFailures,
    };
  }

  /**
   * Get pool statistics (PostgreSQL only)
   */
  getPoolStats() {
    if (this.dialect === 'postgres' && this.pool) {
      return {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };
    }
    return null;
  }

  /**
   * Gracefully shutdown database connections
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;

    console.log('🔌 Closing database connections...');

    // Stop monitoring
    this.stopHealthChecks();
    this.stopLeakDetection();

    // Wait for active queries to complete (max 30s)
    const maxWaitTime = 30000;
    const startTime = Date.now();

    while (this.activeQueries.size > 0 && Date.now() - startTime < maxWaitTime) {
      console.log(`⏳ Waiting for ${this.activeQueries.size} active queries to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeQueries.size > 0) {
      console.warn(`⚠️  Forcefully closing with ${this.activeQueries.size} active queries remaining`);
    }

    // Close connections
    if (this.dialect === 'postgres' && this.pool) {
      await this.pool.end();
      console.log('✅ PostgreSQL pool closed');
    } else if (this.dialect === 'sqlite' && this.sqlite) {
      this.sqlite.close();
      console.log('✅ SQLite connection closed');
    }

    // Log final metrics
    console.log('📊 Final database metrics:', this.getMetrics());
  }

  /**
   * Handle process termination
   */
  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      await this.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

/**
 * Singleton instance (optional - can create multiple instances if needed)
 */
let instance: DatabaseService | null = null;

export function getDatabaseService(config?: DatabaseConfig): DatabaseService {
  if (!instance) {
    instance = new DatabaseService(config);
    instance.setupGracefulShutdown();
  }
  return instance;
}

/**
 * Create a new database service instance
 * Use this for testing or when you need multiple connections
 */
export function createDatabaseService(config?: DatabaseConfig): DatabaseService {
  return new DatabaseService(config);
}
