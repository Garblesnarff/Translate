# Configuration System Documentation

## Overview

The Tibetan Translation Tool uses a centralized, validated configuration system built on:

- **Type Safety**: Full TypeScript type definitions
- **Validation**: Zod schemas ensure configuration correctness
- **Environment Support**: Separate configs for development, production, and test
- **Flexibility**: Load from files or environment variables
- **Hot Reloading**: Optional config updates without server restart

## Configuration Files

### File Structure

```
config/
├── defaults.json       # Base configuration with sensible defaults
├── development.json    # Development-specific overrides
├── production.json     # Production-specific overrides
└── test.json          # Test-specific overrides
```

### Loading Priority

Configuration is loaded and merged in this order (later overrides earlier):

1. **defaults.json** - Base configuration
2. **{environment}.json** - Environment-specific config (e.g., production.json)
3. **Environment variables** - Highest priority overrides

## Usage Examples

### Basic Usage (Environment Variables)

The simplest way to use the config system - loads from `process.env`:

```typescript
import { ConfigService } from './server/core/config.js';

// Load from environment variables
const config = ConfigService.load(process.env);

// Access configuration sections
const dbConfig = config.database;
console.log(`Database: ${dbConfig.type} at ${dbConfig.url}`);

const translationConfig = config.translation;
console.log(`Using ${translationConfig.models.length} translation models`);
```

### Load from File

Load configuration from a specific JSON file:

```typescript
import { ConfigService } from './server/core/config.js';

// Load from specific file
const config = ConfigService.loadFromFile('./config/production.json');

// Access server config
console.log(`Server running on port ${config.server.port}`);
```

### Load with Defaults (Recommended)

Load with automatic environment detection and defaults:

```typescript
import { ConfigService } from './server/core/config.js';

// Automatically loads:
// 1. defaults.json
// 2. {NODE_ENV}.json (e.g., development.json)
// 3. Environment variable overrides
const config = ConfigService.loadWithDefaults(process.env);

// All configuration is now available
const cacheConfig = config.cache;
const monitoringConfig = config.monitoring;
```

### Using Global Singleton

For convenience, use the global configuration instance:

```typescript
import { getConfig } from './server/core/config.js';

// Gets or creates global config instance
const config = getConfig();

// Access anywhere in your application
const translationConfig = config.translation;
```

### Configuration Validation

Validate configuration at any time:

```typescript
const config = ConfigService.load(process.env);

// Validate current configuration
const validation = config.validate();

if (!validation.isValid) {
  console.error('Configuration errors:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

console.log('Configuration is valid!');
```

### Hot Reloading

Enable automatic config reloading when file changes:

```typescript
const config = ConfigService.loadFromFile('./config/development.json');

// Watch for changes
config.watch((newConfig) => {
  console.log('Configuration updated!');
  console.log(`New quality threshold: ${newConfig.translation.qualityThreshold}`);

  // Update services with new config
  translationService.updateConfig(newConfig.translation);
});

// Later: stop watching
config.unwatch();
```

## Configuration Sections

### Server Configuration

Controls server behavior:

```typescript
interface ServerConfig {
  port: number;                    // Server port (default: 5001)
  environment: 'development' | 'production' | 'test';
  enableCors: boolean;             // Enable CORS (default: true)
  enableLogging: boolean;          // Enable request logging
  requestTimeout: number;          // Request timeout in ms
  maxBodySize: string;             // Max request body size (e.g., "50mb")
}
```

**Environment Variables:**
- `PORT` - Server port
- `NODE_ENV` - Environment (development/production/test)
- `ENABLE_CORS` - Enable CORS (true/false)
- `ENABLE_LOGGING` - Enable logging (true/false)
- `REQUEST_TIMEOUT` - Timeout in milliseconds
- `MAX_BODY_SIZE` - Max body size (e.g., "50mb")

### Translation Configuration

Controls translation behavior:

```typescript
interface TranslationConfig {
  models: ModelConfig[];           // List of AI models
  maxTokens: number;               // Max tokens per request
  temperature: number;             // Generation temperature (0-2)
  qualityThreshold: number;        // Quality threshold (0-1)
  enableParallel: boolean;         // Enable parallel processing
  maxParallelRequests: number;     // Max parallel requests
  retry: RetryConfig;              // Retry configuration
}
```

**Environment Variables:**
- `GEMINI_API_KEY_ODD` - Gemini API key for odd pages
- `GEMINI_API_KEY_EVEN` - Gemini API key for even pages
- `GROQ_API_KEY` - Groq API key (optional)
- `OPENROUTER_API_KEY` - OpenRouter API key (optional)
- `CEREBRAS_API_KEY` - Cerebras API key (optional)
- `MAX_TOKENS` - Maximum tokens per request
- `TEMPERATURE` - Generation temperature
- `QUALITY_THRESHOLD` - Quality threshold (0-1)
- `ENABLE_PARALLEL` - Enable parallel processing
- `MAX_PARALLEL_REQUESTS` - Max parallel requests
- `MAX_RETRIES` - Maximum retry attempts

### Database Configuration

Controls database connection:

```typescript
interface DatabaseConfig {
  url: string;                     // Database URL
  type: 'postgresql' | 'sqlite';   // Database type
  maxConnections: number;          // Max connection pool size
  ssl: boolean;                    // Enable SSL
  connectionTimeout: number;       // Connection timeout (ms)
  enableLogging: boolean;          // Enable SQL logging
}
```

**Environment Variables:**
- `DATABASE_URL` - Database connection URL
  - PostgreSQL: `postgresql://user:pass@host:5432/db`
  - SQLite: `sqlite://path/to/file.db`
- `DB_MAX_CONNECTIONS` - Max connections
- `DB_SSL` - Enable SSL (true/false)
- `DB_CONNECTION_TIMEOUT` - Connection timeout (ms)
- `DB_LOGGING` - Enable SQL logging (true/false)

### Cache Configuration

Controls caching behavior:

```typescript
interface CacheConfig {
  enabled: boolean;                // Enable caching
  type: 'memory' | 'redis';        // Cache type
  maxSize: number;                 // Max cache entries
  defaultTTL: number;              // Default TTL in seconds
  redisUrl?: string;               // Redis URL (if type is 'redis')
}
```

**Environment Variables:**
- `CACHE_ENABLED` - Enable cache (true/false)
- `CACHE_TYPE` - Cache type (memory/redis)
- `CACHE_MAX_SIZE` - Max cache entries
- `CACHE_DEFAULT_TTL` - Default TTL in seconds
- `REDIS_URL` - Redis connection URL

### Monitoring Configuration

Controls metrics and monitoring:

```typescript
interface MonitoringConfig {
  enabled: boolean;                // Enable monitoring
  metricsInterval: number;         // Metrics collection interval (ms)
  enablePerformance: boolean;      // Track performance metrics
  enableQuality: boolean;          // Track quality metrics
  enableErrors: boolean;           // Track error metrics
  bufferSize: number;              // Metrics buffer size
}
```

**Environment Variables:**
- `MONITORING_ENABLED` - Enable monitoring
- `METRICS_INTERVAL` - Collection interval (ms)
- `ENABLE_PERFORMANCE_TRACKING` - Track performance
- `ENABLE_QUALITY_TRACKING` - Track quality
- `ENABLE_ERROR_TRACKING` - Track errors
- `METRICS_BUFFER_SIZE` - Buffer size

## Environment-Specific Configurations

### Development (`config/development.json`)

Optimized for local development:
- Verbose logging enabled
- Lower quality threshold (0.6) to see more results
- Smaller cache (500 entries) for fresh results
- SQLite database for simplicity
- Shorter TTLs (30 minutes)
- More frequent metrics (1 minute)

### Production (`config/production.json`)

Optimized for production deployment:
- Minimal logging
- Higher quality threshold (0.75) for reliability
- Larger cache (5000 entries)
- PostgreSQL database with SSL
- Longer TTLs (2 hours)
- More retries (5) for reliability
- Higher parallel requests (10) for throughput

### Test (`config/test.json`)

Optimized for automated testing:
- No logging (clean test output)
- In-memory SQLite database
- Deterministic settings (temperature = 0.0)
- Minimal retries for fast failures
- Monitoring disabled
- Sequential processing (no parallelism)

## Validation

All configuration is validated using Zod schemas. Invalid configuration will throw descriptive errors:

```typescript
try {
  const config = ConfigService.load(process.env);
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  // Error includes specific field errors:
  // Configuration validation failed:
  //   - translation.maxTokens: Number must be greater than or equal to 100
  //   - database.url: Database URL is required
}
```

## Best Practices

### 1. Use Environment Variables for Secrets

Never commit API keys or sensitive data to config files:

```json
{
  "translation": {
    "models": [
      {
        "apiKey": "REQUIRED_FROM_ENV"
      }
    ]
  }
}
```

Load from environment:
```bash
export GEMINI_API_KEY_ODD=your_actual_key
```

### 2. Validate on Startup

Always validate configuration when starting your application:

```typescript
const config = ConfigService.loadWithDefaults(process.env);
const validation = config.validate();

if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  process.exit(1);
}
```

### 3. Use Type-Safe Access

Access config through typed getters:

```typescript
// Good: Type-safe access
const dbUrl = config.database.url;

// Avoid: Direct object access
const dbUrl = config.all.database.url;
```

### 4. Keep Environment Files Organized

```
.env                  # Local development (gitignored)
.env.example          # Template for .env
config/development.json
config/production.json
config/test.json
```

### 5. Document Custom Settings

Add comments in config files to explain non-obvious settings:

```json
{
  "translation": {
    "qualityThreshold": 0.75,
    "_qualityThreshold_comment": "Raised to 0.75 to reduce false positives in production"
  }
}
```

## Migration from Old Config

If migrating from scattered configuration:

### Before (Old Approach)
```typescript
const apiKey = process.env.GEMINI_API_KEY_ODD;
const maxTokens = parseInt(process.env.MAX_TOKENS || '4000');
const dbUrl = process.env.DATABASE_URL || 'sqlite://default.db';
```

### After (Unified Config)
```typescript
const config = getConfig();
const apiKey = config.translation.models[0].apiKey;
const maxTokens = config.translation.maxTokens;
const dbUrl = config.database.url;
```

## Troubleshooting

### "Configuration validation failed"

Check the error message for specific field issues:
```
translation.models: Array must contain at least 1 element(s)
```

Solution: Ensure at least one API key is set:
```bash
export GEMINI_API_KEY_ODD=your_key
```

### "Cannot watch config: no file path set"

You tried to call `watch()` on config loaded from environment:
```typescript
const config = ConfigService.load(process.env);
config.watch(...); // Error!
```

Solution: Load from file first:
```typescript
const config = ConfigService.loadFromFile('./config/development.json');
config.watch(...); // Works!
```

### Config changes not taking effect

If using the global singleton, remember to call `setConfig()`:
```typescript
const newConfig = ConfigService.loadFromFile('./config/new.json');
setConfig(newConfig); // Update global instance
```

## Complete Example

```typescript
import { ConfigService, getConfig } from './server/core/config.js';

// Initialize configuration
async function initializeApp() {
  try {
    // Load configuration with defaults and environment overrides
    const config = ConfigService.loadWithDefaults(process.env);

    // Validate
    const validation = config.validate();
    if (!validation.isValid) {
      console.error('Configuration errors:');
      validation.errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }

    // Log configuration summary
    console.log('Configuration loaded successfully:');
    console.log(`  Environment: ${config.server.environment}`);
    console.log(`  Port: ${config.server.port}`);
    console.log(`  Database: ${config.database.type}`);
    console.log(`  Models: ${config.translation.models.length}`);
    console.log(`  Cache: ${config.cache.type} (${config.cache.enabled ? 'enabled' : 'disabled'})`);

    // Enable hot reloading in development
    if (config.server.environment === 'development') {
      config.watch((newConfig) => {
        console.log('Configuration reloaded!');
        // Update services...
      });
    }

    return config;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }
}

// Start application
initializeApp().then(config => {
  // Use config throughout application
  startServer(config);
});
```

## Summary

The unified configuration system provides:

- Type-safe, validated configuration
- Environment-specific settings
- Flexible loading from files or environment
- Hot reloading capability
- Centralized management
- Clear documentation

All configuration is now in one place, making deployment and maintenance much easier!
