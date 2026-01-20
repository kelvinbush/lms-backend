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

  // Contract signatories
  export interface ContractSignatoryInput {
    fullName: string;
    email: string;
    roleTitle?: string;
    signingOrder?: number;
  }

  export interface PersistedContractSignatory extends ContractSignatoryInput {
    id: string;
    category: "mk" | "client";
    hasSigned: boolean;
    signedAt?: string;
  }

  export interface SetContractSignatoriesBody {
    mkSignatories: ContractSignatoryInput[];
    clientSignatories: ContractSignatoryInput[];
  }

  export interface SetContractSignatoriesResponse {
    loanApplicationId: string;
    contractStatus: "contract_sent_for_signing";
    totalSignatories: number;
    mkSignatories: PersistedContractSignatory[];
    clientSignatories: PersistedContractSignatory[];
  }

  export const SetContractSignatoriesBodySchema = {
    type: "object",
    additionalProperties: false,
    required: ["mkSignatories", "clientSignatories"],
    properties: {
      mkSignatories: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fullName", "email"],
          properties: {
            fullName: { type: "string", minLength: 1, maxLength: 255 },
            email: { type: "string", format: "email" },
            roleTitle: { type: "string", minLength: 1, maxLength: 255 },
            signingOrder: { type: "integer", minimum: 1 },
          },
        },
      },
      clientSignatories: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fullName", "email"],
          properties: {
            fullName: { type: "string", minLength: 1, maxLength: 255 },
            email: { type: "string", format: "email" },
            roleTitle: { type: "string", minLength: 1, maxLength: 255 },
            signingOrder: { type: "integer", minimum: 1 },
          },
        },
      },
    },
  } as const;
}

