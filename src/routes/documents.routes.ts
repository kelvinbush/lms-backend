import { getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CachingService } from "../modules/caching/caching.service";
import { DocumentsModel } from "../modules/documents/documents.model";
import { Documents } from "../modules/documents/documents.service";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function documentsRoutes(fastify: FastifyInstance) {
  // POST /documents — upsert one or many personal documents
  fastify.post(
    "/",
    {
      schema: {
        body: DocumentsModel.AddDocumentsBodySchema,
        response: {
          200: DocumentsModel.AddDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["documents"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const result = await Documents.upsert(
          userId,
          request.body as DocumentsModel.AddDocumentsBody
        );

        // Invalidate personal documents cache for this user
        try {
          await CachingService.invalidatePattern(`personal_documents:${userId}:*`);
          logger.debug(`Cache invalidated for personal documents of user ${userId}`);
        } catch (cacheError) {
          logger.error(
            `Error invalidating cache for personal documents of user ${userId}:`,
            cacheError
          );
        }

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error upserting personal documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to upsert documents", code: "UPSERT_DOCUMENTS_FAILED" });
      }
    }
  );

  // GET /documents — list all active personal documents
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: DocumentsModel.ListDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["documents"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const result = await Documents.list(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing personal documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list documents", code: "LIST_DOCUMENTS_FAILED" });
      }
    }
  );
}
