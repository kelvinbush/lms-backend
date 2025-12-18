export namespace InvestorOpportunitiesModel {
  export interface CreateInvestorOpportunityBody {
    name: string;
    countryOfOrigin?: string;
    totalFundSize?: string;
    sectorFocusSsa?: string;
    countriesOfOperation?: string;
    operatingSince?: string;
    website?: string;
    isActive?: boolean;
  }

  export interface EditInvestorOpportunityBody {
    name?: string;
    countryOfOrigin?: string;
    totalFundSize?: string;
    sectorFocusSsa?: string;
    countriesOfOperation?: string;
    operatingSince?: string;
    website?: string;
    isActive?: boolean;
  }

  export interface InvestorOpportunityIdParams {
    id: string;
  }

  export interface InvestorOpportunityItem {
    id: string;
    name: string;
    countryOfOrigin?: string | null;
    totalFundSize?: string | null;
    sectorFocusSsa?: string | null;
    countriesOfOperation?: string | null;
    operatingSince?: string | null;
    website?: string | null;
    isActive: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
  }

  export const CreateInvestorOpportunityBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 200 },
      countryOfOrigin: { type: "string", maxLength: 120 },
      totalFundSize: { type: "string", maxLength: 120 },
      sectorFocusSsa: { type: "string" },
      countriesOfOperation: { type: "string" },
      operatingSince: { type: "string", maxLength: 50 },
      website: { type: "string", maxLength: 300 },
      isActive: { type: "boolean" },
    },
    required: ["name"],
  } as const;

  export const EditInvestorOpportunityBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: CreateInvestorOpportunityBodySchema.properties,
  } as const;

  export const InvestorOpportunityItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      countryOfOrigin: { type: "string" },
      totalFundSize: { type: "string" },
      sectorFocusSsa: { type: "string" },
      countriesOfOperation: { type: "string" },
      operatingSince: { type: "string" },
      website: { type: "string" },
      isActive: { type: "boolean" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "name", "isActive"],
    additionalProperties: true,
  } as const;

  export interface ListInvestorOpportunitiesResponse {
    success: boolean;
    message: string;
    data: InvestorOpportunityItem[];
  }

  export const ListInvestorOpportunitiesResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: InvestorOpportunityItemSchema },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  // Bookmarks
  export interface ListBookmarkedInvestorOpportunitiesResponse {
    success: boolean;
    message: string;
    data: InvestorOpportunityItem[];
  }

  export const ListBookmarkedInvestorOpportunitiesResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: InvestorOpportunityItemSchema },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
