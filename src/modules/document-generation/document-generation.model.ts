export namespace DocumentGenerationModel {
  // Upload contract request body
  export interface CompleteDocumentGenerationBody {
    contractUrl: string;
    docName?: string;
    notes?: string;
  }

  // Contract document details returned in response
  export interface ContractDocument {
    id: string;
    docUrl: string;
    docName?: string;
    notes?: string;
  }

  // Complete document generation response
  export interface CompleteDocumentGenerationResponse {
    loanApplicationId: string;
    status: "signing_execution";
    uploadedAt: string;
    uploadedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    };
    contract: ContractDocument;
  }

  // JSON Schema for API validation
  export const CompleteDocumentGenerationBodySchema = {
    type: "object",
    required: ["contractUrl"],
    properties: {
      contractUrl: { type: "string", format: "uri", minLength: 1 },
      docName: { type: "string", minLength: 1, maxLength: 255 },
      notes: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  } as const;
}

