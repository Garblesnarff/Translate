/**
 * ConfigService - Centralized Configuration Management
 *
 * This service provides a unified, validated configuration system that:
 * - Loads configuration from files (JSON) or environment variables
 * - Validates all configuration using Zod schemas
 * - Provides type-safe access to configuration sections
 * - Supports environment-specific configs (dev, prod, test)
 * - Optionally supports hot-reloading of configuration
 *
 * Usage:
 *   // Load from environment variables
 *   const config = ConfigService.load(process.env);
 *
 *   // Load from file
 *   const config = ConfigService.loadFromFile('./config/production.json');
 *
 *   // Access configuration
 *   const dbConfig = config.database();
 *   const translationConfig = config.translation();
 */

import { z } from 'zod';
import { readFileSync, watchFile } from 'fs';
import { join } from 'path';
import type {
  AppConfig,
  TranslationConfigExtended as TranslationConfig,
  DatabaseConfigExtended as DatabaseConfig,
  CacheConfigExtended as CacheConfig,
  MonitoringConfigExtended as MonitoringConfig,
  ServerConfig,
  ValidationResult,
  ErrorCode,
} from '../../shared/types.js';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Translation provider schema
 */
const TranslationProviderSchema = z.enum([
  'gemini',
  'openai',
  'anthropic',
  'groq',
  'openrouter',
  'cerebras',
]);

/**
 * Model configuration schema
 */
const ModelConfigSchema = z.object({
  provider: TranslationProviderSchema,
  model: z.string().min(1, 'Model name is required'),
  apiKey: z.string().min(1, 'API key is required'),
  priority: z.number().int().min(0, 'Priority must be non-negative'),
  maxTokens: z.number().int().min(100).max(100000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * Retry configuration schema
 */
const RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(0).max(10).default(3),
  baseDelay: z.number().int().min(100).default(1000),
  maxDelay: z.number().int().min(1000).default(60000),
  exponentialBackoff: z.boolean().default(true),
});

/**
 * Translation configuration schema
 */
const TranslationConfigSchema = z.object({
  models: z.array(ModelConfigSchema).min(1, 'At least one model is required'),
  maxTokens: z.number().int().min(100).max(100000).default(4000),
  temperature: z.number().min(0).max(2).default(0.3),
  qualityThreshold: z.number().min(0).max(1).default(0.7),
  enableParallel: z.boolean().default(true),
  maxParallelRequests: z.number().int().min(1).max(20).default(5),
  retry: RetryConfigSchema,
});

/**
 * Database configuration schema
 */
const DatabaseConfigSchema = z.object({
  url: z.string().min(1, 'Database URL is required'),
  type: z.enum(['postgresql', 'sqlite']).default('sqlite'),
  maxConnections: z.number().int().min(1).max(100).default(20),
  ssl: z.boolean().default(false),
  connectionTimeout: z.number().int().min(1000).default(5000),
  enableLogging: z.boolean().default(false),
});

/**
 * Cache configuration schema
 */
const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(['memory', 'redis']).default('memory'),
  maxSize: z.number().int().min(100).default(1000),
  defaultTTL: z.number().int().min(60).default(3600),
  redisUrl: z.string().optional(),
});

/**
 * Monitoring configuration schema
 */
const MonitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  metricsInterval: z.number().int().min(1000).default(30000),
  enablePerformance: z.boolean().default(true),
  enableQuality: z.boolean().default(true),
  enableErrors: z.boolean().default(true),
  bufferSize: z.number().int().min(10).max(1000).default(100),
});

/**
 * Server configuration schema
 */
const ServerConfigSchema = z.object({
  port: z.number().int().min(1000).max(65535).default(5001),
  environment: z.enum(['development', 'production', 'test']).default('development'),
  enableCors: z.boolean().default(true),
  enableLogging: z.boolean().default(true),
  requestTimeout: z.number().int().min(1000).default(120000),
  maxBodySize: z.string().default('50mb'),
});

/**
 * Complete application configuration schema
 */
const AppConfigSchema = z.object({
  server: ServerConfigSchema,
  translation: TranslationConfigSchema,
  database: DatabaseConfigSchema,
  cache: CacheConfigSchema,
  monitoring: MonitoringConfigSchema,
});

// ============================================================================
// ConfigService Class
// ============================================================================

/**
 * Centralized configuration service with validation and hot-reloading
 */
export class ConfigService {
  private config: AppConfig;
  private configPath?: string;
  private watchCallback?: (newConfig: AppConfig) => void;

  /**
   * Private constructor - use static factory methods
   */
  private constructor(config: AppConfig, configPath?: string) {
    this.config = config;
    this.configPath = configPath;
  }

  /**
   * Load configuration from environment variables
   *
   * @param env - Process environment variables (process.env)
   * @returns Validated ConfigService instance
   * @throws Error if validation fails
   */
  static load(env: NodeJS.ProcessEnv): ConfigService {
    const rawConfig = ConfigService.buildConfigFromEnv(env);
    const validatedConfig = ConfigService.validateConfig(rawConfig as any);
    return new ConfigService(validatedConfig);
  }

  /**
   * Load configuration from JSON file
   *
   * @param path - Path to configuration file (absolute or relative)
   * @returns Validated ConfigService instance
   * @throws Error if file not found or validation fails
   */
  static loadFromFile(path: string): ConfigService {
    try {
      const absolutePath = path.startsWith('/') ? path : join(process.cwd(), path);
      const fileContent = readFileSync(absolutePath, 'utf-8');
      const rawConfig = JSON.parse(fileContent);
      const validatedConfig = ConfigService.validateConfig(rawConfig);
      return new ConfigService(validatedConfig, absolutePath);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load configuration with environment-specific defaults
   *
   * @param env - Process environment variables
   * @returns Validated ConfigService instance with environment-specific defaults
   */
  static loadWithDefaults(env: NodeJS.ProcessEnv): ConfigService {
    const environment = env.NODE_ENV || 'development';
    const configDir = join(process.cwd(), 'config');

    // Try to load environment-specific config
    let config: AppConfig;
    try {
      const envConfigPath = join(configDir, `${environment}.json`);
      const envConfig = JSON.parse(readFileSync(envConfigPath, 'utf-8'));

      // Merge with defaults
      const defaultsPath = join(configDir, 'defaults.json');
      const defaults = JSON.parse(readFileSync(defaultsPath, 'utf-8'));

      config = ConfigService.mergeConfigs(defaults, envConfig);
    } catch (error) {
      // Fallback to environment variables
      console.warn(`Could not load config file, using environment variables: ${error}`);
      config = ConfigService.buildConfigFromEnv(env) as any;
    }

    // Override with environment variables
    const envOverrides = ConfigService.buildConfigFromEnv(env);
    const finalConfig = ConfigService.mergeConfigs(config, envOverrides);

    return new ConfigService(ConfigService.validateConfig(finalConfig as any));
  }

  /**
   * Get server configuration
   */
  get server(): ServerConfig {
    return this.config.server;
  }

  /**
   * Get translation configuration
   */
  get translation(): TranslationConfig {
    return this.config.translation;
  }

  /**
   * Get database configuration
   */
  get database(): DatabaseConfig {
    return this.config.database;
  }

  /**
   * Get cache configuration
   */
  get cache(): CacheConfig {
    return this.config.cache;
  }

  /**
   * Get monitoring configuration
   */
  get monitoring(): MonitoringConfig {
    return this.config.monitoring;
  }

  /**
   * Get complete configuration
   */
  get all(): AppConfig {
    return this.config;
  }

  /**
   * Validate current configuration
   *
   * @returns Validation result with errors/warnings
   */
  validate(): ValidationResult {
    try {
      AppConfigSchema.parse(this.config);
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          warnings: [],
        };
      }
      return {
        isValid: false,
        errors: [String(error)],
        warnings: [],
      };
    }
  }

  /**
   * Enable hot-reloading of configuration file
   *
   * @param callback - Function to call when config changes
   * @throws Error if no config file path is set
   */
  watch(callback: (newConfig: AppConfig) => void): void {
    if (!this.configPath) {
      throw new Error('Cannot watch config: no file path set. Use loadFromFile() first.');
    }

    this.watchCallback = callback;

    watchFile(this.configPath, { interval: 2000 }, () => {
      try {
        console.log(`Config file changed, reloading: ${this.configPath}`);
        const fileContent = readFileSync(this.configPath!, 'utf-8');
        const rawConfig = JSON.parse(fileContent);
        const newConfig = ConfigService.validateConfig(rawConfig);

        this.config = newConfig;

        if (this.watchCallback) {
          this.watchCallback(newConfig);
        }
      } catch (error) {
        console.error(`Failed to reload config: ${error}`);
      }
    });

    console.log(`Watching config file for changes: ${this.configPath}`);
  }

  /**
   * Stop watching config file
   */
  unwatch(): void {
    if (this.configPath) {
      const { unwatchFile } = require('fs');
      unwatchFile(this.configPath);
      this.watchCallback = undefined;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build configuration from environment variables
   */
  private static buildConfigFromEnv(env: NodeJS.ProcessEnv): Partial<AppConfig> {
    const models: any[] = [];

    // Gemini models (primary)
    if (env.GEMINI_API_KEY_ODD) {
      models.push({
        provider: 'gemini' as const,
        model: env.GEMINI_MODEL_ODD || 'gemini-2.0-flash',
        apiKey: env.GEMINI_API_KEY_ODD,
        priority: 0,
      });
    }
    if (env.GEMINI_API_KEY_EVEN) {
      models.push({
        provider: 'gemini' as const,
        model: env.GEMINI_MODEL_EVEN || 'gemini-2.0-flash',
        apiKey: env.GEMINI_API_KEY_EVEN,
        priority: 1,
      });
    }

    // Optional providers
    if (env.GROQ_API_KEY) {
      models.push({
        provider: 'groq' as const,
        model: env.GROQ_MODEL || 'deepseek-r1-distill-llama-70b',
        apiKey: env.GROQ_API_KEY,
        priority: 2,
      });
    }
    if (env.OPENROUTER_API_KEY) {
      models.push({
        provider: 'openrouter' as const,
        model: env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free',
        apiKey: env.OPENROUTER_API_KEY,
        priority: 3,
      });
    }
    if (env.CEREBRAS_API_KEY) {
      models.push({
        provider: 'cerebras' as const,
        model: env.CEREBRAS_MODEL || 'llama3.1-70b',
        apiKey: env.CEREBRAS_API_KEY,
        priority: 4,
      });
    }

    // Database URL
    const databaseUrl = env.DATABASE_URL || 'sqlite://tibetan_translation.db';
    const databaseType = databaseUrl.startsWith('postgresql') ? 'postgresql' : 'sqlite';

    return {
      server: {
        port: env.PORT ? parseInt(env.PORT) : 5001,
        environment: (env.NODE_ENV as any) || 'development',
        enableCors: env.ENABLE_CORS !== 'false',
        enableLogging: env.ENABLE_LOGGING !== 'false',
        requestTimeout: env.REQUEST_TIMEOUT ? parseInt(env.REQUEST_TIMEOUT) : 120000,
        maxBodySize: env.MAX_BODY_SIZE || '50mb',
      },
      translation: {
        models,
        maxTokens: env.MAX_TOKENS ? parseInt(env.MAX_TOKENS) : 4000,
        temperature: env.TEMPERATURE ? parseFloat(env.TEMPERATURE) : 0.3,
        qualityThreshold: env.QUALITY_THRESHOLD ? parseFloat(env.QUALITY_THRESHOLD) : 0.7,
        enableParallel: env.ENABLE_PARALLEL !== 'false',
        maxParallelRequests: env.MAX_PARALLEL_REQUESTS ? parseInt(env.MAX_PARALLEL_REQUESTS) : 5,
        retry: {
          maxRetries: env.MAX_RETRIES ? parseInt(env.MAX_RETRIES) : 3,
          baseDelay: env.RETRY_BASE_DELAY ? parseInt(env.RETRY_BASE_DELAY) : 1000,
          maxDelay: env.RETRY_MAX_DELAY ? parseInt(env.RETRY_MAX_DELAY) : 60000,
          exponentialBackoff: env.EXPONENTIAL_BACKOFF !== 'false',
        },
      },
      database: {
        url: databaseUrl,
        type: databaseType,
        maxConnections: env.DB_MAX_CONNECTIONS ? parseInt(env.DB_MAX_CONNECTIONS) : 20,
        ssl: env.DB_SSL === 'true',
        connectionTimeout: env.DB_CONNECTION_TIMEOUT ? parseInt(env.DB_CONNECTION_TIMEOUT) : 5000,
        enableLogging: env.DB_LOGGING === 'true',
      },
      cache: {
        enabled: env.CACHE_ENABLED !== 'false',
        type: (env.CACHE_TYPE as any) || 'memory',
        maxSize: env.CACHE_MAX_SIZE ? parseInt(env.CACHE_MAX_SIZE) : 1000,
        defaultTTL: env.CACHE_DEFAULT_TTL ? parseInt(env.CACHE_DEFAULT_TTL) : 3600,
        redisUrl: env.REDIS_URL,
      },
      monitoring: {
        enabled: env.MONITORING_ENABLED !== 'false',
        metricsInterval: env.METRICS_INTERVAL ? parseInt(env.METRICS_INTERVAL) : 30000,
        enablePerformance: env.ENABLE_PERFORMANCE_TRACKING !== 'false',
        enableQuality: env.ENABLE_QUALITY_TRACKING !== 'false',
        enableErrors: env.ENABLE_ERROR_TRACKING !== 'false',
        bufferSize: env.METRICS_BUFFER_SIZE ? parseInt(env.METRICS_BUFFER_SIZE) : 100,
      },
    } as Partial<AppConfig>;
  }

  /**
   * Validate configuration against schema
   */
  private static validateConfig(config: any): AppConfig {
    try {
      return AppConfigSchema.parse(config) as AppConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
        throw new Error(`Configuration validation failed:\n${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private static mergeConfigs(base: any, override: any): any {
    const result = { ...base };

    for (const key in override) {
      if (override[key] !== undefined) {
        if (typeof override[key] === 'object' && !Array.isArray(override[key]) && override[key] !== null) {
          result[key] = ConfigService.mergeConfigs(base[key] || {}, override[key]);
        } else {
          result[key] = override[key];
        }
      }
    }

    return result;
  }
}

// ============================================================================
// Singleton Instance (Optional)
// ============================================================================

let globalConfig: ConfigService | null = null;

/**
 * Get global configuration instance (singleton)
 * Initializes from environment if not already loaded
 */
export function getConfig(): ConfigService {
  if (!globalConfig) {
    globalConfig = ConfigService.loadWithDefaults(process.env);
  }
  return globalConfig;
}

/**
 * Set global configuration instance
 */
export function setConfig(config: ConfigService): void {
  globalConfig = config;
}

/**
 * Reset global configuration (useful for testing)
 */
export function resetConfig(): void {
  if (globalConfig) {
    globalConfig.unwatch();
  }
  globalConfig = null;
}
