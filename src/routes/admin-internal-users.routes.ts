import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { InternalUsersModel } from "../modules/internal-users/internal-users.model";
import { InternalUsersService } from "../modules/internal-users/internal-users.service";
import { requireSuperAdmin } from "../utils/authz";

export async function adminInternalUsersRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/admin/internal-users/invitations",
    {
      schema: {
        body: InternalUsersModel.CreateInvitationBodySchema,
        response: {
          200: InternalUsersModel.CreateInvitationResponseSchema,
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (
      request: FastifyRequest<{ Body: InternalUsersModel.CreateInvitationBody }>,
      reply: FastifyReply
    ) => {
      try {
        const current = await requireSuperAdmin(request);
        const result = await InternalUsersService.createInvitation({
          invitedByClerkUserId: current.clerkId,
          body: request.body,
        });
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  fastify.get(
    "/admin/internal-users",
    {
      schema: {
        response: {
          200: InternalUsersModel.ListUsersResponseSchema,
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireSuperAdmin(request);
        const result = await InternalUsersService.listInternalUsers();
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  fastify.post(
    "/admin/internal-users/invitations/:id/resend",
    {
      schema: {
        params: InternalUsersModel.InvitationIdParamsSchema,
        response: {
          200: InternalUsersModel.BasicSuccessResponseSchema,
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          404: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (
      request: FastifyRequest<{ Params: InternalUsersModel.InvitationIdParams }>,
      reply: FastifyReply
    ) => {
      try {
        await requireSuperAdmin(request);
        const result = await InternalUsersService.resendInvitation({
          localInvitationId: request.params.id,
        });
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  fastify.post(
    "/admin/internal-users/invitations/:id/revoke",
    {
      schema: {
        params: InternalUsersModel.InvitationIdParamsSchema,
        response: {
          200: InternalUsersModel.BasicSuccessResponseSchema,
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          404: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (
      request: FastifyRequest<{ Params: InternalUsersModel.InvitationIdParams }>,
      reply: FastifyReply
    ) => {
      try {
        await requireSuperAdmin(request);
        const result = await InternalUsersService.revokeInvitation({
          localInvitationId: request.params.id,
        });
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  fastify.post(
    "/admin/internal-users/:clerkUserId/deactivate",
    {
      schema: {
        params: InternalUsersModel.ClerkUserIdParamsSchema,
        response: {
          200: InternalUsersModel.BasicSuccessResponseSchema,
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (
      request: FastifyRequest<{ Params: InternalUsersModel.ClerkUserIdParams }>,
      reply: FastifyReply
    ) => {
      try {
        await requireSuperAdmin(request);
        const result = await InternalUsersService.deactivateUser({
          clerkUserId: request.params.clerkUserId,
        });
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  fastify.delete(
    "/admin/internal-users/:clerkUserId",
    {
      schema: {
        params: InternalUsersModel.ClerkUserIdParamsSchema,
        response: {
          200: InternalUsersModel.BasicSuccessResponseSchema,
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (
      request: FastifyRequest<{ Params: InternalUsersModel.ClerkUserIdParams }>,
      reply: FastifyReply
    ) => {
      try {
        await requireSuperAdmin(request);
        const result = await InternalUsersService.removeUser({
          clerkUserId: request.params.clerkUserId,
        });
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  fastify.post(
    "/admin/internal-users/:clerkUserId/activate",
    {
      schema: {
        params: InternalUsersModel.ClerkUserIdParamsSchema,
        response: {
          200: InternalUsersModel.BasicSuccessResponseSchema,
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-internal-users"],
      },
    },
    async (
      request: FastifyRequest<{ Params: InternalUsersModel.ClerkUserIdParams }>,
      reply: FastifyReply
    ) => {
      try {
        await requireSuperAdmin(request);
        const result = await InternalUsersService.activateUser({
          clerkUserId: request.params.clerkUserId,
        });
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );
}
