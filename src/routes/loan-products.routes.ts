import { getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { LoanProductsModel } from "../modules/loan-products/loan-products.model";
import { LoanProductsService } from "../modules/loan-products/loan-products.service";
import { UserModel } from "../modules/user/user.model";
import { requireRole } from "../utils/authz";
import { logger } from "../utils/logger";

export async function loanProductsRoutes(fastify: FastifyInstance) {
  // CREATE loan product
  fastify.post(
    "/",
    {
      schema: {
        body: LoanProductsModel.CreateLoanProductBodySchema,
        response: {
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await LoanProductsService.create(
          userId,
          request.body as LoanProductsModel.CreateLoanProductBody
        );
        return reply.code(201).send(result);
      } catch (error: any) {
        logger.error("Error creating loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create loan product", code: "CREATE_LOAN_PRODUCT_FAILED" });
      }
    }
  );

  // LIST loan products with optional filtering
  fastify.get(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            // Pagination
            page: { type: "string", pattern: "^[0-9]+$" },
            limit: { type: "string", pattern: "^[0-9]+$" },

            // Status filtering
            status: { type: "string", enum: LoanProductsModel.ProductStatusEnum },
            includeArchived: { type: "string", enum: ["true", "false"] },

            // Currency and amount filtering
            currency: { type: "string", minLength: 1 },
            minAmount: { type: "string", pattern: "^[0-9]+(\\.[0-9]+)?$" },
            maxAmount: { type: "string", pattern: "^[0-9]+(\\.[0-9]+)?$" },

            // Term filtering
            minTerm: { type: "string", pattern: "^[0-9]+$" },
            maxTerm: { type: "string", pattern: "^[0-9]+$" },
            termUnit: { type: "string", enum: LoanProductsModel.LoanTermUnitEnum },

            // Interest and repayment filtering
            ratePeriod: { type: "string", enum: LoanProductsModel.InterestRatePeriodEnum },
            amortizationMethod: { type: "string", enum: LoanProductsModel.AmortizationMethodEnum },
            repaymentFrequency: { type: "string", enum: LoanProductsModel.RepaymentFrequencyEnum },

            // Active status
            isActive: { type: "string", enum: ["true", "false"] },

            // Search
            search: { type: "string", minLength: 1, maxLength: 100 },

            // Sorting
            sortBy: {
              type: "string",
              enum: ["name", "createdAt", "updatedAt", "interestRate", "minAmount", "maxAmount"],
            },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
          },
        },
        response: {
          200: LoanProductsModel.ListLoanProductsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
      preValidation: async (request: FastifyRequest, _reply: FastifyReply) => {
        // Normalize duplicate query parameters (arrays) to their first value
        // This handles cases where the same query param appears multiple times in the URL
        if (request.query && typeof request.query === "object") {
          const query = request.query as Record<string, any>;
          for (const key in query) {
            if (Array.isArray(query[key])) {
              query[key] = query[key][0];
            }
          }
        }
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const query = request.query as LoanProductsModel.ListLoanProductsQuery;
        const result = await LoanProductsService.list(userId, query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing loan products:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list loan products", code: "LIST_LOAN_PRODUCTS_FAILED" });
      }
    }
  );

  // SEARCH loan products (simplified endpoint for loan application creation)
  fastify.get(
    "/search",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            // Search
            search: { type: "string", minLength: 1, maxLength: 100 },
            // Pagination
            page: { type: "string", pattern: "^[0-9]+$" },
            limit: { type: "string", pattern: "^[0-9]+$" },
            // Active status filter (defaults to true)
            isActive: { type: "string", enum: ["true", "false"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    organizationId: { type: "string" },
                    organizationName: { type: "string" },
                    currency: { type: "string" },
                    minAmount: { type: "number" },
                    maxAmount: { type: "number" },
                    minTerm: { type: "number" },
                    maxTerm: { type: "number" },
                    termUnit: {
                      type: "string",
                      enum: ["days", "weeks", "months", "quarters", "years"],
                    },
                    isActive: { type: "boolean" },
                  },
                  required: [
                    "id",
                    "name",
                    "organizationId",
                    "currency",
                    "minAmount",
                    "maxAmount",
                    "minTerm",
                    "maxTerm",
                    "termUnit",
                    "isActive",
                  ],
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "number" },
                  limit: { type: "number" },
                  total: { type: "number" },
                  totalPages: { type: "number" },
                },
                required: ["page", "limit", "total", "totalPages"],
              },
            },
            required: ["data", "pagination"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
      preValidation: async (request: FastifyRequest, _reply: FastifyReply) => {
        // Normalize duplicate query parameters
        if (request.query && typeof request.query === "object") {
          const query = request.query as Record<string, any>;
          for (const key in query) {
            if (Array.isArray(query[key])) {
              query[key] = query[key][0];
            }
          }
        }
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        // Build query with defaults for search endpoint
        const queryParams = request.query as {
          search?: string;
          page?: string;
          limit?: string;
          isActive?: string;
        };

        // Default to active products only and active status
        const searchQuery: LoanProductsModel.ListLoanProductsQuery = {
          page: queryParams.page || "1",
          limit: queryParams.limit || "20",
          search: queryParams.search,
          isActive: queryParams.isActive !== undefined ? queryParams.isActive : "true",
          status: "active", // Only show active status products
          sortBy: "name", // Sort by name alphabetically
          sortOrder: "asc",
        };

        const result = await LoanProductsService.list(userId, searchQuery);

        // Transform response to match API requirements format
        // Note: organizationName is not currently returned by the service, but it's optional in the API
        const transformedData = result.data.map((item: LoanProductsModel.LoanProductItem) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? undefined,
          organizationId: item.organizationId,
          // organizationName would need to be fetched separately if needed
          currency: item.currency,
          minAmount: item.minAmount,
          maxAmount: item.maxAmount,
          minTerm: item.minTerm,
          maxTerm: item.maxTerm,
          termUnit: item.termUnit,
          isActive: item.isActive,
        }));

        return reply.send({
          data: transformedData,
          pagination: result.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        });
      } catch (error: any) {
        logger.error("Error searching loan products:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to search loan products", code: "SEARCH_LOAN_PRODUCTS_FAILED" });
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
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanProductsService.getById(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get loan product", code: "GET_LOAN_PRODUCT_FAILED" });
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
        body: LoanProductsModel.EditLoanProductBodySchema,
        response: {
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanProductsService.update(
          userId,
          id,
          request.body as LoanProductsModel.EditLoanProductBody
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update loan product", code: "UPDATE_LOAN_PRODUCT_FAILED" });
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
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanProductsService.remove(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete loan product", code: "DELETE_LOAN_PRODUCT_FAILED" });
      }
    }
  );

  // UPDATE product status
  fastify.patch(
    "/:id/status",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: LoanProductsModel.ProductStatusEnum },
            changeReason: { type: "string", minLength: 1, maxLength: 500 },
            approvedBy: { type: "string", minLength: 1 },
          },
          required: ["status", "changeReason", "approvedBy"],
        },
        response: {
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = request.params as { id: string };
        const { status, changeReason, approvedBy } = request.body as {
          status: LoanProductsModel.ProductStatus;
          changeReason: string;
          approvedBy: string;
        };

        const result = await LoanProductsService.updateStatus(
          userId,
          id,
          status,
          changeReason,
          approvedBy
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating product status:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update product status", code: "UPDATE_PRODUCT_STATUS_FAILED" });
      }
    }
  );

  // GET available products for applications
  fastify.get(
    "/available",
    {
      schema: {
        response: {
          200: LoanProductsModel.ListLoanProductsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const result = await LoanProductsService.getAvailableForApplications(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting available products:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get available products",
          code: "GET_AVAILABLE_PRODUCTS_FAILED",
        });
      }
    }
  );
}
