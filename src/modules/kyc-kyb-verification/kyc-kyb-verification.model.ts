import type {
  DocumentType,
  DocumentVerificationStatus,
} from "../../db/schema/loanApplicationDocumentVerifications";

export namespace KycKybVerificationModel {
  // Document verification status
  export type VerificationStatus = DocumentVerificationStatus;
  export type DocumentTypeEnum = DocumentType;

  // Document item with verification status
  export interface DocumentItem {
    id: string;
    docType: string;
    docUrl: string;
    docYear?: number;
    docBankName?: string;
    createdAt: string;
    verificationStatus: VerificationStatus;
    verifiedBy?: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    verifiedAt?: string;
    rejectionReason?: string;
    notes?: string;
    lockedAt?: string;
  }

  // Get documents for verification response
  export interface GetDocumentsResponse {
    personalDocuments: DocumentItem[];
    businessDocuments: DocumentItem[];
    summary: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
  }

  // Verify document request body
  export interface VerifyDocumentBody {
    status: "approved" | "rejected";
    rejectionReason?: string;
    notes?: string;
  }

  // Verify document response
  export interface VerifyDocumentResponse {
    documentId: string;
    documentType: DocumentTypeEnum;
    verificationStatus: VerificationStatus;
    verifiedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    verifiedAt: string;
    rejectionReason?: string;
    notes?: string;
    lockedAt?: string | null; // Optional - documents are no longer locked globally, verification is per-loan-application
  }

  // Bulk verify documents request body
  export interface BulkVerifyDocumentsBody {
    verifications: Array<{
      documentId: string;
      documentType: DocumentTypeEnum;
      status: "approved" | "rejected";
      rejectionReason?: string;
      notes?: string;
    }>;
  }

  // Bulk verify documents response
  export interface BulkVerifyDocumentsResponse {
    successful: number;
    failed: number;
    results: Array<{
      documentId: string;
      success: boolean;
      error?: string;
    }>;
  }

  // Complete KYC/KYB verification response
  export interface CompleteKycKybResponse {
    loanApplicationId: string;
    status: string;
    completedAt: string;
    completedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
  }

  // Complete KYC/KYB verification request body
  export interface CompleteKycKybVerificationBody {
    nextApproverEmail: string;
    nextApproverName?: string;
  }

  // JSON Schemas for API validation
  export const VerifyDocumentBodySchema = {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["approved", "rejected"] },
      rejectionReason: { type: "string", maxLength: 1000 },
      notes: { type: "string", maxLength: 2000 },
    },
    additionalProperties: false,
    allOf: [
      // If status is "rejected", rejectionReason is required and must have minLength: 1
      {
        if: {
          properties: { status: { const: "rejected" } },
          required: ["status"],
        },
        then: {
          required: ["rejectionReason"],
          properties: {
            rejectionReason: { type: "string", minLength: 1, maxLength: 1000 },
          },
        },
      },
    ],
  } as const;

  export const BulkVerifyDocumentsBodySchema = {
    type: "object",
    required: ["verifications"],
    properties: {
      verifications: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: {
          type: "object",
          required: ["documentId", "documentType", "status"],
          properties: {
            documentId: { type: "string", minLength: 1 },
            documentType: { type: "string", enum: ["personal", "business"] },
            status: { type: "string", enum: ["approved", "rejected"] },
            rejectionReason: { type: "string", maxLength: 1000 },
            notes: { type: "string", maxLength: 2000 },
          },
          additionalProperties: false,
          allOf: [
            // If status is "rejected", rejectionReason is required and must have minLength: 1
            {
              if: {
                properties: { status: { const: "rejected" } },
                required: ["status"],
              },
              then: {
                required: ["rejectionReason"],
                properties: {
                  rejectionReason: { type: "string", minLength: 1, maxLength: 1000 },
                },
              },
            },
          ],
        },
      },
    },
    additionalProperties: false,
  } as const;
}
