import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { businessProfiles } from "../../db/schema";
import { businessDocumentTypeEnum, businessDocuments } from "../../db/schema";
import { logger } from "../../utils/logger";
import { DocumentRequestService } from "../document-requests/document-request.service";
import type { BusinessDocumentsModel } from "./business-documents.model";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class BusinessDocuments {
  /**
   * Upsert one or more business documents for a business owned by the current user.
   * If a document with the same composite keys (businessId, docType, docYear, docBankName)
   * exists and is active, it will be updated, else inserted.
   */
  static async upsert(
    clerkId: string,
    businessId: string,
    input: BusinessDocumentsModel.AddDocumentsBody
  ): Promise<BusinessDocumentsModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Resolve internal user by clerkId
      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Ensure business exists and belongs to the user
      const biz = await db.query.businessProfiles.findFirst({
        where: and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, user.id)),
        columns: { id: true },
      });
      if (!biz) throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");

      // Normalize to array
      const docsArray = Array.isArray(input) ? input : [input];

      // Coerce: ensure boolean default
      const normalized = docsArray.map((d) => ({
        docType: d.docType,
        docUrl: d.docUrl,
        isPasswordProtected: !!d.isPasswordProtected,
        docPassword: d.docPassword ?? null,
        docBankName: d.docBankName ?? null,
        docYear: typeof d.docYear === "number" ? d.docYear : null,
      }));

      // Validate each item independently of route validation to avoid DB crashes
      for (let i = 0; i < normalized.length; i++) {
        const d = normalized[i];
        const idxInfo = `item ${i}`;

        // Required fields
        if (!d.docType || !businessDocumentTypeEnum.enumValues.includes(d.docType as any)) {
          const received = String(d.docType);
          const allowed = businessDocumentTypeEnum.enumValues.join(", ");
          throw httpError(
            400,
            `[INVALID_DOC_TYPE] ${idxInfo}: docType is required and must be a valid business document type. ` +
              `received="${received}" (len=${received.length}); allowed=[${allowed}]`
          );
        }
        if (!d.docUrl || typeof d.docUrl !== "string" || d.docUrl.length === 0) {
          throw httpError(400, `[INVALID_DOC_URL] ${idxInfo}: docUrl is required`);
        }

        // Conditional rules mirroring JSON Schema (defensive, in case service is called directly)
        if (d.isPasswordProtected && (!d.docPassword || d.docPassword.length === 0)) {
          throw httpError(
            400,
            `[INVALID_DOC_PASSWORD] ${idxInfo}: docPassword is required when isPasswordProtected is true`
          );
        }
        if (d.docType === "audited_financial_statements" && d.docYear === null) {
          throw httpError(
            400,
            `[INVALID_DOC_YEAR] ${idxInfo}: docYear is required for audited_financial_statements`
          );
        }
        if (
          d.docType === "annual_bank_statement" &&
          (d.docYear === null || d.docBankName === null)
        ) {
          throw httpError(
            400,
            `[INVALID_BANK_STATEMENT] ${idxInfo}: docYear and docBankName are required for annual_bank_statement`
          );
        }
      }

      await db.transaction(async (tx) => {
        for (const d of normalized) {
          // Try to find existing active matching record by composite keys
          const existing = await tx.query.businessDocuments.findFirst({
            where: and(
              eq(businessDocuments.businessId, businessId),
              eq(businessDocuments.docType, d.docType as any),
              // For nullable keys, equality with null won't match; handle by branches
              d.docYear === null
                ? isNull(businessDocuments.docYear)
                : (eq(businessDocuments.docYear as any, d.docYear) as any),
              d.docBankName === null
                ? isNull(businessDocuments.docBankName)
                : (eq(businessDocuments.docBankName, d.docBankName) as any),
              isNull(businessDocuments.deletedAt)
            ),
            columns: {
              id: true,
              docUrl: true,
              isPasswordProtected: true,
              docPassword: true,
              docBankName: true,
              docYear: true,
            },
          });

          if (existing) {
            // Note: Audit trail logging skipped for standalone business document updates
            // Business documents are logged when they're part of a loan application workflow

            await tx
              .update(businessDocuments)
              .set({
                docUrl: d.docUrl,
                isPasswordProtected: d.isPasswordProtected,
                docPassword: d.docPassword,
                docBankName: d.docBankName,
                docYear: d.docYear as any,
                updatedAt: new Date(),
              })
              .where(eq(businessDocuments.id, existing.id));
          } else {
            // Note: Audit trail logging skipped for standalone business document creation
            // Business documents are logged when they're part of a loan application workflow

            await tx.insert(businessDocuments).values({
              businessId,
              docType: d.docType as any,
              docUrl: d.docUrl,
              isPasswordProtected: d.isPasswordProtected,
              docPassword: d.docPassword,
              docBankName: d.docBankName,
              docYear: d.docYear as any,
            });
          }
        }
      });

      return { success: true, message: "Business documents upserted successfully" };
    } catch (error: any) {
      logger.error("Error upserting business documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPSERT_BUSINESS_DOCS_ERROR] Failed to upsert business documents");
    }
  }

  /**
   * List all active business documents for a business owned by the current user
   */
  static async list(
    clerkId: string,
    businessId: string
  ): Promise<BusinessDocumentsModel.ListDocumentsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const biz = await db.query.businessProfiles.findFirst({
        where: and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, user.id)),
        columns: { id: true },
      });
      if (!biz) throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");

      const rows = await db.query.businessDocuments.findMany({
        where: and(
          eq(businessDocuments.businessId, businessId),
          isNull(businessDocuments.deletedAt)
        ),
        columns: {
          docType: true,
          docUrl: true,
          isPasswordProtected: true,
          docPassword: true,
          docBankName: true,
          docYear: true,
        },
      });

      return {
        success: true,
        message: "Business documents retrieved successfully",
        data: rows as any,
      };
    } catch (error: any) {
      logger.error("Error listing business documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_BUSINESS_DOCS_ERROR] Failed to list business documents");
    }
  }

  /**
   * Create a document request for business documents
   */
  static async createDocumentRequest(
    clerkId: string,
    businessId: string,
    input: {
      documentType: string;
      reason: string;
      dueDate?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<BusinessDocumentsModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Ensure business exists and belongs to the user
      const biz = await db.query.businessProfiles.findFirst({
        where: and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, user.id)),
        columns: { id: true },
      });
      if (!biz) throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");

      // Create document request
      const _request = await DocumentRequestService.createRequest({
        loanApplicationId: businessId, // Using businessId as loanApplicationId for business documents
        requestedBy: user.id,
        requestedFrom: user.id,
        documentType: input.documentType as any,
        description: input.reason,
        isRequired: true,
      });

      // Note: Audit trail logging skipped for standalone document requests
      // Document requests should be created in the context of a loan application

      return {
        success: true,
        message: "Document request created successfully",
      };
    } catch (error: any) {
      logger.error("Error creating document request:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_DOCUMENT_REQUEST_ERROR] Failed to create document request");
    }
  }

  /**
   * Fulfill a document request by uploading the requested document
   */
  static async fulfillDocumentRequest(
    clerkId: string,
    businessId: string,
    requestId: string,
    documentData: BusinessDocumentsModel.AddDocumentsBody
  ): Promise<BusinessDocumentsModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Ensure business exists and belongs to the user
      const biz = await db.query.businessProfiles.findFirst({
        where: and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, user.id)),
        columns: { id: true },
      });
      if (!biz) throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");

      // Get the document request
      const request = await DocumentRequestService.getRequest(requestId);
      if (!request) throw httpError(404, "[DOCUMENT_REQUEST_NOT_FOUND] Document request not found");

      // Upload the document
      await BusinessDocuments.upsert(clerkId, businessId, documentData);

      // Mark the request as fulfilled
      await DocumentRequestService.fulfillRequest({
        requestId,
        fulfilledWith: "business_document_upload", // Placeholder for document ID
      });

      // Note: Audit trail logging skipped for standalone document request fulfillment
      // Document request fulfillment should be tracked in the context of a loan application

      return {
        success: true,
        message: "Document request fulfilled successfully",
      };
    } catch (error: any) {
      logger.error("Error fulfilling document request:", error);
      if (error?.status) throw error;
      throw httpError(500, "[FULFILL_DOCUMENT_REQUEST_ERROR] Failed to fulfill document request");
    }
  }
}
