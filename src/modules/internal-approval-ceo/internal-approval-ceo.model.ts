export namespace InternalApprovalCeoModel {
  // Supporting document input
  export interface SupportingDocument {
    docUrl: string;
    docName?: string;
    notes?: string;
  }

  // Complete internal approval CEO request body
  export interface CompleteInternalApprovalCeoBody {
    comment: string; // Required
    supportingDocuments?: SupportingDocument[]; // Optional array of supporting documents
    nextApprover?: {
      nextApproverEmail: string;
      nextApproverName?: string;
    };
  }

  // Complete internal approval CEO response
  export interface CompleteInternalApprovalCeoResponse {
    loanApplicationId: string;
    status: "committee_decision";
    completedAt: string;
    completedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    internalApprovalCeoComment: string;
    supportingDocuments: Array<{
      id: string;
      docUrl: string;
      docName?: string;
      notes?: string;
    }>;
  }

  // JSON Schema for API validation
  export const CompleteInternalApprovalCeoBodySchema = {
    type: "object",
    required: ["comment"],
    properties: {
      comment: { type: "string", minLength: 1 },
      supportingDocuments: {
        type: "array",
        items: {
          type: "object",
          required: ["docUrl"],
          properties: {
            docUrl: { type: "string", format: "uri" },
            docName: { type: "string", maxLength: 255 },
            notes: { type: "string", maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
      nextApprover: {
        type: "object",
        required: ["nextApproverEmail"],
        properties: {
          nextApproverEmail: { type: "string", format: "email" },
          nextApproverName: { type: "string", maxLength: 255 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  } as const;
}
