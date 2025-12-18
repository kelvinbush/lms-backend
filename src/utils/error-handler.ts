/**
 * Global Fastify error handler (flattened)
 */
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "./logger";

export function errorHandler(error: FastifyError, _request: FastifyRequest, reply: FastifyReply) {
  // Log the error
  logger.error(error.message || "Unhandled error", error);

  // Determine status code
  const statusCode = error.statusCode || 500;

  // Prepare error response
  const errorResponse = {
    error: error.message || "Internal Server Error",
    code: (error as any).code || "INTERNAL_SERVER_ERROR",
  };

  // Send error response
  reply.status(statusCode).send(errorResponse);
}
