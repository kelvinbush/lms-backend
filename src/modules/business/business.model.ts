// fields to register a business

export namespace BusinessModel {
  // TypeScript type for the service layer input
  export interface RegisterBusinessInput {
    name: string;
    description: string;
    entityType: string;
    country: string; // ISO country code or country name
    yearOfIncorporation: number; // four-digit year
    isOwned: boolean;
    sector: string; // whether the current user owns equity in this business
    ownershipPercentage?: number; // 0..100, required when isOwned=true
    ownershipType?: string; // e.g., individual | joint | company | government | trust | other
  }

  // Fastify JSON Schema for validating request body
  export const RegisterBusinessBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", minLength: 1, maxLength: 2000 },
      entityType: { type: "string", minLength: 1, maxLength: 100 },
      country: { type: "string", minLength: 2, maxLength: 100 },
      yearOfIncorporation: {
        type: "integer",
        minimum: 1900,
        maximum: 2100,
      },
      sector: { type: "string", minLength: 1, maxLength: 100 },
      isOwned: { type: "boolean" },
      ownershipPercentage: { type: "number", minimum: 0, maximum: 100 },
      ownershipType: { type: "string", minLength: 1, maxLength: 100 },
    },
    required: ["name", "entityType", "country", "yearOfIncorporation", "isOwned", "sector"],
    allOf: [
      // If isOwned is true, require ownershipPercentage and ownershipType
      {
        if: {
          properties: { isOwned: { const: true } },
          required: ["isOwned"],
        },
        then: {
          required: ["ownershipPercentage", "ownershipType"],
        },
      },
      // If isOwned is false, disallow ownershipPercentage > 0
      {
        if: {
          properties: { isOwned: { const: false } },
          required: ["isOwned"],
        },
        then: {
          properties: { ownershipPercentage: { type: "number", maximum: 0 } },
        },
      },
    ],
  } as const;

  // TypeScript type for editing a business - all fields optional, at least one required by schema
  export interface EditBusinessBody {
    name?: string;
    description?: string;
    imageUrl?: string;
    coverImage?: string;
    entityType?: string;
    country?: string;
    city?: string;
    address?: string;
    zipCode?: string;
    address2?: string;
    sector?: string;
    yearOfIncorporation?: number; // four-digit year
    avgMonthlyTurnover?: number; // numeric
    avgYearlyTurnover?: number; // numeric
    borrowingHistory?: boolean;
    amountBorrowed?: number; // numeric
    loanStatus?: string;
    defaultReason?: string;
    currency?: string;
    ownershipType?: string;
    ownershipPercentage?: number; // 0..100
    isOwned?: boolean;
  }

  // Fastify JSON Schema for editing a business
  // Body must include at least one of the defined properties
  export const EditBusinessBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 200 },
      description: { type: "string", minLength: 1, maxLength: 2000 },
      imageUrl: { type: "string", minLength: 1 },
      coverImage: { type: "string", minLength: 1 },
      entityType: { type: "string", minLength: 1, maxLength: 100 },
      country: { type: "string", minLength: 2, maxLength: 100 },
      city: { type: "string", minLength: 1, maxLength: 100 },
      address: { type: "string", minLength: 1, maxLength: 200 },
      zipCode: { type: "string", minLength: 1, maxLength: 20 },
      address2: { type: "string", minLength: 1, maxLength: 200 },
      yearOfIncorporation: {
        type: "integer",
        minimum: 1900,
        maximum: 2100,
      },
      sector: { type: "string", minLength: 1, maxLength: 100 },
      isOwned: { type: "boolean" },
      avgMonthlyTurnover: { type: "number", minimum: 0 },
      avgYearlyTurnover: { type: "number", minimum: 0 },
      borrowingHistory: { type: "boolean" },
      amountBorrowed: { type: "number", minimum: 0 },
      loanStatus: { type: "string", minLength: 1, maxLength: 50 },
      defaultReason: { type: "string" },
      currency: { type: "string", minLength: 1, maxLength: 10 },
      ownershipPercentage: { type: "number", minimum: 0, maximum: 100 },
      ownershipType: { type: "string", minLength: 1, maxLength: 100 },
    },
    allOf: [
      // Only when isOwned is provided as true in the update, require ownership fields
      {
        if: {
          properties: { isOwned: { const: true } },
          required: ["isOwned"],
        },
        then: {
          required: ["ownershipPercentage", "ownershipType"],
        },
      },
      // If isOwned is provided as false, and ownershipPercentage is provided, enforce it to be 0
      {
        if: {
          properties: { isOwned: { const: false } },
          required: ["isOwned"],
        },
        then: {
          properties: { ownershipPercentage: { type: "number", maximum: 0 } },
        },
      },
      // If loanStatus is "defaulted", require defaultReason
      {
        if: {
          properties: { loanStatus: { const: "defaulted" } },
          required: ["loanStatus"],
        },
        then: {
          required: ["defaultReason"],
          properties: { defaultReason: { type: "string", minLength: 1 } },
        },
      },
    ],
  } as const;

  // Common params schema for business id in routes
  export const BusinessIdParamsSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1 },
    },
    required: ["id"],
  } as const;

  // ------------------------------------------------------------
  // List Businesses (for authenticated user)
  // ------------------------------------------------------------
  export interface BusinessItem {
    id: string;
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    coverImage?: string | null;
    entityType?: string | null;
    country?: string | null;
    city?: string | null;
    address?: string | null;
    zipCode?: string | null;
    address2?: string | null;
    sector?: string | null;
    yearOfIncorporation?: string | null; // stored as string in DB
    avgMonthlyTurnover?: number | null; // numeric in DB
    avgYearlyTurnover?: number | null; // numeric in DB
    borrowingHistory?: boolean | null;
    amountBorrowed?: number | null; // numeric in DB
    loanStatus?: string | null;
    defaultReason?: string | null;
    currency?: string | null;
    ownershipType?: string | null;
    ownershipPercentage?: number | null;
    isOwned?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }

  export interface ListBusinessesResponse {
    success: boolean;
    message: string;
    data: BusinessItem[];
  }

  export const BusinessItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      imageUrl: { type: "string" },
      coverImage: { type: "string" },
      entityType: { type: "string" },
      country: { type: "string" },
      city: { type: "string" },
      address: { type: "string" },
      zipCode: { type: "string" },
      address2: { type: "string" },
      sector: { type: "string" },
      yearOfIncorporation: { type: "string" },
      avgMonthlyTurnover: { type: "number" },
      avgYearlyTurnover: { type: "number" },
      borrowingHistory: { type: "boolean" },
      amountBorrowed: { type: "number" },
      loanStatus: { type: "string" },
      defaultReason: { type: "string" },
      currency: { type: "string" },
      ownershipType: { type: "string" },
      ownershipPercentage: { type: "number" },
      isOwned: { type: "boolean" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id"],
    additionalProperties: true,
  } as const;

  export const ListBusinessesResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: BusinessItemSchema },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
