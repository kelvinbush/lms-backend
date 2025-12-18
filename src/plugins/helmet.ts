import fastifyHelmet from "@fastify/helmet";
/**
 * Helmet plugin for Fastify (flattened)
 */
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

export const helmetPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  const isProd = (process.env.NODE_ENV || "development") === "production";

  await fastify.register(fastifyHelmet, {
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
          },
        }
      : false,
  });
});
