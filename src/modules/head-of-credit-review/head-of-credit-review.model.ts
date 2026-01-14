export namespace HeadOfCreditReviewModel {
  // Supporting document input
  export interface SupportingDocument {
    docUrl: string;
    docName?: string;
    notes?: string;
  }

  // Complete head of credit review request body
  export interface CompleteHeadOfCreditReviewBody {
    comment: string; // Required
    supportingDocuments?: SupportingDocument[]; // Optional array of supporting documents
    nextApprover?: {
      nextApproverEmail: string;
      nextApproverName?: string;
    };
  }

  // Complete head of credit review response
  export interface CompleteHeadOfCreditReviewResponse {
    loanApplicationId: string;
    status: "internal_approval_ceo";
    completedAt: string;
    completedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    headOfCreditReviewComment: string;
    supportingDocuments: Array<{
      id: string;
      docUrl: string;
      docName?: string;
      notes?: string;
    }>;
  }

  // JSON Schema for API validation
  export const CompleteHeadOfCreditReviewBodySchema = {
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
