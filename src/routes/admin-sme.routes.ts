import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { AdminSMEService } from "../modules/admin-sme/admin-sme.service";
import { AdminSMEModel } from "../modules/admin-sme/admin-sme.model";
import { requireRole } from "../utils/authz";
import { logger } from "../utils/logger";
import { AdminSMEAuditService } from "../modules/admin-sme/admin-sme-audit.service";
import type { AdminSMEAuditAction } from "../db/schema/adminSMEAuditTrail";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Helper to build audit details object
 * Only includes properties that actually exist in the source object (handles partial updates)
 * Supports field mapping (e.g., { sourceField: 'targetField' }) and computed values
 */
function buildAuditDetails(
  source: Record<string, any>,
  config: {
    // Direct field mappings: source field name -> target field name (or same if string)
    fields?: string[] | Record<string, string>;
    // Computed fields: function that returns a value if condition is met
    computed?: Array<{
      key: string;
      value: any;
      condition?: (source: Record<string, any>) => boolean;
    }>;
  },
): Record<string, any> | undefined {
  const details: Record<string, any> = {};

  // Handle direct field mappings
  if (config.fields) {
    if (Array.isArray(config.fields)) {
      // Simple array: include field if it exists in source
      for (const field of config.fields) {
        if (field in source) {
          details[field] = source[field];
        }
      }
    } else {
      // Object mapping: { sourceField: 'targetField' }
      for (const [sourceField, targetField] of Object.entries(config.fields)) {
        if (sourceField in source) {
          details[targetField] = source[sourceField];
        }
      }
    }
  }

  // Handle computed fields
  if (config.computed) {
    for (const computed of config.computed) {
      if (!computed.condition || computed.condition(source)) {
        details[computed.key] = computed.value;
      }
    }
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

async function logAdminAction(
  request: FastifyRequest,
  smeUserId: string,
  action: AdminSMEAuditAction,
  description?: string,
  details?: Record<string, any>,
): Promise<void> {
  try {
    const { userId: adminClerkId } = getAuth(request);
    if (!adminClerkId) return;

    const metadata = AdminSMEAuditService.extractRequestMetadata(request);
    
    await AdminSMEAuditService.logAction({
      adminClerkId,
      smeUserId,
      action,
      description,
      details,
      ...metadata,
    });
  } catch (error: any) {
    // Non-blocking: don't fail the request if audit logging fails
    logger.warn("[AdminSME Routes] Failed to log audit action", {
      error: error?.message,
      action,
      smeUserId,
    });
  }
}

export async function adminSMERoutes(fastify: FastifyInstance) {
  // GET /admin/sme/entrepreneurs/stats - Stats for entrepreneurs
  fastify.get(
    "/admin/sme/entrepreneurs/stats",
    {
      schema: {
        response: {
          200: AdminSMEModel.EntrepreneursStatsResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.getEntrepreneursStats();
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error getting entrepreneurs stats", {
          error: error?.message,
        });
        return reply.code(status).send({
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR",
        });
      }
    },
  );

  // PUT /admin/sme/users/:userId/details - Update entrepreneur details (consolidated)
  fastify.put(
    "/admin/sme/users/:userId/details",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.UpdateEntrepreneurDetailsBodySchema,
        response: {
          200: AdminSMEModel.UpdateEntrepreneurDetailsResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          404: AdminSMEModel.ErrorResponseSchema,
          409: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: AdminSMEModel.UpdateEntrepreneurDetailsBody;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.updateEntrepreneurDetails(
          request.params.userId,
          request.body,
        );
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: ["email", "firstName", "lastName", "phone", "gender", "position", "idType"],
          computed: [
            { key: "hasIdNumber", value: !!request.body.idNumber, condition: (src) => "idNumber" in src },
            { key: "hasTaxNumber", value: !!request.body.taxNumber, condition: (src) => "taxNumber" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "user_details_updated",
          `Updated entrepreneur details for ${request.body.email}`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error updating entrepreneur details", {
          error: error?.message,
          userId: request.params.userId,
        });
        return reply.code(status).send({
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR",
        });
      }
    },
  );

  // PUT /admin/sme/users/:userId/financial-details - Save financial details
  fastify.put(
    "/admin/sme/users/:userId/financial-details",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.SaveFinancialDetailsBodySchema,
        response: {
          200: { type: "object" }, // OnboardingStateResponse
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          404: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: AdminSMEModel.SaveFinancialDetailsBody;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.saveFinancialDetails(
          request.params.userId,
          request.body,
        );
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: [
            "averageMonthlyTurnover",
            "averageYearlyTurnover",
            "previousLoans",
            "loanAmount",
            "defaultCurrency",
            "recentLoanStatus",
          ],
          computed: [
            { key: "hasDefaultReason", value: !!request.body.defaultReason, condition: (src) => "defaultReason" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "financial_details_updated",
          `Updated financial details`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error saving financial details", {
          error: error?.message,
        });
        return reply.code(status).send({
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR",
        });
      }
    },
  );

  // GET /admin/sme/entrepreneurs - List entrepreneurs for admin table
  fastify.get(
    "/admin/sme/entrepreneurs",
    {
      schema: {
        querystring: AdminSMEModel.ListSMEUsersQuerySchema,
        response: {
          200: AdminSMEModel.EntrepreneurListResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (
      request: FastifyRequest<{ Querystring: AdminSMEModel.ListSMEUsersQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.listEntrepreneurs(request.query);
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error listing entrepreneurs", {
          error: error?.message,
        });
        return reply.code(status).send({
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR",
        });
      }
    },
  );

  // GET /admin/sme/users - List all SME users
  fastify.get(
    "/admin/sme/users",
    {
      schema: {
        querystring: AdminSMEModel.ListSMEUsersQuerySchema,
        response: {
          200: AdminSMEModel.ListSMEUsersResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Querystring: AdminSMEModel.ListSMEUsersQuery }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.listSMEUsers(request.query);
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error listing SME users", { error: error?.message });
        return reply.code(status).send({ 
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR"
        });
      }
    }
  );

  // GET /admin/sme/users/:userId - Get single SME user detail
  fastify.get(
    "/admin/sme/users/:userId",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        response: {
          200: AdminSMEModel.GetSMEUserDetailResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          404: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.getSMEUserDetail(request.params.userId);
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error getting SME user detail", { error: error?.message });
        return reply.code(status).send({ 
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR"
        });
      }
    }
  );

  // POST /admin/sme/onboarding/start - Create user (Step 1)
  fastify.post(
    "/admin/sme/onboarding/start",
    {
      schema: {
        body: AdminSMEModel.Step1UserInfoBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              userId: { type: "string" },
              onboardingState: { type: "object" },
            },
            required: ["userId", "onboardingState"],
          },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Body: AdminSMEModel.Step1UserInfoBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member"); // admin, super-admin, or member can create SMEs
        const result = await AdminSMEService.createSMEUser(request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: ["email", "firstName", "lastName", "phone", "gender", "position"],
        });
        
        logAdminAction(
          request,
          result.userId,
          "user_created",
          `Created SME user: ${request.body.email}`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error in start onboarding", { error: error?.message });
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/1 - Save Step 1
  fastify.put(
    "/admin/sme/onboarding/:userId/step/1",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step1UserInfoBodySchema,
        response: {
          200: { type: "object" }, // OnboardingStateResponse
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step1UserInfoBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.updateSMEUser(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: ["email", "firstName", "lastName", "phone", "gender", "position"],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_1_saved",
          `Updated user information for ${request.body.email}`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/2 - Save Step 2
  fastify.put(
    "/admin/sme/onboarding/:userId/step/2",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step2BusinessBasicInfoBodySchema,
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step2BusinessBasicInfoBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.saveBusinessBasicInfo(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: {
            name: "businessName",
            entityType: "entityType",
            year: "yearOfIncorporation",
            sectors: "sectors",
            userGroupId: "userGroupId",
            criteria: "criteria",
            noOfEmployees: "noOfEmployees",
          },
          computed: [
            { key: "hasDescription", value: !!request.body.description, condition: (src) => "description" in src },
            { key: "hasWebsite", value: !!request.body.website, condition: (src) => "website" in src },
            { key: "hasLogo", value: !!request.body.logo, condition: (src) => "logo" in src },
            { key: "videoLinkCount", value: request.body.videoLinks?.length || 0, condition: (src) => "videoLinks" in src },
            { key: "businessPhotoCount", value: request.body.businessPhotos?.length || 0, condition: (src) => "businessPhotos" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_2_saved",
          `Saved business basic info: ${request.body.name || "N/A"}`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/3 - Save Step 3
  fastify.put(
    "/admin/sme/onboarding/:userId/step/3",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step3LocationInfoBodySchema,
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step3LocationInfoBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.saveLocationInfo(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: ["countriesOfOperation", "companyHQ", "city", "registeredOfficeCity", "registeredOfficeZipCode"],
          computed: [
            { key: "hasRegisteredOfficeAddress", value: !!request.body.registeredOfficeAddress, condition: (src) => "registeredOfficeAddress" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_3_saved",
          `Saved location info`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/4 - Save Step 4
  fastify.put(
    "/admin/sme/onboarding/:userId/step/4",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step4PersonalDocumentsBodySchema,
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step4PersonalDocumentsBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.savePersonalDocuments(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          fields: ["idType"],
          computed: [
            { key: "documentCount", value: request.body.documents?.length || 0, condition: (src) => "documents" in src },
            { key: "documentTypes", value: request.body.documents?.map((d) => d.docType) || [], condition: (src) => "documents" in src },
            { key: "hasIdNumber", value: !!request.body.idNumber, condition: (src) => "idNumber" in src },
            { key: "hasTaxNumber", value: !!request.body.taxNumber, condition: (src) => "taxNumber" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_4_saved",
          `Saved personal documents (${request.body.documents?.length || 0} documents)`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/5 - Save Step 5
  fastify.put(
    "/admin/sme/onboarding/:userId/step/5",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step5CompanyInfoDocumentsBodySchema,
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step5CompanyInfoDocumentsBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.saveCompanyInfoDocuments(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          computed: [
            { key: "documentCount", value: request.body.documents?.length || 0, condition: (src) => "documents" in src },
            { key: "documentTypes", value: request.body.documents?.map((d) => d.docType) || [], condition: (src) => "documents" in src },
            { key: "passwordProtectedCount", value: request.body.documents?.filter((d) => d.isPasswordProtected).length || 0, condition: (src) => "documents" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_5_saved",
          `Saved company info documents (${request.body.documents?.length || 0} documents)`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/6 - Save Step 6
  fastify.put(
    "/admin/sme/onboarding/:userId/step/6",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step6FinancialDocumentsBodySchema,
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step6FinancialDocumentsBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.saveFinancialDocuments(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          computed: [
            { key: "documentCount", value: request.body.documents?.length || 0, condition: (src) => "documents" in src },
            { key: "documentTypes", value: request.body.documents?.map((d) => d.docType) || [], condition: (src) => "documents" in src },
            { key: "passwordProtectedCount", value: request.body.documents?.filter((d) => d.isPasswordProtected).length || 0, condition: (src) => "documents" in src },
            { key: "hasBankName", value: request.body.documents?.some((d) => d.docBankName) || false, condition: (src) => "documents" in src },
            { key: "hasYear", value: request.body.documents?.some((d) => d.docYear) || false, condition: (src) => "documents" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_6_saved",
          `Saved financial documents (${request.body.documents?.length || 0} documents)`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // PUT /admin/sme/onboarding/:userId/step/7 - Save Step 7
  fastify.put(
    "/admin/sme/onboarding/:userId/step/7",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        body: AdminSMEModel.Step7PermitAndPitchDocumentsBodySchema,
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string }; Body: AdminSMEModel.Step7PermitAndPitchDocumentsBody }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.savePermitAndPitchDocuments(request.params.userId, request.body);
        
        // Log audit action (non-blocking)
        const details = buildAuditDetails(request.body, {
          computed: [
            { key: "documentCount", value: request.body.documents?.length || 0, condition: (src) => "documents" in src },
            { key: "documentTypes", value: request.body.documents?.map((d) => d.docType) || [], condition: (src) => "documents" in src },
            { key: "passwordProtectedCount", value: request.body.documents?.filter((d) => d.isPasswordProtected).length || 0, condition: (src) => "documents" in src },
          ],
        });
        
        logAdminAction(
          request,
          request.params.userId,
          "step_7_saved",
          `Saved permits & pitch deck documents (${request.body.documents?.length || 0} documents)`,
          details,
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // GET /admin/sme/onboarding/:userId - Get current onboarding state
  fastify.get(
    "/admin/sme/onboarding/:userId",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          404: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.getOnboardingState(request.params.userId);
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );

  // GET /admin/sme/users/:userId/documents/personal - Get personal documents
  fastify.get(
    "/admin/sme/users/:userId/documents/personal",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        response: {
          200: AdminSMEModel.ListPersonalDocumentsResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          404: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.getPersonalDocuments(request.params.userId);
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error getting personal documents", { error: error?.message });
        return reply.code(status).send({ 
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR"
        });
      }
    }
  );

  // GET /admin/sme/users/:userId/documents/business - Get business documents
  fastify.get(
    "/admin/sme/users/:userId/documents/business",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        response: {
          200: AdminSMEModel.ListBusinessDocumentsResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          404: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.getBusinessDocuments(request.params.userId);
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error getting business documents", { error: error?.message });
        return reply.code(status).send({ 
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR"
        });
      }
    }
  );

  // GET /admin/sme/users/:userId/audit-trail - Get audit trail for SME user
  fastify.get(
    "/admin/sme/users/:userId/audit-trail",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        querystring: AdminSMEModel.ListAuditTrailQuerySchema,
        response: {
          200: AdminSMEModel.ListAuditTrailResponseSchema,
          400: AdminSMEModel.ErrorResponseSchema,
          401: AdminSMEModel.ErrorResponseSchema,
          403: AdminSMEModel.ErrorResponseSchema,
          404: AdminSMEModel.ErrorResponseSchema,
          500: AdminSMEModel.ErrorResponseSchema,
        },
        tags: ["admin-sme"],
      },
    },
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Querystring: AdminSMEModel.ListAuditTrailQuery;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        await requireRole(request, "member");
        const result = await AdminSMEService.getAuditTrail(
          request.params.userId,
          request.query,
        );
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        logger.error("[AdminSME Routes] Error getting audit trail", {
          error: error?.message,
          userId: request.params.userId,
        });
        return reply.code(status).send({
          error: error?.message || "Internal error",
          code: error?.code || "INTERNAL_ERROR",
        });
      }
    },
  );

  // POST /admin/sme/onboarding/:userId/invite - Send/Resend invitation
  fastify.post(
    "/admin/sme/onboarding/:userId/invite",
    {
      schema: {
        params: AdminSMEModel.UserIdParamsSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              invitationId: { type: "string" },
              message: { type: "string" },
            },
            required: ["success", "invitationId"],
          },
          400: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          401: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          403: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
          500: { type: "object", properties: { error: { type: "string" } }, required: ["error"] },
        },
        tags: ["admin-sme"],
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      try {
        const current = await requireRole(request, "member");
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const result = await AdminSMEService.sendSMEInvitation(request.params.userId, userId);
        
        // Log audit action (check if it's a resend by checking onboarding status)
        const smeUser = await db.query.users.findFirst({
          where: eq(users.id, request.params.userId),
          columns: { onboardingStatus: true, email: true },
        });
        const isResend = smeUser?.onboardingStatus === "pending_invitation";
        const smeEmail = smeUser?.email || "Unknown";
        
        // Log audit action (non-blocking)
        logAdminAction(
          request,
          request.params.userId,
          isResend ? "invitation_resent" : "invitation_sent",
          isResend ? `Resent invitation to SME user (${smeEmail})` : `Sent invitation to SME user (${smeEmail})`,
          {
            invitationId: result.invitationId,
            email: smeEmail,
            isResend,
          },
        ).catch((err) => logger.error("[AdminSME] Audit log error", { error: err }));
        
        return reply.send(result);
      } catch (error: any) {
        const status = error?.status || 500;
        return reply.code(status).send({ error: error?.message || "Internal error" });
      }
    }
  );
}

