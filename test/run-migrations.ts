/**
 * Helper script to sync schema on the test database
 *
 * Usage: bun run test:db:migrate
 *
 * This syncs the schema directly to the test database (safer than running migrations
 * when the test DB might be in a different state).
 *
 * NOTE: This uses drizzle-kit push, which syncs the schema directly.
 * For production, use proper migrations. For test DBs, this is acceptable.
 */

import { config as loadEnv } from "dotenv";
import { execSync } from "node:child_process";

loadEnv({ path: "./.env.local" });

const { DATABASE_TEST_URL } = process.env;

if (!DATABASE_TEST_URL) {
  console.error("ERROR: DATABASE_TEST_URL is not set in .env.local");
  process.exit(1);
}

console.log("Syncing schema to test database using DATABASE_TEST_URL...");
console.log("This will push the current schema directly to the test database.\n");

try {
  // Use drizzle-kit push with DATABASE_TEST_URL
  process.env.DATABASE_URL = DATABASE_TEST_URL;
  execSync("bun run db:push", { stdio: "inherit", env: process.env });
  console.log("\n✅ Schema sync completed successfully!");
} catch (error) {
  console.error("\n❌ Schema sync failed:", error);
  process.exit(1);
}
