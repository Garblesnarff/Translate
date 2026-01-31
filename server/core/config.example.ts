/**
 * ConfigService Usage Examples
 *
 * This file demonstrates various ways to use the ConfigService
 * Run with: npx tsx server/core/config.example.ts
 */

import { ConfigService, getConfig, setConfig, resetConfig } from './config.js';

// ============================================================================
// Example 1: Load from Environment Variables
// ============================================================================

console.log('\n=== Example 1: Load from Environment Variables ===\n');

// Set some environment variables for demo
process.env.GEMINI_API_KEY_ODD = 'demo-key-1';
process.env.GEMINI_API_KEY_EVEN = 'demo-key-2';
process.env.PORT = '5001';
process.env.NODE_ENV = 'development';

const config1 = ConfigService.load(process.env);

console.log('Server Config:');
console.log(`  Port: ${config1.server.port}`);
console.log(`  Environment: ${config1.server.environment}`);

console.log('\nTranslation Config:');
console.log(`  Number of models: ${config1.translation.models.length}`);
console.log(`  Max tokens: ${config1.translation.maxTokens}`);
console.log(`  Temperature: ${config1.translation.temperature}`);
console.log(`  Quality threshold: ${config1.translation.qualityThreshold}`);

console.log('\nDatabase Config:');
console.log(`  Type: ${config1.database.type}`);
console.log(`  URL: ${config1.database.url}`);
console.log(`  Max connections: ${config1.database.maxConnections}`);

console.log('\nCache Config:');
console.log(`  Enabled: ${config1.cache.enabled}`);
console.log(`  Type: ${config1.cache.type}`);
console.log(`  Max size: ${config1.cache.maxSize}`);
console.log(`  Default TTL: ${config1.cache.defaultTTL}s`);

console.log('\nMonitoring Config:');
console.log(`  Enabled: ${config1.monitoring.enabled}`);
console.log(`  Metrics interval: ${config1.monitoring.metricsInterval}ms`);
console.log(`  Performance tracking: ${config1.monitoring.enablePerformance}`);

// ============================================================================
// Example 2: Load from File
// ============================================================================

console.log('\n=== Example 2: Load from File ===\n');

try {
  const config2 = ConfigService.loadFromFile('./config/development.json');
  console.log('Loaded development config successfully!');
  console.log(`  Port: ${config2.server.port}`);
  console.log(`  Quality threshold: ${config2.translation.qualityThreshold}`);
  console.log(`  Database: ${config2.database.type}`);
} catch (error) {
  console.error('Failed to load config file:', error);
}

// ============================================================================
// Example 3: Load with Defaults
// ============================================================================

console.log('\n=== Example 3: Load with Defaults (Recommended) ===\n');

try {
  const config3 = ConfigService.loadWithDefaults(process.env);
  console.log('Loaded config with defaults and environment overrides!');
  console.log(`  Environment: ${config3.server.environment}`);
  console.log(`  Port: ${config3.server.port}`);
  console.log(`  Models configured: ${config3.translation.models.length}`);

  // Show model details
  config3.translation.models.forEach((model, i) => {
    console.log(`  Model ${i + 1}: ${model.provider} - ${model.model} (priority: ${model.priority})`);
  });
} catch (error) {
  console.error('Failed to load config:', error);
}

// ============================================================================
// Example 4: Configuration Validation
// ============================================================================

console.log('\n=== Example 4: Configuration Validation ===\n');

const config4 = ConfigService.load(process.env);
const validation = config4.validate();

if (validation.isValid) {
  console.log('✓ Configuration is valid!');
} else {
  console.log('✗ Configuration has errors:');
  validation.errors.forEach(error => console.log(`  - ${error}`));
}

if (validation.warnings.length > 0) {
  console.log('⚠ Warnings:');
  validation.warnings.forEach(warning => console.log(`  - ${warning}`));
}

// ============================================================================
// Example 5: Using Global Singleton
// ============================================================================

console.log('\n=== Example 5: Using Global Singleton ===\n');

// First access creates the instance
const globalConfig1 = getConfig();
console.log(`Global config created: ${globalConfig1.server.environment}`);

// Second access returns same instance
const globalConfig2 = getConfig();
console.log(`Same instance: ${globalConfig1 === globalConfig2}`);

// Reset for testing
resetConfig();
const globalConfig3 = getConfig();
console.log(`After reset, new instance: ${globalConfig1 === globalConfig3}`);

// ============================================================================
// Example 6: Type-Safe Access
// ============================================================================

console.log('\n=== Example 6: Type-Safe Access ===\n');

const config6 = ConfigService.load(process.env);

// Access specific sections with full type safety
const serverConfig = config6.server;
const translationConfig = config6.translation;
const databaseConfig = config6.database;

console.log('Server Configuration:');
console.log(`  Port: ${serverConfig.port}`);
console.log(`  Environment: ${serverConfig.environment}`);
console.log(`  CORS enabled: ${serverConfig.enableCors}`);
console.log(`  Logging enabled: ${serverConfig.enableLogging}`);
console.log(`  Request timeout: ${serverConfig.requestTimeout}ms`);
console.log(`  Max body size: ${serverConfig.maxBodySize}`);

console.log('\nRetry Configuration:');
console.log(`  Max retries: ${translationConfig.retry.maxRetries}`);
console.log(`  Base delay: ${translationConfig.retry.baseDelay}ms`);
console.log(`  Max delay: ${translationConfig.retry.maxDelay}ms`);
console.log(`  Exponential backoff: ${translationConfig.retry.exponentialBackoff}`);

// ============================================================================
// Example 7: Hot Reloading (commented out - requires file watching)
// ============================================================================

console.log('\n=== Example 7: Hot Reloading ===\n');

console.log('Hot reloading example (disabled in demo):');
console.log(`
// Load from file
const config = ConfigService.loadFromFile('./config/development.json');

// Watch for changes
config.watch((newConfig) => {
  console.log('Configuration updated!');
  console.log(\`New port: \${newConfig.server.port}\`);
  console.log(\`New quality threshold: \${newConfig.translation.qualityThreshold}\`);

  // Update your services with new config
  translationService.updateConfig(newConfig.translation);
  databaseService.updateConfig(newConfig.database);
});

// When done watching
config.unwatch();
`);

// ============================================================================
// Example 8: Error Handling
// ============================================================================

console.log('\n=== Example 8: Error Handling ===\n');

try {
  // This will fail because no API keys are set
  const badEnv = { NODE_ENV: 'production' };
  const config8 = ConfigService.load(badEnv);
  console.log('This should not print');
} catch (error) {
  if (error instanceof Error) {
    console.log('✓ Caught expected validation error:');
    console.log(`  ${error.message.split('\n')[0]}`);
  }
}

// ============================================================================
// Example 9: All Configurable Settings
// ============================================================================

console.log('\n=== Example 9: All Configurable Settings ===\n');

const config9 = ConfigService.load(process.env);
console.log('Complete configuration structure:');
console.log(JSON.stringify(config9.all, null, 2));

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== Summary ===\n');
console.log('The ConfigService provides:');
console.log('  ✓ Type-safe configuration access');
console.log('  ✓ Zod validation with descriptive errors');
console.log('  ✓ Environment-specific configs (dev/prod/test)');
console.log('  ✓ Environment variable overrides');
console.log('  ✓ Hot reloading capability');
console.log('  ✓ Global singleton pattern');
console.log('  ✓ Comprehensive documentation');
console.log('\nConfiguration is centralized and validated!');
