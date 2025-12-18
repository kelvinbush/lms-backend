import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

loadEnv();

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please add it to your environment (.env)");
}

// Create a singleton Postgres client for the app lifetime
export const connection = postgres(DATABASE_URL, {
  prepare: true,
  max: 10,
  idle_timeout: 20,
});

export const db = drizzle(connection, { schema });
export type DB = typeof db;
