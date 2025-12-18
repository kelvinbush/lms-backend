import fastifyRateLimit from "@fastify/rate-limit";
/**
 * Rate limiting plugin for Fastify (flattened)
 */
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

export const rateLimitPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  const max = Number(process.env.RATE_LIMIT_MAX || 100);
  const timeWindow = process.env.RATE_LIMIT_WINDOW || "1 minute";

  await fastify.register(fastifyRateLimit, {
    max,
    timeWindow,
    skipOnError: true,
    // Skip rate limiting for health/docs endpoints and preflight
    allowList: (req) => {
      const url = req.raw.url || "";
      if (req.method === "OPTIONS") return true;
      if (url.startsWith("/health")) return true;
      if (url.startsWith("/documentation")) return true;
      return false;
    },
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded, retry in ${context.after}`,
      code: "RATE_LIMIT_EXCEEDED",
    }),
  });
});
