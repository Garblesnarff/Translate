/**
 * Secret Management Configuration (Phase 4.1.5)
 *
 * Secure secret management for production deployment.
 * - NEVER commit secrets to git
 * - Use environment variables for production
 * - Support .env files for development (gitignored)
 * - Validate required secrets on startup
 * - Mask secrets in logs
 */

import { z } from "zod";

// Define the schema for all required secrets
const SecretsSchema = z.object({
  // Database connection
  DATABASE_URL: z.string().optional(),

  // Gemini API keys (dual key setup for odd/even pages)
  GEMINI_API_KEY_ODD: z.string().min(1, "GEMINI_API_KEY_ODD is required"),
  GEMINI_API_KEY_EVEN: z.string().min(1, "GEMINI_API_KEY_EVEN is required"),

  // Optional AI service keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Redis for distributed rate limiting (optional for development)
  REDIS_URL: z.string().optional(),

  // Session and encryption secrets
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  API_KEY_ENCRYPTION_KEY: z.string().min(32, "API_KEY_ENCRYPTION_KEY must be at least 32 characters"),

  // Server configuration
  PORT: z.string().optional().default("5001"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Secrets = z.infer<typeof SecretsSchema>;

/**
 * Mask sensitive values for logging
 */
export function maskSecret(secret: string | undefined): string {
  if (!secret) return "[NOT SET]";
  if (secret.length <= 8) return "***";
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}

/**
 * Validate and load secrets from environment variables
 */
export function loadSecrets(): Secrets {
  try {
    // Parse and validate environment variables
    const secrets = SecretsSchema.parse(process.env);

    // Log masked secrets for verification (only in development)
    if (secrets.NODE_ENV === "development") {
      console.log("[secrets] Configuration loaded:");
      console.log(`  DATABASE_URL: ${secrets.DATABASE_URL ? maskSecret(secrets.DATABASE_URL) : "[using SQLite]"}`);
      console.log(`  GEMINI_API_KEY_ODD: ${maskSecret(secrets.GEMINI_API_KEY_ODD)}`);
      console.log(`  GEMINI_API_KEY_EVEN: ${maskSecret(secrets.GEMINI_API_KEY_EVEN)}`);
      console.log(`  OPENAI_API_KEY: ${maskSecret(secrets.OPENAI_API_KEY)}`);
      console.log(`  ANTHROPIC_API_KEY: ${maskSecret(secrets.ANTHROPIC_API_KEY)}`);
      console.log(`  REDIS_URL: ${maskSecret(secrets.REDIS_URL)}`);
      console.log(`  SESSION_SECRET: ${maskSecret(secrets.SESSION_SECRET)}`);
      console.log(`  API_KEY_ENCRYPTION_KEY: ${maskSecret(secrets.API_KEY_ENCRYPTION_KEY)}`);
      console.log(`  PORT: ${secrets.PORT}`);
      console.log(`  NODE_ENV: ${secrets.NODE_ENV}`);
    }

    return secrets;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[secrets] Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\n[secrets] Please check your .env file or environment variables.");
      console.error("[secrets] See .env.example for required configuration.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Generate a random secret key (for development)
 */
export function generateSecretKey(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Export singleton instance
let secretsInstance: Secrets | null = null;

export function getSecrets(): Secrets {
  if (!secretsInstance) {
    secretsInstance = loadSecrets();
  }
  return secretsInstance;
}
