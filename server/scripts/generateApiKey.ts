/**
 * API Key Generation Utility
 *
 * Usage:
 *   tsx server/scripts/generateApiKey.ts --name "My App" --permissions translate,jobs
 *   tsx server/scripts/generateApiKey.ts --name "Admin Key" --permissions admin
 *   tsx server/scripts/generateApiKey.ts --name "Test Key" --permissions translate --rate-limit 1000
 */

import { db } from "@db/index";
import { getTables } from "@db/config";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

interface GenerateKeyOptions {
  name: string;
  userId?: string;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

/**
 * Generate a secure API key
 */
function generateSecureKey(): string {
  // Format: tk_<random_32_chars>
  const randomBytes = crypto.randomBytes(24);
  const key = `tk_${randomBytes.toString("base64url")}`;
  return key;
}

/**
 * Create a new API key in the database
 */
async function createApiKey(options: GenerateKeyOptions): Promise<{
  id: string;
  key: string;
  name: string;
  permissions: string[];
  rateLimit: number;
}> {
  const key = generateSecureKey();
  const id = uuidv4();

  const { apiKeys } = getTables();
  await db.insert(apiKeys).values({
    id,
    key,
    name: options.name,
    userId: options.userId,
    permissions: JSON.stringify(options.permissions),
    rateLimit: options.rateLimit || 100,
    expiresAt: options.expiresAt,
    requestsCount: 0,
    revoked: 0,
  });

  return {
    id,
    key,
    name: options.name,
    permissions: options.permissions,
    rateLimit: options.rateLimit || 100,
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): GenerateKeyOptions {
  const args = process.argv.slice(2);

  let name = "Unnamed API Key";
  let userId: string | undefined;
  let permissions: string[] = ["translate"];
  let rateLimit: number | undefined;
  let expiresInDays: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--name" && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (arg === "--user-id" && args[i + 1]) {
      userId = args[i + 1];
      i++;
    } else if (arg === "--permissions" && args[i + 1]) {
      permissions = args[i + 1].split(",").map((p) => p.trim());
      i++;
    } else if (arg === "--rate-limit" && args[i + 1]) {
      rateLimit = parseInt(args[i + 1]);
      i++;
    } else if (arg === "--expires-in-days" && args[i + 1]) {
      expiresInDays = parseInt(args[i + 1]);
      i++;
    }
  }

  // Calculate expiration date
  let expiresAt: Date | undefined;
  if (expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  return {
    name,
    userId,
    permissions,
    rateLimit,
    expiresAt,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log("🔑 API Key Generator\n");

  try {
    const options = parseArgs();

    console.log("Generating API key with options:");
    console.log(`  Name: ${options.name}`);
    console.log(`  Permissions: ${options.permissions.join(", ")}`);
    console.log(`  Rate Limit: ${options.rateLimit || 100} requests/hour`);
    if (options.userId) console.log(`  User ID: ${options.userId}`);
    if (options.expiresAt)
      console.log(`  Expires: ${options.expiresAt.toISOString()}`);
    console.log();

    const result = await createApiKey(options);

    console.log("✅ API Key created successfully!\n");
    console.log("═".repeat(60));
    console.log(`Key ID:      ${result.id}`);
    console.log(`API Key:     ${result.key}`);
    console.log(`Name:        ${result.name}`);
    console.log(`Permissions: ${result.permissions.join(", ")}`);
    console.log(`Rate Limit:  ${result.rateLimit} requests/hour`);
    console.log("═".repeat(60));
    console.log();
    console.log("⚠️  IMPORTANT: Store this API key securely!");
    console.log("   It will not be shown again.");
    console.log();
    console.log("Usage in HTTP requests:");
    console.log(`  Authorization: Bearer ${result.key}`);
    console.log();
    console.log("Or in query parameters (less secure):");
    console.log(`  ?api_key=${result.key}`);
    console.log();

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating API key:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSecureKey, createApiKey };
