export namespace CommitteeDecisionModel {
  // Complete committee decision request body
  export interface CompleteCommitteeDecisionBody {
    termSheetUrl: string; // URL to the uploaded term sheet document
  }

  // Complete committee decision response
  export interface CompleteCommitteeDecisionResponse {
    loanApplicationId: string;
    status: "sme_offer_approval";
    termSheetUrl: string;
    uploadedAt: string;
    uploadedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
  }

  // JSON Schema for API validation
  export const CompleteCommitteeDecisionBodySchema = {
    type: "object",
    required: ["termSheetUrl"],
    properties: {
      termSheetUrl: { type: "string", format: "uri", minLength: 1 },
    },
    additionalProperties: false,
  } as const;
}
