import { getAuth } from "@clerk/fastify";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db";
import { loanApplications } from "../db/schema";
import { LoanApplicationsModel } from "../modules/loan-applications/loan-applications.model";
import { LoanApplicationsService } from "../modules/loan-applications/loan-applications.service";
import { LoanApplicationTimelineService } from "../modules/loan-applications/loan-applications-timeline.service";
import { KycKybVerificationModel } from "../modules/kyc-kyb-verification/kyc-kyb-verification.model";
import { KycKybVerificationService } from "../modules/kyc-kyb-verification/kyc-kyb-verification.service";
import { EligibilityAssessmentModel } from "../modules/eligibility-assessment/eligibility-assessment.model";
import { EligibilityAssessmentService } from "../modules/eligibility-assessment/eligibility-assessment.service";
import { CreditAssessmentModel } from "../modules/credit-assessment/credit-assessment.model";
import { CreditAssessmentService } from "../modules/credit-assessment/credit-assessment.service";
import { HeadOfCreditReviewModel } from "../modules/head-of-credit-review/head-of-credit-review.model";
import { HeadOfCreditReviewService } from "../modules/head-of-credit-review/head-of-credit-review.service";
import { InternalApprovalCeoModel } from "../modules/internal-approval-ceo/internal-approval-ceo.model";
import { InternalApprovalCeoService } from "../modules/internal-approval-ceo/internal-approval-ceo.service";
import { CommitteeDecisionModel } from "../modules/committee-decision/committee-decision.model";
import { CommitteeDecisionService } from "../modules/committee-decision/committee-decision.service";
import { UserModel } from "../modules/user/user.model";
import { isAdminOrMember, isEntrepreneur, requireAuth, requireRole } from "../utils/authz";
import { logger } from "../utils/logger";

export async function loanApplicationsRoutes(fastify: FastifyInstance) {
  // CREATE loan application
  // Accessible to: admins/members (can create for any business) OR entrepreneurs (can only create for themselves)
  fastify.post(
    "/",
    {
      schema: {
        body: LoanApplicationsModel.CreateLoanApplicationBodySchema,
        response: {
          201: LoanApplicationsModel.CreateLoanApplicationResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require authentication (but not specific role - entrepreneurs can create their own)
        await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await LoanApplicationsService.create(
          userId,
          request.body as LoanApplicationsModel.CreateLoanApplicationBody
        );
        return reply.code(201).send(result);
      } catch (error: any) {
        logger.error("Error creating loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to create loan application",
          code: "CREATE_LOAN_APPLICATION_FAILED",
        });
      }
    }
  );

  // LIST loan applications with optional filtering
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

            // Search
            search: { type: "string", minLength: 1, maxLength: 200 },

            // Filters
            status: { type: "string", enum: LoanApplicationsModel.LoanApplicationStatusEnum },
            loanProduct: { type: "string", minLength: 1, maxLength: 200 },
            loanSource: { type: "string", minLength: 1, maxLength: 100 },

            // Date Filters
            applicationDate: {
              type: "string",
              enum: ["today", "this_week", "this_month", "last_month", "this_year"],
            },
            createdAtFrom: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
            createdAtTo: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },

            // Sorting
            sortBy: {
              type: "string",
              enum: ["createdAt", "applicationNumber", "applicantName", "amount"],
            },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
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
                    loanId: { type: "string" },
                    loanSource: { type: "string" },
                    businessName: { type: "string" },
                    entrepreneurId: { type: "string" },
                    businessId: { type: "string" },
                    applicant: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                        avatar: { type: "string" },
                      },
                      required: ["name", "email", "phone"],
                    },
                    loanProduct: { type: "string" },
                    loanProductId: { type: "string" },
                    loanRequested: { type: "number" },
                    loanCurrency: { type: "string" },
                    loanTenure: { type: "number" },
                    status: {
                      type: "string",
                      enum: LoanApplicationsModel.LoanApplicationStatusEnum,
                    },
                    createdAt: { type: "string" },
                    createdBy: { type: "string" },
                    lastUpdated: { type: "string" },
                  },
                  required: [
                    "id",
                    "loanId",
                    "loanSource",
                    "businessName",
                    "entrepreneurId",
                    "businessId",
                    "applicant",
                    "loanProduct",
                    "loanProductId",
                    "loanRequested",
                    "loanCurrency",
                    "loanTenure",
                    "status",
                    "createdAt",
                    "createdBy",
                    "lastUpdated",
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
        tags: ["loan-applications"],
      },
      preValidation: async (request: FastifyRequest, _reply: FastifyReply) => {
        // Normalize duplicate query parameters (arrays) to their first value
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
        await requireRole(request, "member");
        const query = request.query as LoanApplicationsModel.ListLoanApplicationsQuery;
        const result = await LoanApplicationsService.list(query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing loan applications:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to list loan applications",
          code: "LIST_LOAN_APPLICATIONS_FAILED",
        });
      }
    }
  );

  // GET loan application statistics
  fastify.get(
    "/stats",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            // Filters (same as list endpoint)
            status: { type: "string", enum: LoanApplicationsModel.LoanApplicationStatusEnum },
            loanProduct: { type: "string", minLength: 1, maxLength: 200 },
            loanSource: { type: "string", minLength: 1, maxLength: 100 },
            applicationDate: {
              type: "string",
              enum: ["today", "this_week", "this_month", "last_month", "this_year"],
            },
            createdAtFrom: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
            createdAtTo: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              totalApplications: { type: "number" },
              totalAmount: { type: "number" },
              averageAmount: { type: "number" },
              pendingApproval: { type: "number" },
              approved: { type: "number" },
              rejected: { type: "number" },
              disbursed: { type: "number" },
              cancelled: { type: "number" },
              totalApplicationsChange: { type: "number" },
              totalAmountChange: { type: "number" },
              pendingApprovalChange: { type: "number" },
              approvedChange: { type: "number" },
              rejectedChange: { type: "number" },
              disbursedChange: { type: "number" },
              cancelledChange: { type: "number" },
            },
            required: [
              "totalApplications",
              "totalAmount",
              "averageAmount",
              "pendingApproval",
              "approved",
              "rejected",
              "disbursed",
              "cancelled",
            ],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
      preValidation: async (request: FastifyRequest, _reply: FastifyReply) => {
        // Normalize duplicate query parameters (arrays) to their first value
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
        await requireRole(request, "member");
        const query = request.query as LoanApplicationsModel.LoanApplicationStatsQuery;
        const result = await LoanApplicationsService.getStats(query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application statistics:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get loan application statistics",
          code: "GET_LOAN_APPLICATION_STATS_FAILED",
        });
      }
    }
  );

  // GET loan application by ID
  // Accessible to: admins/members (can view any) OR entrepreneurs (can only view their own)
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
          200: LoanApplicationsModel.LoanApplicationDetailSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require authentication (but not specific role - entrepreneurs can access their own)
        const user = await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};

        // Get the application first to check authorization
        const [application] = await db
          .select()
          .from(loanApplications)
          .where(and(eq(loanApplications.id, id), isNull(loanApplications.deletedAt)))
          .limit(1);

        if (!application) {
          return reply.code(404).send({
            error: "Loan application not found",
            code: "LOAN_APPLICATION_NOT_FOUND",
          });
        }

        // Check if user is entrepreneur and if so, verify they own this application
        if (isEntrepreneur(user)) {
          if (application.entrepreneurId !== user.id) {
            return reply.code(403).send({
              error: "You do not have permission to view this loan application",
              code: "FORBIDDEN",
            });
          }
        } else {
          // Admin/member - require role
          await requireRole(request, "member");
        }

        const result = await LoanApplicationsService.getById(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get loan application",
          code: "GET_LOAN_APPLICATION_FAILED",
        });
      }
    }
  );

  // GET loan application documents (loan documents + term sheet url)
  // Accessible to: admins/members (can view any) OR entrepreneurs (can only view their own)
  fastify.get(
    "/:id/documents",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: LoanApplicationsModel.GetLoanDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = await requireAuth(request);

        const { id } = (request.params as any) || {};

        const application = await db.query.loanApplications.findFirst({
          where: and(eq(loanApplications.id, id), isNull(loanApplications.deletedAt)),
          columns: {
            entrepreneurId: true,
          },
        });

        if (!application) {
          return reply.code(404).send({
            error: "Loan application not found",
            code: "LOAN_APPLICATION_NOT_FOUND",
          });
        }

        if (isEntrepreneur(user)) {
          if (application.entrepreneurId !== user.id) {
            return reply.code(403).send({
              error: "You do not have permission to view these documents",
              code: "FORBIDDEN",
            });
          }
        } else {
          await requireRole(request, "member");
        }

        const result = await LoanApplicationsService.getLoanDocuments(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get loan application documents",
          code: "GET_LOAN_APPLICATION_DOCUMENTS_FAILED",
        });
      }
    }
  );

  // GET loan application timeline
  // Accessible to: admins/members OR entrepreneurs (for their own applications)
  fastify.get(
    "/:id/timeline",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: LoanApplicationsModel.TimelineResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require authentication (but not specific role - entrepreneurs can access their own)
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        // Pass clerkId for authorization check - service will verify user has access
        const result = await LoanApplicationTimelineService.getTimeline(id, userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application timeline:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get loan application timeline",
          code: "GET_TIMELINE_FAILED",
        });
      }
    }
  );

  // GET my loan application timeline (for entrepreneurs)
  // Accessible to: entrepreneurs (can only see timeline for their own applications)
  fastify.get(
    "/my-applications/:id/timeline",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: LoanApplicationsModel.TimelineResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require authentication
        const user = await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        // Verify user is an entrepreneur (not admin)
        if (isAdminOrMember(user)) {
          return reply.code(403).send({
            error: "This endpoint is for entrepreneurs only. Admins should use /:id/timeline",
            code: "FORBIDDEN",
          });
        }

        const { id } = (request.params as any) || {};
        // Pass clerkId for authorization check - service will verify user owns the application
        const result = await LoanApplicationTimelineService.getTimeline(id, userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application timeline:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get loan application timeline",
          code: "GET_TIMELINE_FAILED",
        });
      }
    }
  );

  // PUT update loan application status
  fastify.put(
    "/:id/status",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: LoanApplicationsModel.UpdateStatusBodySchema,
        response: {
          200: LoanApplicationsModel.LoanApplicationDetailSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
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
        const { status, reason, rejectionReason } =
          request.body as LoanApplicationsModel.UpdateStatusBody;

        const result = await LoanApplicationsService.updateStatus(
          userId,
          id,
          status,
          reason,
          rejectionReason,
          request
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating loan application status:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to update loan application status",
          code: "UPDATE_STATUS_FAILED",
        });
      }
    }
  );

  // PATCH create counter-offer for loan application
  // Accessible to: admins/members only
  fastify.patch(
    "/:id/counter-offer",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: LoanApplicationsModel.CreateCounterOfferBodySchema,
        response: {
          200: LoanApplicationsModel.LoanApplicationDetailSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
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
        const body = request.body as LoanApplicationsModel.CreateCounterOfferBody;

        const result = await LoanApplicationsService.createCounterOffer(userId, id, body);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error creating counter-offer:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to create counter-offer",
          code: "CREATE_COUNTER_OFFER_FAILED",
        });
      }
    }
  );

  // GET loan applications list for external users (entrepreneurs)
  // Accessible to: entrepreneurs (can only see their own applications)
  fastify.get(
    "/my-applications",
    {
      schema: {
        querystring: LoanApplicationsModel.ExternalLoanApplicationListQuerySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  applications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        loanId: { type: "string" },
                        product: { type: "string" },
                        requestedAmount: { type: "string" },
                        currency: { type: "string" },
                        tenure: { type: "string" },
                        status: { type: "string" },
                        appliedOn: { type: "string" },
                      },
                      required: [
                        "id",
                        "loanId",
                        "product",
                        "requestedAmount",
                        "currency",
                        "tenure",
                        "status",
                        "appliedOn",
                      ],
                    },
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      currentPage: { type: "number" },
                      totalPages: { type: "number" },
                      totalItems: { type: "number" },
                      itemsPerPage: { type: "number" },
                      hasNextPage: { type: "boolean" },
                      hasPreviousPage: { type: "boolean" },
                    },
                    required: [
                      "currentPage",
                      "totalPages",
                      "totalItems",
                      "itemsPerPage",
                      "hasNextPage",
                      "hasPreviousPage",
                    ],
                  },
                },
                required: ["applications", "pagination"],
              },
            },
            required: ["success", "message", "data"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
      preValidation: async (request: FastifyRequest, _reply: FastifyReply) => {
        // Normalize duplicate query parameters (arrays) to their first value
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
        await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const query = request.query as LoanApplicationsModel.ExternalLoanApplicationListQuery;
        const result = await LoanApplicationsService.listForEntrepreneur(userId, query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing loan applications for entrepreneur:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to list loan applications",
          code: "LIST_LOAN_APPLICATIONS_FAILED",
        });
      }
    }
  );

  // GET loan application detail for external users (entrepreneurs)
  // Accessible to: entrepreneurs (can only see their own applications)
  fastify.get(
    "/my-applications/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
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
                  loanId: { type: "string" },
                  product: { type: "string" },
                  requestedAmount: { type: "string" },
                  currency: { type: "string" },
                  tenure: { type: "string" },
                  status: { type: "string" },
                  appliedOn: { type: "string" },
                  fundingAmount: { type: "number" },
                  repaymentPeriod: { type: "number" },
                  termUnit: { type: "string" },
                  intendedUseOfFunds: { type: "string" },
                  interestRate: { type: "number" },
                  submittedAt: { type: "string" },
                  approvedAt: { type: "string" },
                  rejectedAt: { type: "string" },
                  disbursedAt: { type: "string" },
                  cancelledAt: { type: "string" },
                  rejectionReason: { type: "string" },
                },
                required: [
                  "id",
                  "loanId",
                  "product",
                  "requestedAmount",
                  "currency",
                  "tenure",
                  "status",
                  "appliedOn",
                ],
              },
            },
            required: ["success", "message", "data"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const result = await LoanApplicationsService.getByIdForEntrepreneur(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application for entrepreneur:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get loan application",
          code: "GET_LOAN_APPLICATION_FAILED",
        });
      }
    }
  );

  // POST cancel my loan application (for entrepreneurs)
  // Accessible to: entrepreneurs (can only cancel their own applications)
  fastify.post(
    "/my-applications/:id/cancel",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: LoanApplicationsModel.CancelLoanApplicationBodySchema,
        response: {
          200: LoanApplicationsModel.LoanApplicationDetailSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require authentication
        const user = await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        // Verify user is an entrepreneur (not admin)
        if (isAdminOrMember(user)) {
          return reply.code(403).send({
            error: "This endpoint is for entrepreneurs only. Admins should use /:id/cancel",
            code: "FORBIDDEN",
          });
        }

        const { id } = (request.params as any) || {};
        const body = (request.body as LoanApplicationsModel.CancelLoanApplicationBody) || {};
        const reason = body.reason;

        // Cancel the application (isAdminOrMember = false for entrepreneurs)
        const result = await LoanApplicationsService.cancel(userId, id, reason, false, request);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error cancelling loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to cancel loan application",
          code: "CANCEL_LOAN_APPLICATION_FAILED",
        });
      }
    }
  );

  // POST cancel loan application (for admins/members)
  // Accessible to: admins/members (can cancel any application)
  fastify.post(
    "/:id/cancel",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: LoanApplicationsModel.CancelLoanApplicationBodySchema,
        response: {
          200: LoanApplicationsModel.LoanApplicationDetailSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require authentication
        const user = await requireAuth(request);
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = (request.body as LoanApplicationsModel.CancelLoanApplicationBody) || {};
        const reason = body.reason;

        // Check if user is admin/member or entrepreneur
        const isAdminOrMemberUser = isAdminOrMember(user);

        // Cancel the application
        const result = await LoanApplicationsService.cancel(
          userId,
          id,
          reason,
          isAdminOrMemberUser,
          request
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error cancelling loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to cancel loan application",
          code: "CANCEL_LOAN_APPLICATION_FAILED",
        });
      }
    }
  );

  // ========== KYC/KYB VERIFICATION ENDPOINTS ==========

  // GET /loan-applications/:id/kyc-kyb-documents
  // Get all documents with verification status for a loan application
  // Accessible to: admins/members only
  fastify.get(
    "/:id/kyc-kyb-documents",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              personalDocuments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    docType: { type: "string" },
                    docUrl: { type: "string" },
                    docYear: { type: "number" },
                    docBankName: { type: "string" },
                    createdAt: { type: "string" },
                    verificationStatus: {
                      type: "string",
                      enum: ["pending", "approved", "rejected"],
                    },
                    verifiedBy: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        firstName: { type: "string", nullable: true },
                        lastName: { type: "string", nullable: true },
                        email: { type: "string" },
                      },
                    },
                    verifiedAt: { type: "string" },
                    rejectionReason: { type: "string" },
                    notes: { type: "string" },
                    lockedAt: { type: "string" },
                  },
                },
              },
              businessDocuments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    docType: { type: "string" },
                    docUrl: { type: "string" },
                    docYear: { type: "number" },
                    docBankName: { type: "string" },
                    createdAt: { type: "string" },
                    verificationStatus: {
                      type: "string",
                      enum: ["pending", "approved", "rejected"],
                    },
                    verifiedBy: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        firstName: { type: "string", nullable: true },
                        lastName: { type: "string", nullable: true },
                        email: { type: "string" },
                      },
                    },
                    verifiedAt: { type: "string" },
                    rejectionReason: { type: "string" },
                    notes: { type: "string" },
                    lockedAt: { type: "string" },
                  },
                },
              },
              summary: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  pending: { type: "number" },
                  approved: { type: "number" },
                  rejected: { type: "number" },
                },
              },
            },
            required: ["personalDocuments", "businessDocuments", "summary"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "kyc-kyb-verification"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const result = await KycKybVerificationService.getDocumentsForVerification(id);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting KYC/KYB documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to get KYC/KYB documents",
          code: "GET_KYC_KYB_DOCUMENTS_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/documents/:documentId/verify
  // Verify a single document (approve or reject)
  // Accessible to: admins/members only
  fastify.post(
    "/:id/documents/:documentId/verify",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
            documentId: { type: "string", minLength: 1 },
          },
          required: ["id", "documentId"],
          additionalProperties: false,
        },
        querystring: {
          type: "object",
          properties: {
            documentType: { type: "string", enum: ["personal", "business"] },
          },
          required: ["documentType"],
          additionalProperties: false,
        },
        body: KycKybVerificationModel.VerifyDocumentBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              documentType: { type: "string", enum: ["personal", "business"] },
              verificationStatus: { type: "string", enum: ["pending", "approved", "rejected"] },
              verifiedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
              },
              verifiedAt: { type: "string" },
              rejectionReason: { type: "string" },
              notes: { type: "string" },
              lockedAt: { type: "string" },
            },
            required: [
              "documentId",
              "documentType",
              "verificationStatus",
              "verifiedBy",
              "verifiedAt",
              "lockedAt",
            ],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "kyc-kyb-verification"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id, documentId } = (request.params as any) || {};
        const { documentType } = (request.query as any) || {};
        const body = request.body as KycKybVerificationModel.VerifyDocumentBody;

        if (!documentType || (documentType !== "personal" && documentType !== "business")) {
          return reply.code(400).send({
            error: "documentType query parameter is required and must be 'personal' or 'business'",
            code: "MISSING_DOCUMENT_TYPE",
          });
        }

        const result = await KycKybVerificationService.verifyDocument(
          id,
          documentId,
          documentType as "personal" | "business",
          userId,
          body
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error verifying document:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to verify document",
          code: "VERIFY_DOCUMENT_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/kyc-kyb/bulk-verify
  // Bulk verify multiple documents
  // Accessible to: admins/members only
  fastify.post(
    "/:id/kyc-kyb/bulk-verify",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: KycKybVerificationModel.BulkVerifyDocumentsBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              successful: { type: "number" },
              failed: { type: "number" },
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    documentId: { type: "string" },
                    success: { type: "boolean" },
                    error: { type: "string" },
                  },
                  required: ["documentId", "success"],
                },
              },
            },
            required: ["successful", "failed", "results"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "kyc-kyb-verification"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = request.body as KycKybVerificationModel.BulkVerifyDocumentsBody;

        const result = await KycKybVerificationService.bulkVerifyDocuments(id, userId, body);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error bulk verifying documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to bulk verify documents",
          code: "BULK_VERIFY_DOCUMENTS_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/kyc-kyb/complete
  // Complete KYC/KYB verification step
  // Accessible to: admins/members only
  fastify.post(
    "/:id/kyc-kyb/complete",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: LoanApplicationsModel.CompleteKycKybRequestBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              loanApplicationId: { type: "string" },
              status: { type: "string" },
              completedAt: { type: "string" },
              completedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
              },
            },
            required: ["loanApplicationId", "status", "completedAt", "completedBy"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "kyc-kyb-verification"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = (request.body as LoanApplicationsModel.CompleteKycKybRequestBody) || undefined;
        const result = await KycKybVerificationService.completeKycKybVerification(
          id,
          userId,
          body?.nextApprover
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error completing KYC/KYB verification:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to complete KYC/KYB verification",
          code: "COMPLETE_KYC_KYB_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/eligibility-assessment/complete
  // Complete eligibility assessment step
  // Accessible to: admins/members only
  fastify.post(
    "/:id/eligibility-assessment/complete",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: EligibilityAssessmentModel.CompleteEligibilityAssessmentBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              loanApplicationId: { type: "string" },
              status: { type: "string" },
              completedAt: { type: "string" },
              completedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
                required: ["id", "email"],
              },
              eligibilityAssessmentComment: { type: "string" },
              supportingDocuments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    docUrl: { type: "string" },
                    docName: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["id", "docUrl"],
                },
              },
            },
            required: [
              "loanApplicationId",
              "status",
              "completedAt",
              "completedBy",
              "eligibilityAssessmentComment",
              "supportingDocuments",
            ],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "eligibility-assessment"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = request.body as EligibilityAssessmentModel.CompleteEligibilityAssessmentBody;
        const result = await EligibilityAssessmentService.completeEligibilityAssessment(
          id,
          userId,
          body
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error completing eligibility assessment:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to complete eligibility assessment",
          code: "COMPLETE_ELIGIBILITY_ASSESSMENT_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/credit-assessment/complete
  // Complete credit assessment step
  // Accessible to: admins/members only
  fastify.post(
    "/:id/credit-assessment/complete",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: CreditAssessmentModel.CompleteCreditAssessmentBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              loanApplicationId: { type: "string" },
              status: { type: "string" },
              completedAt: { type: "string" },
              completedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
                required: ["id", "email"],
              },
              creditAssessmentComment: { type: "string" },
              supportingDocuments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    docUrl: { type: "string" },
                    docName: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["id", "docUrl"],
                },
              },
            },
            required: [
              "loanApplicationId",
              "status",
              "completedAt",
              "completedBy",
              "creditAssessmentComment",
              "supportingDocuments",
            ],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "credit-assessment"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = request.body as CreditAssessmentModel.CompleteCreditAssessmentBody;
        const result = await CreditAssessmentService.completeCreditAssessment(id, userId, body);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error completing credit assessment:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to complete credit assessment",
          code: "COMPLETE_CREDIT_ASSESSMENT_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/head-of-credit-review/complete
  // Complete head of credit review step
  // Accessible to: admins/members only
  fastify.post(
    "/:id/head-of-credit-review/complete",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: HeadOfCreditReviewModel.CompleteHeadOfCreditReviewBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              loanApplicationId: { type: "string" },
              status: { type: "string" },
              completedAt: { type: "string" },
              completedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
                required: ["id", "email"],
              },
              headOfCreditReviewComment: { type: "string" },
              supportingDocuments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    docUrl: { type: "string" },
                    docName: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["id", "docUrl"],
                },
              },
            },
            required: [
              "loanApplicationId",
              "status",
              "completedAt",
              "completedBy",
              "headOfCreditReviewComment",
              "supportingDocuments",
            ],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "head-of-credit-review"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = request.body as HeadOfCreditReviewModel.CompleteHeadOfCreditReviewBody;
        const result = await HeadOfCreditReviewService.completeHeadOfCreditReview(id, userId, body);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error completing head of credit review:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to complete head of credit review",
          code: "COMPLETE_HEAD_OF_CREDIT_REVIEW_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/internal-approval-ceo/complete
  // Complete internal approval CEO step
  // Accessible to: admins/members only
  fastify.post(
    "/:id/internal-approval-ceo/complete",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: InternalApprovalCeoModel.CompleteInternalApprovalCeoBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              loanApplicationId: { type: "string" },
              status: { type: "string" },
              completedAt: { type: "string" },
              completedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
                required: ["id", "email"],
              },
              internalApprovalCeoComment: { type: "string" },
              supportingDocuments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    docUrl: { type: "string" },
                    docName: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["id", "docUrl"],
                },
              },
            },
            required: [
              "loanApplicationId",
              "status",
              "completedAt",
              "completedBy",
              "internalApprovalCeoComment",
              "supportingDocuments",
            ],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "internal-approval-ceo"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = request.body as InternalApprovalCeoModel.CompleteInternalApprovalCeoBody;
        const result = await InternalApprovalCeoService.completeInternalApprovalCeo(
          id,
          userId,
          body
        );

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error completing internal approval CEO:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to complete internal approval CEO",
          code: "COMPLETE_INTERNAL_APPROVAL_CEO_FAILED",
        });
      }
    }
  );

  // POST /loan-applications/:id/committee-decision/complete
  // Complete committee decision step (upload term sheet)
  // Accessible to: admins/members only
  fastify.post(
    "/:id/committee-decision/complete",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
          additionalProperties: false,
        },
        body: CommitteeDecisionModel.CompleteCommitteeDecisionBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              loanApplicationId: { type: "string" },
              status: { type: "string" },
              termSheetUrl: { type: "string" },
              uploadedAt: { type: "string" },
              uploadedBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  email: { type: "string" },
                },
                required: ["id", "email"],
              },
            },
            required: ["loanApplicationId", "status", "termSheetUrl", "uploadedAt", "uploadedBy"],
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          403: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "committee-decision"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Require admin/member role
        await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }

        const { id } = (request.params as any) || {};
        const body = request.body as CommitteeDecisionModel.CompleteCommitteeDecisionBody;
        const result = await CommitteeDecisionService.completeCommitteeDecision(id, userId, body);

        return reply.send(result);
      } catch (error: any) {
        logger.error("Error completing committee decision:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply.code(500).send({
          error: "Failed to complete committee decision",
          code: "COMPLETE_COMMITTEE_DECISION_FAILED",
        });
      }
    }
  );
}
