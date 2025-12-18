import { clerkClient, getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BusinessModel } from "../modules/business/business.model";
import { Business } from "../modules/business/business.service";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function businessRoutes(fastify: FastifyInstance) {
  // POST /business/register — requires auth
  fastify.post(
    "/register",
    {
      schema: {
        body: BusinessModel.RegisterBusinessBodySchema,
        response: {
          200: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const id = await Business.register(
          userId,
          request.body as BusinessModel.RegisterBusinessInput
        );

        if (id) {
          try {
            await clerkClient.users.updateUser(userId, {
              publicMetadata: { onBoardingStage: 0, isPhoneVerified: true },
            });
          } catch (e) {
            logger.error("Failed to update Clerk publicMetadata.isPhoneVerified:", e);
            // Do not fail the request if metadata update fails; client already verified OTP
          }
        }

        return reply.send(id);
      } catch (error: any) {
        logger.error("Error registering business:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to register business",
          code: "BUSINESS_REGISTER_FAILED",
        });
      }
    }
  );

  // PUT /business/:id — requires auth
  fastify.put(
    "/:id",
    {
      schema: {
        params: BusinessModel.BusinessIdParamsSchema,
        body: BusinessModel.EditBusinessBodySchema,
        response: {
          200: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const result = await Business.edit(
          userId,
          id,
          request.body as BusinessModel.EditBusinessBody
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error editing business:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to edit business",
          code: "BUSINESS_EDIT_FAILED",
        });
      }
    }
  );

  // GET /business — requires auth
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: BusinessModel.ListBusinessesResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const result = await Business.listByUser(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error fetching user businesses:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get businesses",
          code: "GET_BUSINESSES_FAILED",
        });
      }
    }
  );
}
