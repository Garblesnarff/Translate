/**
 * Neo4j Graph Database Client
 *
 * Provides a TypeScript interface for interacting with Neo4j graph database.
 * Implements connection pooling, transaction support, and health checks.
 *
 * Phase 4.1: Neo4j Setup - Tibetan Buddhist Knowledge Graph
 *
 * @author Knowledge Graph Team
 */

import neo4j, {
  Driver,
  Session,
  Transaction,
  Result,
  Integer,
  auth,
  Config,
  ManagedTransaction,
  Record as Neo4jRecord
} from 'neo4j-driver';

/**
 * Neo4j Client Configuration
 */
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
  maxTransactionRetryTime?: number;
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    logger?: (level: string, message: string) => void;
  };
}

/**
 * Query parameters type
 */
export type QueryParams = Record<string, any>;

/**
 * Transaction function type
 */
export type TransactionWork<T> = (tx: ManagedTransaction) => Promise<T>;

/**
 * Neo4j Client Statistics
 */
export interface Neo4jStats {
  connected: boolean;
  database: string;
  serverInfo?: {
    address: string;
    version: string;
    edition: string;
  };
  connectionPoolSize?: number;
  activeConnections?: number;
}

/**
 * Plugin Information
 */
export interface PluginInfo {
  name: string;
  version: string;
  installed: boolean;
}

/**
 * Neo4j Client for Tibetan Buddhist Knowledge Graph
 *
 * Features:
 * - Connection pooling with configurable limits
 * - Read/write transaction support
 * - Automatic retry on transient failures
 * - Health checks and monitoring
 * - Plugin verification (APOC, GDS)
 * - Graceful shutdown
 */
export class Neo4jClient {
  private driver: Driver | null = null;
  private config: Neo4jConfig;
  private isConnected = false;
  private readonly DEFAULT_DATABASE = 'neo4j';

  /**
   * Create a new Neo4j client instance
   */
  constructor(config: Neo4jConfig) {
    this.config = {
      database: config.database || this.DEFAULT_DATABASE,
      maxConnectionPoolSize: config.maxConnectionPoolSize || 100,
      connectionTimeout: config.connectionTimeout || 30000,
      maxTransactionRetryTime: config.maxTransactionRetryTime || 30000,
      ...config
    };
  }

  /**
   * Connect to Neo4j database
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.driver) {
      console.log('[Neo4j] Already connected');
      return;
    }

    try {
      console.log(`[Neo4j] Connecting to ${this.config.uri}...`);

      const driverConfig: Config = {
        maxConnectionPoolSize: this.config.maxConnectionPoolSize,
        connectionTimeout: this.config.connectionTimeout,
        maxTransactionRetryTime: this.config.maxTransactionRetryTime,
        logging: this.config.logging
          ? {
              level: this.config.logging.level,
              logger: this.config.logging.logger || console.log
            }
          : undefined
      };

      this.driver = neo4j.driver(
        this.config.uri,
        auth.basic(this.config.username, this.config.password),
        driverConfig
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();

      this.isConnected = true;
      console.log(`[Neo4j] Connected successfully to ${this.config.uri}`);

      // Log server info
      const serverInfo = await this.driver.getServerInfo();
      console.log(
        `[Neo4j] Server: ${serverInfo.address} (${serverInfo.agent})`
      );
    } catch (error) {
      this.isConnected = false;
      console.error('[Neo4j] Connection failed:', error);
      throw new Error(
        `Failed to connect to Neo4j at ${this.config.uri}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Disconnect from Neo4j database
   */
  async disconnect(): Promise<void> {
    if (!this.driver) {
      console.log('[Neo4j] No active connection to close');
      return;
    }

    try {
      console.log('[Neo4j] Disconnecting...');
      await this.driver.close();
      this.driver = null;
      this.isConnected = false;
      console.log('[Neo4j] Disconnected successfully');
    } catch (error) {
      console.error('[Neo4j] Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Check if client is connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected && this.driver !== null;
  }

  /**
   * Get driver instance (for advanced usage)
   */
  getDriver(): Driver {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver;
  }

  /**
   * Health check - verifies database connectivity and responsiveness
   */
  async healthCheck(): Promise<boolean> {
    if (!this.driver || !this.isConnected) {
      return false;
    }

    let session: Session | null = null;

    try {
      session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: "READ"
      });

      const result = await session.run('RETURN 1 AS health');
      const record = result.records[0];
      return record?.get('health')?.toNumber() === 1;
    } catch (error) {
      console.error('[Neo4j] Health check failed:', error);
      return false;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<Neo4jStats> {
    if (!this.driver) {
      return {
        connected: false,
        database: this.config.database || this.DEFAULT_DATABASE
      };
    }

    try {
      const serverInfo = await this.driver.getServerInfo();

      return {
        connected: this.isConnected,
        database: this.config.database || this.DEFAULT_DATABASE,
        serverInfo: {
          address: serverInfo.address || 'unknown',
          version: serverInfo.agent || 'unknown',
          edition: 'community' // Can be detected via query
        }
      };
    } catch (error) {
      console.error('[Neo4j] Failed to get stats:', error);
      return {
        connected: false,
        database: this.config.database || this.DEFAULT_DATABASE
      };
    }
  }

  /**
   * Execute a read-only query
   */
  async executeRead<T = any>(
    query: string,
    params: QueryParams = {}
  ): Promise<T[]> {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }

    let session: Session | null = null;

    try {
      session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: "READ"
      });

      const result = await session.run(query, params);
      return result.records.map((record) => this.recordToObject<T>(record));
    } catch (error) {
      console.error('[Neo4j] Read query failed:', error);
      console.error('[Neo4j] Query:', query);
      console.error('[Neo4j] Params:', params);
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Execute a write query
   */
  async executeWrite<T = any>(
    query: string,
    params: QueryParams = {}
  ): Promise<T[]> {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }

    let session: Session | null = null;

    try {
      session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: "WRITE"
      });

      const result = await session.run(query, params);
      return result.records.map((record) => this.recordToObject<T>(record));
    } catch (error) {
      console.error('[Neo4j] Write query failed:', error);
      console.error('[Neo4j] Query:', query);
      console.error('[Neo4j] Params:', params);
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Execute query with explicit read transaction
   */
  async withReadTransaction<T>(work: TransactionWork<T>): Promise<T> {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }

    let session: Session | null = null;

    try {
      session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: "READ"
      });

      return await session.executeRead(work);
    } catch (error) {
      console.error('[Neo4j] Read transaction failed:', error);
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Execute query with explicit write transaction
   */
  async withWriteTransaction<T>(work: TransactionWork<T>): Promise<T> {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }

    let session: Session | null = null;

    try {
      session = this.driver.session({
        database: this.config.database,
        defaultAccessMode: "WRITE"
      });

      return await session.executeWrite(work);
    } catch (error) {
      console.error('[Neo4j] Write transaction failed:', error);
      throw error;
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  /**
   * Verify APOC plugin is installed and available
   */
  async verifyApocPlugin(): Promise<PluginInfo> {
    try {
      const result = await this.executeRead<{ version: string }>(
        'RETURN apoc.version() AS version'
      );

      if (result.length > 0 && result[0].version) {
        return {
          name: 'APOC',
          version: result[0].version,
          installed: true
        };
      }

      return {
        name: 'APOC',
        version: 'unknown',
        installed: false
      };
    } catch (error) {
      console.warn('[Neo4j] APOC plugin not available:', error);
      return {
        name: 'APOC',
        version: 'not installed',
        installed: false
      };
    }
  }

  /**
   * Verify Graph Data Science (GDS) plugin is installed
   */
  async verifyGdsPlugin(): Promise<PluginInfo> {
    try {
      const result = await this.executeRead<{ version: string }>(
        'RETURN gds.version() AS version'
      );

      if (result.length > 0 && result[0].version) {
        return {
          name: 'GDS',
          version: result[0].version,
          installed: true
        };
      }

      return {
        name: 'GDS',
        version: 'unknown',
        installed: false
      };
    } catch (error) {
      console.warn('[Neo4j] GDS plugin not available:', error);
      return {
        name: 'GDS',
        version: 'not installed',
        installed: false
      };
    }
  }

  /**
   * Verify all required plugins
   */
  async verifyPlugins(): Promise<{ apoc: PluginInfo; gds: PluginInfo }> {
    const [apoc, gds] = await Promise.all([
      this.verifyApocPlugin(),
      this.verifyGdsPlugin()
    ]);

    return { apoc, gds };
  }

  /**
   * Convert Neo4j Record to plain JavaScript object
   */
  private recordToObject<T>(record: Neo4jRecord): T {
    const obj: any = {};

    record.keys.forEach((key) => {
      const value = record.get(key);
      obj[key] = this.convertValue(value);
    });

    return obj as T;
  }

  /**
   * Convert Neo4j values to JavaScript primitives
   */
  private convertValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Neo4j Integer type
    if (neo4j.isInt(value)) {
      return value.toNumber();
    }

    // Handle Neo4j Date/Time types
    if (value instanceof neo4j.types.DateTime) {
      return value.toString();
    }

    if (value instanceof neo4j.types.Date) {
      return value.toString();
    }

    if (value instanceof neo4j.types.Time) {
      return value.toString();
    }

    if (value instanceof neo4j.types.LocalTime) {
      return value.toString();
    }

    if (value instanceof neo4j.types.Duration) {
      return value.toString();
    }

    // Handle Node
    if (value.labels && value.properties) {
      return {
        id: this.convertValue(value.identity),
        labels: value.labels,
        properties: this.convertProperties(value.properties)
      };
    }

    // Handle Relationship
    if (value.type && value.properties && value.start && value.end) {
      return {
        id: this.convertValue(value.identity),
        type: value.type,
        startNodeId: this.convertValue(value.start),
        endNodeId: this.convertValue(value.end),
        properties: this.convertProperties(value.properties)
      };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.convertValue(item));
    }

    // Handle objects
    if (typeof value === 'object') {
      return this.convertProperties(value);
    }

    return value;
  }

  /**
   * Convert object properties recursively
   */
  private convertProperties(props: any): any {
    if (!props) return props;

    const converted: any = {};

    for (const [key, value] of Object.entries(props)) {
      converted[key] = this.convertValue(value);
    }

    return converted;
  }

  /**
   * Clear all data from database (USE WITH CAUTION)
   * Only for development/testing
   */
  async clearDatabase(): Promise<void> {
    console.warn('[Neo4j] CLEARING ALL DATABASE DATA - USE WITH CAUTION');

    await this.executeWrite(
      `
      MATCH (n)
      DETACH DELETE n
      `
    );

    console.log('[Neo4j] Database cleared');
  }
}

/**
 * Singleton instance of Neo4j client
 */
let neo4jClientInstance: Neo4jClient | null = null;

/**
 * Get or create Neo4j client singleton
 */
export function getNeo4jClient(config?: Neo4jConfig): Neo4jClient {
  if (!neo4jClientInstance) {
    if (!config) {
      // Try to get config from environment variables
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const username = process.env.NEO4J_USERNAME || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'neo4j';
      const database = process.env.NEO4J_DATABASE || 'neo4j';

      config = { uri, username, password, database };
    }

    neo4jClientInstance = new Neo4jClient(config);
  }

  return neo4jClientInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetNeo4jClient(): void {
  neo4jClientInstance = null;
}

// Export Neo4j types for convenience
export { Integer, Session, Transaction, Result };
