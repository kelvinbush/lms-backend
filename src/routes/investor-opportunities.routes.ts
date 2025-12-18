import { getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { InvestorOpportunitiesModel } from "../modules/investor-opportunities/investor-opportunities.model";
import { InvestorOpportunitiesService } from "../modules/investor-opportunities/investor-opportunities.service";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function investorOpportunitiesRoutes(fastify: FastifyInstance) {
  // CREATE investor opportunity
  fastify.post(
    "/",
    {
      schema: {
        body: InvestorOpportunitiesModel.CreateInvestorOpportunityBodySchema,
        response: {
          200: InvestorOpportunitiesModel.InvestorOpportunityItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await InvestorOpportunitiesService.create(
          userId,
          request.body as InvestorOpportunitiesModel.CreateInvestorOpportunityBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error creating investor opportunity:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to create investor opportunity",
            code: "CREATE_INVESTOR_OPPORTUNITY_FAILED",
          });
      }
    }
  );

  // LIST investor opportunities
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: InvestorOpportunitiesModel.ListInvestorOpportunitiesResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await InvestorOpportunitiesService.list(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing investor opportunities:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to list investor opportunities",
            code: "LIST_INVESTOR_OPPORTUNITIES_FAILED",
          });
      }
    }
  );

  // LIST bookmarks for current user
  fastify.get(
    "/bookmarks",
    {
      schema: {
        response: {
          200: InvestorOpportunitiesModel.ListBookmarkedInvestorOpportunitiesResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await InvestorOpportunitiesService.listBookmarks(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing investor opportunity bookmarks:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to list investor opportunity bookmarks",
            code: "LIST_INVESTOR_OPPORTUNITY_BOOKMARKS_FAILED",
          });
      }
    }
  );

  // GET by ID
  fastify.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: InvestorOpportunitiesModel.InvestorOpportunityItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await InvestorOpportunitiesService.getById(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting investor opportunity:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to get investor opportunity",
            code: "GET_INVESTOR_OPPORTUNITY_FAILED",
          });
      }
    }
  );

  // UPDATE
  fastify.patch(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: InvestorOpportunitiesModel.EditInvestorOpportunityBodySchema,
        response: {
          200: InvestorOpportunitiesModel.InvestorOpportunityItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await InvestorOpportunitiesService.update(
          userId,
          id,
          request.body as InvestorOpportunitiesModel.EditInvestorOpportunityBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating investor opportunity:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to update investor opportunity",
            code: "UPDATE_INVESTOR_OPPORTUNITY_FAILED",
          });
      }
    }
  );

  // DELETE (soft)
  fastify.delete(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: UserModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await InvestorOpportunitiesService.remove(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting investor opportunity:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to delete investor opportunity",
            code: "DELETE_INVESTOR_OPPORTUNITY_FAILED",
          });
      }
    }
  );

  // BOOKMARK
  fastify.post(
    "/:id/bookmark",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: UserModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await InvestorOpportunitiesService.bookmark(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error bookmarking investor opportunity:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to bookmark investor opportunity",
            code: "BOOKMARK_INVESTOR_OPPORTUNITY_FAILED",
          });
      }
    }
  );

  // UNBOOKMARK
  fastify.delete(
    "/:id/bookmark",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: UserModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["investor-opportunities"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await InvestorOpportunitiesService.unbookmark(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error unbookmarking investor opportunity:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to unbookmark investor opportunity",
            code: "UNBOOKMARK_INVESTOR_OPPORTUNITY_FAILED",
          });
      }
    }
  );
}
