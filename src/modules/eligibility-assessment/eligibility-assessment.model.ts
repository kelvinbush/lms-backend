export namespace EligibilityAssessmentModel {
  // Supporting document input
  export interface SupportingDocument {
    docUrl: string;
    docName?: string;
    notes?: string;
  }

  // Complete eligibility assessment request body
  export interface CompleteEligibilityAssessmentBody {
    comment: string; // Required
    supportingDocuments?: SupportingDocument[]; // Optional array of supporting documents
    nextApprover?: {
      nextApproverEmail: string;
      nextApproverName?: string;
    };
  }

  // Complete eligibility assessment response
  export interface CompleteEligibilityAssessmentResponse {
    loanApplicationId: string;
    status: "credit_analysis";
    completedAt: string;
    completedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    eligibilityAssessmentComment: string;
    supportingDocuments: Array<{
      id: string;
      docUrl: string;
      docName?: string;
      notes?: string;
    }>;
  }

  // JSON Schema for API validation
  export const CompleteEligibilityAssessmentBodySchema = {
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
