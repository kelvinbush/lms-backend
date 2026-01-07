import fastifyCors from "@fastify/cors";
/**
 * CORS plugin for Fastify
 * This plugin configures CORS settings for the Fastify server
 */
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

export const corsPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  const appUrl = process.env.APP_URL;
  const adminUrl = process.env.ADMIN_URL;
  const nodeEnv = process.env.NODE_ENV || "development";

  // Build origin checker: combine APP_URL and ADMIN_URL
  const allowedOrigins: string[] = [];
  if (appUrl) {
    allowedOrigins.push(appUrl.trim());
  }
  if (adminUrl) {
    allowedOrigins.push(adminUrl.trim());
  }

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // Server-to-server or same-origin requests (no Origin header)
      if (!origin) return cb(null, true);

      if (allowedOrigins.length > 0) {
        // Check if the origin matches any allowed origin
        const matchedOrigin = allowedOrigins.find((allowed) => origin === allowed);
        if (matchedOrigin) {
          // Return the origin string to allow this specific origin
          return cb(null, matchedOrigin);
        }
        // Origin not in allowed list
        return cb(null, false);
      }

      // If not explicitly configured, allow all in non-production to ease local dev
      if (nodeEnv !== "production") return cb(null, true);

      // Default deny in production
      cb(null, false);
    },
    credentials: true,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "svix-id",
      "svix-timestamp",
      "svix-signature",
    ],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400,
  });
});
