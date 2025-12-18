/**
 * Request logger plugin for Fastify (flattened)
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { logger } from "../utils/logger";

declare module "fastify" {
  interface FastifyRequest {
    startTime: bigint;
  }
}

export const requestLoggerPlugin = fastifyPlugin(async (fastify: FastifyInstance) => {
  // Decorate request with a startTime property to compute response duration
  fastify.decorateRequest("startTime", 0n as unknown as bigint);

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const { method, url, ip, id } = request;
    // Propagate request id to client for correlation
    reply.header("x-request-id", id);
    // mark start time (high-resolution)
    request.startTime = process.hrtime.bigint();
    logger.info(`Incoming request [${id}]: ${method} ${url} from ${ip}`);
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const { method, url, ip, id } = request;
    const { statusCode } = reply;
    const end = process.hrtime.bigint();
    const durationMs = Number((end - request.startTime) / 1_000_000n);
    logger.info(`Completed [${id}]: ${method} ${url} ${statusCode} in ${durationMs}ms from ${ip}`);
  });

  // Log errors in a centralized way
  fastify.addHook(
    "onError",
    async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
      const { method, url, id } = request;
      logger.error(`Error in request [${id}]: ${method} ${url}`, error);
    }
  );
});
