import { getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BusinessDocumentsModel } from "../modules/business-documents/business-documents.model";
import { BusinessDocuments } from "../modules/business-documents/business-documents.service";
import { CachingService } from "../modules/caching/caching.service";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function businessDocumentsRoutes(fastify: FastifyInstance) {
  // POST /business/:id/documents — upsert one or many business documents
  fastify.post(
    "/:id/documents",
    {
      schema: {
        params: BusinessDocumentsModel.BusinessIdParamsSchema,
        body: BusinessDocumentsModel.AddDocumentsBodySchema,
        response: {
          200: BusinessDocumentsModel.AddDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business-documents"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        // Debug: log incoming body shape to diagnose docType undefined issues
        try {
          const body: any = request.body;
          const isArray = Array.isArray(body);
          const keys = !isArray && body ? Object.keys(body) : undefined;
          const firstItem = isArray && body && body.length ? body[0] : undefined;
          const firstItemKeys = firstItem ? Object.keys(firstItem) : undefined;
          const receivedDocType = isArray ? firstItem?.docType : body?.docType;
          const contentType = (request.headers["content-type"] as string) || undefined;
          logger.info("Incoming business documents upsert request body", {
            kind: "business-docs.upsert.request",
            contentType,
            rawBodyType: typeof body,
            isArray,
            keys,
            firstItemKeys,
            receivedDocType,
          });
        } catch (e) {
          logger.warn("Failed to log business-docs upsert request body", { err: e });
        }
        // Quick fix: ensure the service always receives an array
        const normalizedBody = Array.isArray(request.body) ? request.body : [request.body];
        const result = await BusinessDocuments.upsert(
          userId,
          id,
          normalizedBody as BusinessDocumentsModel.AddDocumentsBody
        );

        // Invalidate business documents cache for this business
        try {
          await CachingService.invalidatePattern(`business_documents:${id}:*`);
          logger.debug(`Cache invalidated for business documents of business ${id}`);
        } catch (cacheError) {
          logger.error(
            `Error invalidating cache for business documents of business ${id}:`,
            cacheError
          );
        }

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error upserting business documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to upsert business documents",
            code: "UPSERT_BUSINESS_DOCUMENTS_FAILED",
          });
      }
    }
  );

  // GET /business/:id/documents — list all active business documents
  fastify.get(
    "/:id/documents",
    {
      schema: {
        params: BusinessDocumentsModel.BusinessIdParamsSchema,
        response: {
          200: BusinessDocumentsModel.ListDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business-documents"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await BusinessDocuments.list(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing business documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to list business documents",
            code: "LIST_BUSINESS_DOCUMENTS_FAILED",
          });
      }
    }
  );
}
