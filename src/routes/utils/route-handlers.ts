import { getAuth } from "@clerk/fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../../utils/logger";

export interface RouteHandlerOptions {
  requireAuth?: boolean;
  serviceMethod: (...args: any[]) => Promise<any>;
  successMessage: string;
  errorCode: string;
}

export async function handleRoute(
  request: FastifyRequest,
  reply: FastifyReply,
  options: RouteHandlerOptions
) {
  try {
    const { requireAuth = true, serviceMethod, successMessage, errorCode } = options;

    if (requireAuth) {
      const { userId } = getAuth(request);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
      }
    }

    const result = await serviceMethod();

    return reply.send({
      success: true,
      message: successMessage,
      data: result,
    });
  } catch (error: any) {
    logger.error("Error in route handler:", error);
    if (error?.status) {
      return reply.code(error.status).send({
        error: error.message,
        code: String(error.message).split("] ")[0].replace("[", ""),
      });
    }
    return reply.code(500).send({
      error: `Failed to ${options.errorCode.toLowerCase()}`,
      code: options.errorCode,
    });
  }
}

export function extractParams(request: FastifyRequest) {
  return (request.params as any) || {};
}

export function extractQuery(request: FastifyRequest) {
  return (request.query as any) || {};
}

export function extractBody(request: FastifyRequest) {
  return (request.body as any) || {};
}
