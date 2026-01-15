import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

// Load environment variables
loadEnv({ path: "./.env.local" });

const { DATABASE_TEST_URL } = process.env;

if (!DATABASE_TEST_URL) {
  throw new Error("DATABASE_TEST_URL is not set. Please add it to your environment (.env.local)");
}

// Create a test database connection
export const testConnection = postgres(DATABASE_TEST_URL, {
  prepare: false, // Disable prepared statements for tests
  max: 1, // Single connection for tests
});

export const testDb = drizzle(testConnection, { schema });
export type TestDB = typeof testDb;

/**
 * Clean up all tables in the test database
 * Useful for resetting between tests
 *
 * Uses a single TRUNCATE statement for all tables to minimize deadlock risk
 */
export async function cleanupTestDatabase() {
  // Delete in reverse order of dependencies to avoid foreign key violations
  const tables = [
    "loan_application_document_verifications",
    "loan_application_audit_trail",
    "loan_applications",
    "business_documents",
    "personal_documents",
    "business_profiles",
    "users",
    "loan_products",
    "organizations",
  ];

  try {
    // Use a single TRUNCATE statement for all tables to reduce lock contention
    // This is more efficient and reduces deadlock risk
    if (tables.length > 0) {
      await testConnection.unsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
    }
  } catch (error: any) {
    // Ignore errors if tables don't exist (migrations not run yet)
    if (error?.code === "42P01") {
      // 42P01 = relation does not exist - this is OK if migrations haven't been run
      return;
    }
    // For other errors, try individual truncates as fallback
    for (const table of tables) {
      try {
        await testConnection.unsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch (innerError: any) {
        if (innerError?.code !== "42P01") {
          throw innerError;
        }
      }
    }
  }
}

/**
 * Close the test database connection
 */
export async function closeTestDatabase() {
  await testConnection.end();
}
