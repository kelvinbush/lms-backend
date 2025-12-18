import { getAuth } from "@clerk/fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { DocumentRequestService } from "../modules/document-requests/document-request.service";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function documentRequestsRoutes(fastify: FastifyInstance) {
  // CREATE document request
  fastify.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            loanApplicationId: { type: "string", minLength: 1 },
            requestedFrom: { type: "string", minLength: 1 },
            documentType: {
              type: "string",
              enum: [
                // Personal documents
                "national_id_front",
                "national_id_back",
                "passport_bio_page",
                "drivers_license",
                "utility_bill",
                "bank_statement",
                // Business documents
                "business_registration",
                "articles_of_association",
                "business_permit",
                "tax_registration_certificate",
                "certificate_of_incorporation",
                "tax_clearance_certificate",
                "partnership_deed",
                "memorandum_of_association",
                "business_plan",
                "pitch_deck",
                "annual_bank_statement",
                "audited_financial_statements",
                // Other
                "other",
              ],
            },
            description: { type: "string", minLength: 1, maxLength: 1000 },
            isRequired: { type: "boolean" },
          },
          required: ["loanApplicationId", "requestedFrom", "documentType", "description"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  loanApplicationId: { type: "string" },
                  requestedBy: { type: "string" },
                  requestedFrom: { type: "string" },
                  documentType: { type: "string" },
                  description: { type: "string" },
                  isRequired: { type: "string" },
                  status: { type: "string" },
                  fulfilledAt: { type: "string", nullable: true },
                  fulfilledWith: { type: "string", nullable: true },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
                required: [
                  "id",
                  "loanApplicationId",
                  "requestedBy",
                  "requestedFrom",
                  "documentType",
                  "description",
                  "isRequired",
                  "status",
                  "createdAt",
                  "updatedAt",
                ],
              },
            },
            required: ["success", "message", "data"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["document-requests"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        // Get user to get internal ID for requestedBy
        const user = await fastify.db.query.users.findFirst({
          where: (users, { eq }) => eq(users.clerkId, userId),
        });
        if (!user) {
          return reply.code(404).send({ error: "User not found", code: "USER_NOT_FOUND" });
        }

        const body = request.body as any;
        const result = await DocumentRequestService.createRequest({
          loanApplicationId: body.loanApplicationId,
          requestedBy: user.id,
          requestedFrom: body.requestedFrom,
          documentType: body.documentType,
          description: body.description,
          isRequired: body.isRequired,
        });

        return reply.send({
          success: true,
          message: "Document request created successfully",
          data: result,
        });
      } catch (error: any) {
        logger.error("Error creating document request:", error);
        if (error?.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to create document request",
            code: "CREATE_DOCUMENT_REQUEST_FAILED",
          });
      }
    }
  );

  // FULFILL document request
  fastify.patch(
    "/:id/fulfill",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            fulfilledWith: { type: "string", minLength: 1 },
          },
          required: ["fulfilledWith"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  loanApplicationId: { type: "string" },
                  requestedBy: { type: "string" },
                  requestedFrom: { type: "string" },
                  documentType: { type: "string" },
                  description: { type: "string" },
                  isRequired: { type: "string" },
                  status: { type: "string" },
                  fulfilledAt: { type: "string", nullable: true },
                  fulfilledWith: { type: "string", nullable: true },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
                required: [
                  "id",
                  "loanApplicationId",
                  "requestedBy",
                  "requestedFrom",
                  "documentType",
                  "description",
                  "isRequired",
                  "status",
                  "createdAt",
                  "updatedAt",
                ],
              },
            },
            required: ["success", "message", "data"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["document-requests"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = request.params as any;
        const { fulfilledWith } = request.body as any;

        const result = await DocumentRequestService.fulfillRequest({
          requestId: id,
          fulfilledWith,
        });

        return reply.send({
          success: true,
          message: "Document request fulfilled successfully",
          data: result,
        });
      } catch (error: any) {
        logger.error("Error fulfilling document request:", error);
        if (error?.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to fulfill document request",
            code: "FULFILL_DOCUMENT_REQUEST_FAILED",
          });
      }
    }
  );

  // GET pending document requests for a user
  fastify.get(
    "/pending/:userId",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            userId: { type: "string", minLength: 1 },
          },
          required: ["userId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    loanApplicationId: { type: "string" },
                    requestedBy: { type: "string" },
                    requestedFrom: { type: "string" },
                    documentType: { type: "string" },
                    description: { type: "string" },
                    isRequired: { type: "string" },
                    status: { type: "string" },
                    fulfilledAt: { type: "string", nullable: true },
                    fulfilledWith: { type: "string", nullable: true },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                  },
                  required: [
                    "id",
                    "loanApplicationId",
                    "requestedBy",
                    "requestedFrom",
                    "documentType",
                    "description",
                    "isRequired",
                    "status",
                    "createdAt",
                    "updatedAt",
                  ],
                },
              },
            },
            required: ["success", "message", "data"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["document-requests"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { userId: targetUserId } = request.params as any;

        const result = await DocumentRequestService.getPendingRequests(targetUserId);

        return reply.send({
          success: true,
          message: "Pending document requests retrieved successfully",
          data: result,
        });
      } catch (error: any) {
        logger.error("Error getting pending document requests:", error);
        if (error?.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({
            error: "Failed to get pending document requests",
            code: "GET_PENDING_DOCUMENT_REQUESTS_FAILED",
          });
      }
    }
  );

  // GET document request by ID
  fastify.get(
    "/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
          },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  loanApplicationId: { type: "string" },
                  requestedBy: { type: "string" },
                  requestedFrom: { type: "string" },
                  documentType: { type: "string" },
                  description: { type: "string" },
                  isRequired: { type: "string" },
                  status: { type: "string" },
                  fulfilledAt: { type: "string", nullable: true },
                  fulfilledWith: { type: "string", nullable: true },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
                required: [
                  "id",
                  "loanApplicationId",
                  "requestedBy",
                  "requestedFrom",
                  "documentType",
                  "description",
                  "isRequired",
                  "status",
                  "createdAt",
                  "updatedAt",
                ],
              },
            },
            required: ["success", "message", "data"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["document-requests"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = request.params as any;

        const result = await DocumentRequestService.getRequest(id);

        return reply.send({
          success: true,
          message: "Document request retrieved successfully",
          data: result,
        });
      } catch (error: any) {
        logger.error("Error getting document request:", error);
        if (error?.statusCode) {
          return reply.code(error.statusCode).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get document request", code: "GET_DOCUMENT_REQUEST_FAILED" });
      }
    }
  );
}
