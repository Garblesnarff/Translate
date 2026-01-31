/**
 * Test API Key Generation
 *
 * Simple test to verify the API key system works
 */

import { createApiKey } from "./generateApiKey";

async function test() {
  console.log("🔑 Testing API Key Generation\n");

  try {
    const result = await createApiKey({
      name: "Test Key",
      permissions: ["translate"],
      rateLimit: 100,
    });

    console.log("✅ API Key created successfully!");
    console.log(`Key ID: ${result.id}`);
    console.log(`API Key: ${result.key}`);
    console.log(`Name: ${result.name}`);
    console.log(`Permissions: ${result.permissions.join(", ")}`);
    console.log(`Rate Limit: ${result.rateLimit} requests/hour`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

test();
