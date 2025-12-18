import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  type DocumentRequestStatus,
  type RequestedDocumentType,
  documentRequests,
} from "../../db/schema/documentRequests";

function httpError(status: number, message: string) {
  const error = new Error(message) as any;
  error.statusCode = status;
  return error;
}

export interface CreateDocumentRequestParams {
  loanApplicationId: string;
  requestedBy: string;
  requestedFrom: string;
  documentType: RequestedDocumentType;
  description: string;
  isRequired?: boolean;
}

export interface FulfillDocumentRequestParams {
  requestId: string;
  fulfilledWith: string; // Document ID that fulfills the request
}

export interface DocumentRequestEntry {
  id: string;
  loanApplicationId: string;
  requestedBy: string;
  requestedFrom: string;
  documentType: RequestedDocumentType;
  description: string;
  isRequired: string;
  status: DocumentRequestStatus;
  fulfilledAt?: string | null;
  fulfilledWith?: string | null;
  createdAt: string;
  updatedAt: string;
}

export abstract class DocumentRequestService {
  /**
   * Create a document request
   *
   * @param params - Document request parameters
   * @returns Created document request entry
   *
   * @throws {400} If required parameters are missing
   * @throws {500} If creation fails
   */
  static async createRequest(params: CreateDocumentRequestParams): Promise<DocumentRequestEntry> {
    try {
      // Validate required parameters
      if (
        !params.loanApplicationId ||
        !params.requestedBy ||
        !params.requestedFrom ||
        !params.documentType ||
        !params.description
      ) {
        throw httpError(
          400,
          "[INVALID_PARAMETERS] loanApplicationId, requestedBy, requestedFrom, documentType, and description are required"
        );
      }

      // Insert document request
      const [result] = await db
        .insert(documentRequests)
        .values({
          loanApplicationId: params.loanApplicationId,
          requestedBy: params.requestedBy,
          requestedFrom: params.requestedFrom,
          documentType: params.documentType,
          description: params.description,
          isRequired: params.isRequired !== false ? "true" : "false",
          status: "pending",
        })
        .returning();

      if (!result) {
        throw httpError(
          500,
          "[DOCUMENT_REQUEST_CREATION_FAILED] Failed to create document request"
        );
      }

      // Return formatted result
      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        requestedBy: result.requestedBy,
        requestedFrom: result.requestedFrom,
        documentType: result.documentType,
        description: result.description,
        isRequired: result.isRequired,
        status: result.status,
        fulfilledAt: result.fulfilledAt?.toISOString() || null,
        fulfilledWith: result.fulfilledWith,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[DOCUMENT_REQUEST_ERROR] ${error.message}`);
    }
  }

  /**
   * Fulfill a document request
   *
   * @param params - Fulfillment parameters
   * @returns Updated document request entry
   *
   * @throws {400} If required parameters are missing
   * @throws {404} If document request not found
   * @throws {500} If update fails
   */
  static async fulfillRequest(params: FulfillDocumentRequestParams): Promise<DocumentRequestEntry> {
    try {
      // Validate required parameters
      if (!params.requestId || !params.fulfilledWith) {
        throw httpError(400, "[INVALID_PARAMETERS] requestId and fulfilledWith are required");
      }

      // Update document request
      const [result] = await db
        .update(documentRequests)
        .set({
          status: "fulfilled",
          fulfilledAt: new Date(),
          fulfilledWith: params.fulfilledWith,
          updatedAt: new Date(),
        })
        .where(eq(documentRequests.id, params.requestId))
        .returning();

      if (!result) {
        throw httpError(404, "[DOCUMENT_REQUEST_NOT_FOUND] Document request not found");
      }

      // Return formatted result
      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        requestedBy: result.requestedBy,
        requestedFrom: result.requestedFrom,
        documentType: result.documentType,
        description: result.description,
        isRequired: result.isRequired,
        status: result.status,
        fulfilledAt: result.fulfilledAt?.toISOString() || null,
        fulfilledWith: result.fulfilledWith,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[DOCUMENT_REQUEST_ERROR] ${error.message}`);
    }
  }

  /**
   * Get document request by ID
   *
   * @param requestId - Document request ID
   * @returns Document request entry
   *
   * @throws {400} If requestId is missing
   * @throws {404} If document request not found
   * @throws {500} If query fails
   */
  static async getRequest(requestId: string): Promise<DocumentRequestEntry> {
    try {
      if (!requestId) {
        throw httpError(400, "[INVALID_PARAMETERS] requestId is required");
      }

      const [result] = await db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.id, requestId))
        .limit(1);

      if (!result) {
        throw httpError(404, "[DOCUMENT_REQUEST_NOT_FOUND] Document request not found");
      }

      // Return formatted result
      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        requestedBy: result.requestedBy,
        requestedFrom: result.requestedFrom,
        documentType: result.documentType,
        description: result.description,
        isRequired: result.isRequired,
        status: result.status,
        fulfilledAt: result.fulfilledAt?.toISOString() || null,
        fulfilledWith: result.fulfilledWith,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[DOCUMENT_REQUEST_ERROR] ${error.message}`);
    }
  }

  /**
   * Get document requests for a loan application
   *
   * @param loanApplicationId - Loan application ID
   * @param status - Optional status filter
   * @returns Array of document request entries
   *
   * @throws {400} If loanApplicationId is missing
   * @throws {500} If query fails
   */
  static async getRequests(
    loanApplicationId: string,
    status?: DocumentRequestStatus
  ): Promise<DocumentRequestEntry[]> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId is required");
      }

      // Build query conditions
      const conditions = [eq(documentRequests.loanApplicationId, loanApplicationId)];

      if (status) {
        conditions.push(eq(documentRequests.status, status));
      }

      // Execute query
      const results = await db
        .select()
        .from(documentRequests)
        .where(and(...conditions))
        .orderBy(desc(documentRequests.createdAt));

      // Format results
      return results.map((result) => ({
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        requestedBy: result.requestedBy,
        requestedFrom: result.requestedFrom,
        documentType: result.documentType,
        description: result.description,
        isRequired: result.isRequired,
        status: result.status,
        fulfilledAt: result.fulfilledAt?.toISOString() || null,
        fulfilledWith: result.fulfilledWith,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      }));
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[DOCUMENT_REQUEST_ERROR] ${error.message}`);
    }
  }

  /**
   * Get pending document requests for a user
   *
   * @param userId - User ID
   * @returns Array of pending document request entries
   *
   * @throws {400} If userId is missing
   * @throws {500} If query fails
   */
  static async getPendingRequests(userId: string): Promise<DocumentRequestEntry[]> {
    try {
      if (!userId) {
        throw httpError(400, "[INVALID_PARAMETERS] userId is required");
      }

      const results = await db
        .select()
        .from(documentRequests)
        .where(
          and(eq(documentRequests.requestedFrom, userId), eq(documentRequests.status, "pending"))
        )
        .orderBy(desc(documentRequests.createdAt));

      // Format results
      return results.map((result) => ({
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        requestedBy: result.requestedBy,
        requestedFrom: result.requestedFrom,
        documentType: result.documentType,
        description: result.description,
        isRequired: result.isRequired,
        status: result.status,
        fulfilledAt: result.fulfilledAt?.toISOString() || null,
        fulfilledWith: result.fulfilledWith,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      }));
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[DOCUMENT_REQUEST_ERROR] ${error.message}`);
    }
  }

  /**
   * Get document request statistics for a loan application
   *
   * @param loanApplicationId - Loan application ID
   * @returns Statistics about document requests
   *
   * @throws {400} If loanApplicationId is missing
   * @throws {500} If query fails
   */
  static async getRequestStatistics(loanApplicationId: string): Promise<{
    total: number;
    pending: number;
    fulfilled: number;
    overdue: number;
  }> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId is required");
      }

      const results = await db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.loanApplicationId, loanApplicationId));

      // Calculate statistics
      const total = results.length;
      const pending = results.filter((r) => r.status === "pending").length;
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const overdue = results.filter((r) => r.status === "overdue").length;

      return {
        total,
        pending,
        fulfilled,
        overdue,
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[DOCUMENT_REQUEST_ERROR] ${error.message}`);
    }
  }
}
