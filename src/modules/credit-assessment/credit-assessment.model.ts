export namespace CreditAssessmentModel {
  // Supporting document input
  export interface SupportingDocument {
    docUrl: string;
    docName?: string;
    notes?: string;
  }

  // Complete credit assessment request body
  export interface CompleteCreditAssessmentBody {
    comment: string; // Required
    supportingDocuments?: SupportingDocument[]; // Optional array of supporting documents
    nextApprover?: {
      nextApproverEmail: string;
      nextApproverName?: string;
    };
  }

  // Complete credit assessment response
  export interface CompleteCreditAssessmentResponse {
    loanApplicationId: string;
    status: "head_of_credit_review";
    completedAt: string;
    completedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    creditAssessmentComment: string;
    supportingDocuments: Array<{
      id: string;
      docUrl: string;
      docName?: string;
      notes?: string;
    }>;
  }

  // JSON Schema for API validation
  export const CompleteCreditAssessmentBodySchema = {
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
