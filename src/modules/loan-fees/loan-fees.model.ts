export namespace LoanFeesModel {
  export interface CreateLoanFeeBody {
    name: string; // Required, max 255 chars
    calculationMethod: 'flat' | 'percentage';
    rate: number; // Required, fee rate/percentage
    collectionRule: 'upfront' | 'end_of_term';
    allocationMethod: string; // e.g., "first_installment", "spread_installments"
    calculationBasis: 'principal' | 'total_disbursed';
  }

  export interface UpdateLoanFeeBody {
    name?: string;
    calculationMethod?: 'flat' | 'percentage';
    rate?: number;
    collectionRule?: 'upfront' | 'end_of_term';
    allocationMethod?: string;
    calculationBasis?: 'principal' | 'total_disbursed';
  }

  export interface LoanFeeItem {
    id: string;
    name: string;
    calculationMethod: 'flat' | 'percentage';
    rate: number;
    collectionRule: 'upfront' | 'end_of_term';
    allocationMethod: string;
    calculationBasis: 'principal' | 'total_disbursed';
    isArchived: boolean;
    createdAt: string; // ISO 8601 timestamp
    updatedAt: string; // ISO 8601 timestamp
  }

  export interface ListLoanFeesQuery {
    page?: string;
    limit?: string;
    search?: string; // Search by name
    includeArchived?: string; // "true" or "false"
  }

  export interface PaginatedLoanFeesResponse {
    items: LoanFeeItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

  export const CreateLoanFeeBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 255 },
      calculationMethod: { type: "string", enum: ["flat", "percentage"] },
      rate: { type: "number", minimum: 0 },
      collectionRule: { type: "string", enum: ["upfront", "end_of_term"] },
      allocationMethod: { type: "string", minLength: 1 },
      calculationBasis: { type: "string", enum: ["principal", "total_disbursed"] },
    },
    required: ["name", "calculationMethod", "rate", "collectionRule", "allocationMethod", "calculationBasis"],
  } as const;

  export const UpdateLoanFeeBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 255 },
      calculationMethod: { type: "string", enum: ["flat", "percentage"] },
      rate: { type: "number", minimum: 0 },
      collectionRule: { type: "string", enum: ["upfront", "end_of_term"] },
      allocationMethod: { type: "string", minLength: 1 },
      calculationBasis: { type: "string", enum: ["principal", "total_disbursed"] },
    },
  } as const;

  export const LoanFeeItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      calculationMethod: { type: "string", enum: ["flat", "percentage"] },
      rate: { type: "number" },
      collectionRule: { type: "string", enum: ["upfront", "end_of_term"] },
      allocationMethod: { type: "string" },
      calculationBasis: { type: "string", enum: ["principal", "total_disbursed"] },
      isArchived: { type: "boolean" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "name", "calculationMethod", "rate", "collectionRule", "allocationMethod", "calculationBasis", "isArchived", "createdAt", "updatedAt"],
    additionalProperties: true,
  } as const;

  export const PaginatedLoanFeesResponseSchema = {
    type: "object",
    properties: {
      items: { type: "array", items: LoanFeeItemSchema },
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
      totalPages: { type: "integer" },
    },
    required: ["items", "total", "page", "limit", "totalPages"],
  } as const;
}
