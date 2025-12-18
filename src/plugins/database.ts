/**
 * Database plugin for Fastify (flattened)
 * Exposes Drizzle `db` on fastify instance and gracefully closes connection on shutdown
 */
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { connection, db } from "../db";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

export const databasePlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  // Decorate Fastify instance with db
  fastify.decorate("db", db);

  // Close DB connection gracefully when Fastify shuts down
  fastify.addHook("onClose", async (instance) => {
    try {
      await connection.end();
    } catch (err) {
      instance.log.warn({ err }, "Failed to close database connection gracefully");
    }
  });
});
