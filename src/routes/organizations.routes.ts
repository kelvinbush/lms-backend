import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { OrganizationsModel } from "../modules/organizations/organizations.model";
import { OrganizationsService } from "../modules/organizations/organizations.service";
import { UserModel } from "../modules/user/user.model";
import { requireRole } from "../utils/authz";
import { logger } from "../utils/logger";

export async function organizationsRoutes(fastify: FastifyInstance) {
  // LIST organizations (public read)
  fastify.get(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "string", pattern: "^[0-9]+$" },
            limit: { type: "string", pattern: "^[0-9]+$" },
            search: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: OrganizationsModel.PaginatedOrganizationsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["organizations"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as OrganizationsModel.ListOrganizationsQuery;
        const result = await OrganizationsService.list(query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing organizations:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list organizations", code: "LIST_ORGANIZATIONS_FAILED" });
      }
    }
  );

  // GET organization by ID (public read)
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
          200: OrganizationsModel.OrganizationItemSchema,
          400: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["organizations"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = (request.params as any) || {};
        const result = await OrganizationsService.getById(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting organization:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get organization", code: "GET_ORGANIZATION_FAILED" });
      }
    }
  );

  // CREATE organization (admin/super-admin/member only)
  fastify.post(
    "/",
    {
      schema: {
        body: OrganizationsModel.CreateOrganizationBodySchema,
        response: {
          201: OrganizationsModel.OrganizationItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          409: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["organizations"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await OrganizationsService.create(
          request.body as OrganizationsModel.CreateOrganizationBody
        );
        return reply.code(201).send(result);
      } catch (error: any) {
        logger.error("Error creating organization:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create organization", code: "CREATE_ORGANIZATION_FAILED" });
      }
    }
  );

  // UPDATE organization (admin/super-admin/member only)
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
        body: OrganizationsModel.UpdateOrganizationBodySchema,
        response: {
          200: OrganizationsModel.OrganizationItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          409: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["organizations"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { id } = (request.params as any) || {};
        const result = await OrganizationsService.update(
          id,
          request.body as OrganizationsModel.UpdateOrganizationBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating organization:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update organization", code: "UPDATE_ORGANIZATION_FAILED" });
      }
    }
  );

  // DELETE organization (admin/super-admin/member only)
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
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["organizations"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { id } = (request.params as any) || {};
        const result = await OrganizationsService.delete(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting organization:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete organization", code: "DELETE_ORGANIZATION_FAILED" });
      }
    }
  );
}
