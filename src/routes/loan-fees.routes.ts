import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { LoanFeesModel } from "../modules/loan-fees/loan-fees.model";
import { LoanFeesService } from "../modules/loan-fees/loan-fees.service";
import { UserModel } from "../modules/user/user.model";
import { requireRole } from "../utils/authz";
import { logger } from "../utils/logger";

export async function loanFeesRoutes(fastify: FastifyInstance) {
  // LIST loan fees (public read)
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
            includeArchived: { type: "string", enum: ["true", "false"] },
          },
        },
        response: {
          200: LoanFeesModel.PaginatedLoanFeesResponseSchema,
          400: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-fees"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as LoanFeesModel.ListLoanFeesQuery;
        const result = await LoanFeesService.list(query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing loan fees:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list loan fees", code: "LIST_LOAN_FEES_FAILED" });
      }
    }
  );

  // GET loan fee by ID (public read)
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
          200: LoanFeesModel.LoanFeeItemSchema,
          400: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-fees"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = (request.params as any) || {};
        const result = await LoanFeesService.getById(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan fee:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get loan fee", code: "GET_LOAN_FEE_FAILED" });
      }
    }
  );

  // CREATE loan fee (admin/super-admin/member only)
  fastify.post(
    "/",
    {
      schema: {
        body: LoanFeesModel.CreateLoanFeeBodySchema,
        response: {
          201: LoanFeesModel.LoanFeeItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          409: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-fees"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await LoanFeesService.create(
          request.body as LoanFeesModel.CreateLoanFeeBody
        );
        return reply.code(201).send(result);
      } catch (error: any) {
        logger.error("Error creating loan fee:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create loan fee", code: "CREATE_LOAN_FEE_FAILED" });
      }
    }
  );

  // UPDATE loan fee (admin/super-admin/member only)
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
        body: LoanFeesModel.UpdateLoanFeeBodySchema,
        response: {
          200: LoanFeesModel.LoanFeeItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          409: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-fees"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { id } = (request.params as any) || {};
        const result = await LoanFeesService.update(
          id,
          request.body as LoanFeesModel.UpdateLoanFeeBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating loan fee:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update loan fee", code: "UPDATE_LOAN_FEE_FAILED" });
      }
    }
  );

  // DELETE loan fee (admin/super-admin/member only) - archives if linked, deletes if not
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
        tags: ["loan-fees"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { id } = (request.params as any) || {};
        const result = await LoanFeesService.delete(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting loan fee:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete loan fee", code: "DELETE_LOAN_FEE_FAILED" });
      }
    }
  );

  // UNARCHIVE loan fee (admin/super-admin/member only)
  fastify.post(
    "/:id/unarchive",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: LoanFeesModel.LoanFeeItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-fees"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { id } = (request.params as any) || {};
        const result = await LoanFeesService.unarchive(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error unarchiving loan fee:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to unarchive loan fee", code: "UNARCHIVE_LOAN_FEE_FAILED" });
      }
    }
  );
}
