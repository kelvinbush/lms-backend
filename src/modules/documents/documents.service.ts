import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { personalDocuments } from "../../db/schema";
import { logger } from "../../utils/logger";
import { DocumentRequestService } from "../document-requests/document-request.service";
import type { UserModel } from "../user/user.model";
import type { DocumentsModel } from "./documents.model";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class Documents {
  /**
   * Upsert personal documents for the current user. If a document with the same
   * docType already exists (active record), it will be replaced (updated).
   * Accepts either a single document or an array of documents.
   */
  static async upsert(
    clerkId: string,
    input: DocumentsModel.AddDocumentsBody
  ): Promise<UserModel.BasicSuccessResponse> {
    try {
      // Resolve internal user by clerkId
      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Normalize to array and dedupe by docType (last one wins)
      const docsArray = Array.isArray(input) ? input : [input];
      const byType = new Map<DocumentsModel.PersonalDocType, string>();
      for (const d of docsArray) {
        byType.set(d.docType, d.docUrl);
      }
      const upserts = Array.from(byType.entries()).map(([docType, docUrl]) => ({
        docType,
        docUrl,
      }));

      await db.transaction(async (tx) => {
        // Find existing active documents for these types
        const existing = await tx.query.personalDocuments.findMany({
          where: and(
            eq(personalDocuments.userId, user.id),
            inArray(
              personalDocuments.docType,
              upserts.map((d) => d.docType)
            ),
            isNull(personalDocuments.deletedAt)
          ),
          columns: { id: true, docType: true, docUrl: true },
        });

        const existingTypes = new Set(existing.map((e) => e.docType));
        const toUpdate = upserts.filter((d) => existingTypes.has(d.docType));
        const toInsert = upserts.filter((d) => !existingTypes.has(d.docType));

        // Perform updates per type
        for (const d of toUpdate) {
          const _existingDoc = existing.find((e) => e.docType === d.docType);

          // Note: Audit trail logging for standalone document uploads is skipped
          // as it requires a loanApplicationId. Document uploads are logged when
          // they're part of a loan application workflow.

          await tx
            .update(personalDocuments)
            .set({ docUrl: d.docUrl, updatedAt: new Date() })
            .where(
              and(
                eq(personalDocuments.userId, user.id),
                eq(personalDocuments.docType, d.docType),
                isNull(personalDocuments.deletedAt)
              )
            );
        }

        // Perform bulk insert for new types
        if (toInsert.length > 0) {
          // Note: Audit trail logging for standalone document uploads is skipped
          // as it requires a loanApplicationId. Document uploads are logged when
          // they're part of a loan application workflow.

          await tx.insert(personalDocuments).values(
            toInsert.map((d) => ({
              userId: user.id,
              docType: d.docType,
              docUrl: d.docUrl,
            }))
          );
        }
      });

      return { success: true, message: "Documents upserted successfully" };
    } catch (error: any) {
      logger.error("Error upserting documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPSERT_DOCUMENTS_ERROR] Failed to upsert documents");
    }
  }

  /**
   * List all active personal documents for the current user
   */
  static async list(clerkId: string): Promise<DocumentsModel.ListDocumentsResponse> {
    try {
      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      const docs = await db.query.personalDocuments.findMany({
        where: and(eq(personalDocuments.userId, user.id), isNull(personalDocuments.deletedAt)),
        columns: {
          docType: true,
          docUrl: true,
        },
      });

      return {
        success: true,
        message: "Documents retrieved successfully",
        data: docs as UserModel.PersonalDocument[],
      };
    } catch (error: any) {
      logger.error("Error listing documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_DOCUMENTS_ERROR] Failed to list documents");
    }
  }

  /**
   * Create a document request for personal documents
   */
  static async createDocumentRequest(
    clerkId: string,
    input: {
      documentType: string;
      reason: string;
      dueDate?: Date;
      metadata?: Record<string, any>;
    }
  ): Promise<UserModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Create document request
      const _request = await DocumentRequestService.createRequest({
        loanApplicationId: user.id, // Using userId as loanApplicationId for personal documents
        requestedBy: user.id,
        requestedFrom: user.id,
        documentType: input.documentType as any,
        description: input.reason,
        isRequired: true,
      });

      // Note: Audit trail logging skipped for standalone document requests
      // Document requests should be created in the context of a loan application
      // where the loanApplicationId is available for audit trail logging

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
    requestId: string,
    documentData: DocumentsModel.AddDocumentsBody
  ): Promise<UserModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Get the document request
      const request = await DocumentRequestService.getRequest(requestId);
      if (!request) throw httpError(404, "[DOCUMENT_REQUEST_NOT_FOUND] Document request not found");

      // Upload the document
      await Documents.upsert(clerkId, documentData);

      // Mark the request as fulfilled
      await DocumentRequestService.fulfillRequest({
        requestId,
        fulfilledWith: "personal_document_upload", // Placeholder for document ID
      });

      // Note: Audit trail logging skipped for standalone document request fulfillment
      // Document request fulfillment should be tracked in the context of a loan application
      // where the loanApplicationId is available for audit trail logging

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
