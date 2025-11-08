/**
 * Sync Configuration
 *
 * Configuration settings for PostgreSQL ↔ Neo4j synchronization
 *
 * Phase 4, Task 4.3: Sync Service
 */

export interface SyncConfiguration {
  // Batch settings
  batchSize: number; // Entities per batch
  maxRetries: number; // Max retry attempts for failed operations
  retryDelayMs: number; // Initial retry delay (exponential backoff)

  // Auto-sync settings
  autoSyncEnabled: boolean; // Enable automatic sync on entity/relationship changes
  incrementalSyncIntervalMs: number; // Interval for incremental sync (ms)

  // Scheduling (cron format)
  fullSyncSchedule: string | null; // e.g., '0 2 * * *' for 2 AM daily
  consistencyCheckSchedule: string | null; // e.g., '0 3 * * 0' for 3 AM every Sunday

  // Performance
  maxConcurrentBatches: number; // Max concurrent batch operations
  connectionPoolSize: number; // Neo4j connection pool size

  // Consistency
  enableConsistencyChecks: boolean; // Run periodic consistency checks
  consistencyCheckSampleSize: number; // Number of entities to sample for property checks

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logSyncOperations: boolean; // Log individual sync operations
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultSyncConfig: SyncConfiguration = {
  // Batch settings
  batchSize: 500,
  maxRetries: 3,
  retryDelayMs: 1000,

  // Auto-sync settings
  autoSyncEnabled: true,
  incrementalSyncIntervalMs: 5 * 60 * 1000, // 5 minutes

  // Scheduling
  fullSyncSchedule: '0 2 * * *', // 2 AM daily
  consistencyCheckSchedule: '0 3 * * 0', // 3 AM every Sunday

  // Performance
  maxConcurrentBatches: 5,
  connectionPoolSize: 100,

  // Consistency
  enableConsistencyChecks: true,
  consistencyCheckSampleSize: 100,

  // Logging
  logLevel: 'info',
  logSyncOperations: true
};

// ============================================================================
// Environment-based Configuration
// ============================================================================

/**
 * Load sync configuration from environment variables or use defaults
 */
export function loadSyncConfig(): SyncConfiguration {
  return {
    // Batch settings
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || String(defaultSyncConfig.batchSize)),
    maxRetries: parseInt(process.env.SYNC_MAX_RETRIES || String(defaultSyncConfig.maxRetries)),
    retryDelayMs: parseInt(process.env.SYNC_RETRY_DELAY_MS || String(defaultSyncConfig.retryDelayMs)),

    // Auto-sync settings
    autoSyncEnabled: process.env.SYNC_AUTO_ENABLED === 'true' || defaultSyncConfig.autoSyncEnabled,
    incrementalSyncIntervalMs: parseInt(
      process.env.SYNC_INCREMENTAL_INTERVAL_MS || String(defaultSyncConfig.incrementalSyncIntervalMs)
    ),

    // Scheduling
    fullSyncSchedule: process.env.SYNC_FULL_SCHEDULE || defaultSyncConfig.fullSyncSchedule,
    consistencyCheckSchedule: process.env.SYNC_CONSISTENCY_SCHEDULE || defaultSyncConfig.consistencyCheckSchedule,

    // Performance
    maxConcurrentBatches: parseInt(
      process.env.SYNC_MAX_CONCURRENT_BATCHES || String(defaultSyncConfig.maxConcurrentBatches)
    ),
    connectionPoolSize: parseInt(
      process.env.NEO4J_POOL_SIZE || String(defaultSyncConfig.connectionPoolSize)
    ),

    // Consistency
    enableConsistencyChecks: process.env.SYNC_CONSISTENCY_CHECKS !== 'false',
    consistencyCheckSampleSize: parseInt(
      process.env.SYNC_CONSISTENCY_SAMPLE_SIZE || String(defaultSyncConfig.consistencyCheckSampleSize)
    ),

    // Logging
    logLevel: (process.env.SYNC_LOG_LEVEL as any) || defaultSyncConfig.logLevel,
    logSyncOperations: process.env.SYNC_LOG_OPERATIONS !== 'false'
  };
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validate sync configuration
 */
export function validateSyncConfig(config: SyncConfiguration): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate batch size
  if (config.batchSize < 1 || config.batchSize > 10000) {
    errors.push('batchSize must be between 1 and 10000');
  }

  // Validate max retries
  if (config.maxRetries < 0 || config.maxRetries > 10) {
    errors.push('maxRetries must be between 0 and 10');
  }

  // Validate retry delay
  if (config.retryDelayMs < 100 || config.retryDelayMs > 60000) {
    errors.push('retryDelayMs must be between 100 and 60000');
  }

  // Validate incremental sync interval
  if (config.incrementalSyncIntervalMs < 60000) {
    errors.push('incrementalSyncIntervalMs must be at least 60000 (1 minute)');
  }

  // Validate max concurrent batches
  if (config.maxConcurrentBatches < 1 || config.maxConcurrentBatches > 20) {
    errors.push('maxConcurrentBatches must be between 1 and 20');
  }

  // Validate connection pool size
  if (config.connectionPoolSize < 10 || config.connectionPoolSize > 1000) {
    errors.push('connectionPoolSize must be between 10 and 1000');
  }

  // Validate sample size
  if (config.consistencyCheckSampleSize < 0 || config.consistencyCheckSampleSize > 10000) {
    errors.push('consistencyCheckSampleSize must be between 0 and 10000');
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];

  if (!validLogLevels.includes(config.logLevel)) {
    errors.push(`logLevel must be one of: ${validLogLevels.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Export Singleton
// ============================================================================

let configInstance: SyncConfiguration | null = null;

/**
 * Get sync configuration (singleton)
 */
export function getSyncConfig(): SyncConfiguration {
  if (!configInstance) {
    configInstance = loadSyncConfig();

    const validation = validateSyncConfig(configInstance);

    if (!validation.valid) {
      console.warn('[SyncConfig] Configuration validation warnings:');
      validation.errors.forEach(error => console.warn(`  - ${error}`));
    }
  }

  return configInstance;
}

/**
 * Update sync configuration
 */
export function updateSyncConfig(updates: Partial<SyncConfiguration>): SyncConfiguration {
  if (!configInstance) {
    configInstance = loadSyncConfig();
  }

  configInstance = {
    ...configInstance,
    ...updates
  };

  const validation = validateSyncConfig(configInstance);

  if (!validation.valid) {
    console.warn('[SyncConfig] Updated configuration has validation warnings:');
    validation.errors.forEach(error => console.warn(`  - ${error}`));
  }

  return configInstance;
}

/**
 * Reset configuration to defaults (for testing)
 */
export function resetSyncConfig(): void {
  configInstance = null;
}
