import {
  amortizationMethodEnum,
  gracePeriodUnitEnum,
  interestCollectionMethodEnum,
  interestRatePeriodEnum,
  interestRecognitionCriteriaEnum,
  type loanProducts,
  loanTermUnitEnum,
  productStatusEnum,
  repaymentFrequencyEnum,
} from "../../db/schema";

export namespace LoanProductsModel {
  // Term unit values derived from DB enum
  export const LoanTermUnitEnum = loanTermUnitEnum.enumValues;
  export type LoanTermUnit = (typeof loanProducts.$inferSelect)["termUnit"];

  // Additional pricing enums
  export const InterestRatePeriodEnum = interestRatePeriodEnum.enumValues;
  export type InterestRatePeriod = (typeof loanProducts.$inferSelect)["ratePeriod"];
  export const RepaymentFrequencyEnum = repaymentFrequencyEnum.enumValues;
  export type RepaymentFrequency = (typeof loanProducts.$inferSelect)["repaymentFrequency"];
  export const AmortizationMethodEnum = amortizationMethodEnum.enumValues;
  export type AmortizationMethod = (typeof loanProducts.$inferSelect)["amortizationMethod"];
  export const InterestCollectionMethodEnum = interestCollectionMethodEnum.enumValues;
  export type InterestCollectionMethod =
    (typeof loanProducts.$inferSelect)["interestCollectionMethod"];
  export const InterestRecognitionCriteriaEnum = interestRecognitionCriteriaEnum.enumValues;
  export type InterestRecognitionCriteria =
    (typeof loanProducts.$inferSelect)["interestRecognitionCriteria"];
  export const GracePeriodUnitEnum = gracePeriodUnitEnum.enumValues;
  export type GracePeriodUnit = (typeof loanProducts.$inferSelect)["maxGraceUnit"];

  // Product status values derived from DB enum
  export const ProductStatusEnum = productStatusEnum.enumValues;
  export type ProductStatus = (typeof loanProducts.$inferSelect)["status"];

  // Loan fee configuration (for inline fee creation)
  export interface LoanFeeConfiguration {
    loanFeeId?: string; // Optional, ID of existing loan fee
    feeName?: string; // Required if loanFeeId not provided
    calculationMethod: "flat" | "percentage";
    rate: number;
    collectionRule: "upfront" | "end_of_term";
    allocationMethod: string;
    calculationBasis: "principal" | "total_disbursed";
  }

  // Create product input
  export interface CreateLoanProductBody {
    name: string;
    slug?: string;
    summary?: string;
    description?: string;
    organizationId: string; // Required
    userGroupIds: string[]; // Required, array of user group IDs
    currency: string; // ISO 4217 preferred
    minAmount: number; // decimal
    maxAmount: number; // decimal
    minTerm: number; // integer, in termUnit
    maxTerm: number; // integer, in termUnit
    termUnit: LoanTermUnit;
    availabilityStartDate?: string; // ISO 8601 date string (YYYY-MM-DD)
    availabilityEndDate?: string; // ISO 8601 date string (YYYY-MM-DD)
    repaymentFrequency: RepaymentFrequency;
    maxGracePeriod?: number;
    maxGraceUnit?: GracePeriodUnit;
    interestRate: number; // percentage value (e.g., 12.5)
    ratePeriod: InterestRatePeriod;
    amortizationMethod: AmortizationMethod;
    interestCollectionMethod: InterestCollectionMethod;
    interestRecognitionCriteria: InterestRecognitionCriteria;
    fees?: LoanFeeConfiguration[]; // Optional array of loan fees
    status?: ProductStatus; // default: draft
    isActive?: boolean;
  }

  // Edit product input (partial)
  export interface EditLoanProductBody {
    name?: string;
    slug?: string;
    summary?: string;
    description?: string;
    organizationId?: string;
    userGroupIds?: string[]; // Array of user group IDs
    currency?: string;
    minAmount?: number;
    maxAmount?: number;
    minTerm?: number;
    maxTerm?: number;
    termUnit?: LoanTermUnit;
    availabilityStartDate?: string; // ISO 8601 date string (YYYY-MM-DD)
    availabilityEndDate?: string; // ISO 8601 date string (YYYY-MM-DD)
    repaymentFrequency?: RepaymentFrequency;
    maxGracePeriod?: number;
    maxGraceUnit?: GracePeriodUnit;
    interestRate?: number;
    ratePeriod?: InterestRatePeriod;
    amortizationMethod?: AmortizationMethod;
    interestCollectionMethod?: InterestCollectionMethod;
    interestRecognitionCriteria?: InterestRecognitionCriteria;
    fees?: LoanFeeConfiguration[]; // Array of loan fees
    status?: ProductStatus;
    changeReason?: string;
    isActive?: boolean;
  }

  // Params with :id
  export interface LoanProductIdParams {
    id: string;
  }

  // Query parameters for listing products
  export interface ListLoanProductsQuery {
    page?: string;
    limit?: string;
    status?: ProductStatus;
    includeArchived?: string;
    currency?: string;
    minAmount?: string;
    maxAmount?: string;
    minTerm?: string;
    maxTerm?: string;
    termUnit?: LoanTermUnit;
    ratePeriod?: InterestRatePeriod;
    amortizationMethod?: AmortizationMethod;
    repaymentFrequency?: RepaymentFrequency;
    isActive?: string;
    search?: string; // Search in name, description
    sortBy?: "name" | "createdAt" | "updatedAt" | "interestRate" | "minAmount" | "maxAmount";
    sortOrder?: "asc" | "desc";
  }

  // JSON Schemas
  export const CreateLoanProductBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 150 },
      slug: { type: "string", maxLength: 180 },
      summary: { type: "string" },
      description: { type: "string" },
      organizationId: { type: "string", minLength: 1 },
      userGroupIds: { type: "array", items: { type: "string" }, minItems: 1 },
      currency: { type: "string", minLength: 1, maxLength: 10 },
      minAmount: { type: "number", minimum: 0 },
      maxAmount: { type: "number", minimum: 0 },
      minTerm: { type: "integer", minimum: 0 },
      maxTerm: { type: "integer", minimum: 0 },
      termUnit: { type: "string", enum: LoanTermUnitEnum },
      availabilityStartDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      availabilityEndDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      repaymentFrequency: { type: "string", enum: RepaymentFrequencyEnum },
      maxGracePeriod: { type: "integer", minimum: 0 },
      maxGraceUnit: { type: "string", enum: GracePeriodUnitEnum },
      interestRate: { type: "number", minimum: 0 },
      ratePeriod: { type: "string", enum: InterestRatePeriodEnum },
      amortizationMethod: { type: "string", enum: AmortizationMethodEnum },
      interestCollectionMethod: { type: "string", enum: InterestCollectionMethodEnum },
      interestRecognitionCriteria: { type: "string", enum: InterestRecognitionCriteriaEnum },
      fees: {
        type: "array",
        items: {
          type: "object",
          properties: {
            loanFeeId: { type: "string" },
            feeName: { type: "string" },
            calculationMethod: { type: "string", enum: ["flat", "percentage"] },
            rate: { type: "number", minimum: 0 },
            collectionRule: { type: "string", enum: ["upfront", "end_of_term"] },
            allocationMethod: { type: "string" },
            calculationBasis: { type: "string", enum: ["principal", "total_disbursed"] },
          },
          required: [
            "calculationMethod",
            "rate",
            "collectionRule",
            "allocationMethod",
            "calculationBasis",
          ],
        },
      },
      status: { type: "string", enum: ProductStatusEnum },
      isActive: { type: "boolean" },
    },
    required: [
      "name",
      "organizationId",
      "userGroupIds",
      "currency",
      "minAmount",
      "maxAmount",
      "minTerm",
      "maxTerm",
      "termUnit",
      "repaymentFrequency",
      "interestRate",
      "ratePeriod",
      "amortizationMethod",
      "interestCollectionMethod",
      "interestRecognitionCriteria",
    ],
    allOf: [
      // Ensure minAmount <= maxAmount
      {
        if: { properties: { minAmount: { type: "number" }, maxAmount: { type: "number" } } },
        then: {
          properties: {
            maxAmount: { type: "number", minimum: { $data: "1/minAmount" } },
          },
        },
      },
      // Ensure minTerm <= maxTerm
      {
        if: { properties: { minTerm: { type: "integer" }, maxTerm: { type: "integer" } } },
        then: {
          properties: {
            maxTerm: { type: "integer", minimum: { $data: "1/minTerm" } },
          },
        },
      },
      // Ensure availabilityEndDate >= availabilityStartDate if both provided
      {
        if: {
          properties: {
            availabilityStartDate: { type: "string" },
            availabilityEndDate: { type: "string" },
          },
        },
        then: {
          properties: {
            availabilityEndDate: { type: "string" },
          },
        },
      },
    ],
  } as const;

  export const EditLoanProductBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: CreateLoanProductBodySchema.properties,
    allOf: CreateLoanProductBodySchema.allOf,
  } as const;

  export interface LoanProductItem {
    id: string;
    name: string;
    slug?: string | null;
    summary?: string | null;
    description?: string | null;
    organizationId: string;
    userGroupIds?: string[]; // Array of user group IDs
    currency: string;
    minAmount: number;
    maxAmount: number;
    minTerm: number;
    maxTerm: number;
    termUnit: LoanTermUnit;
    availabilityStartDate?: string | null; // ISO 8601 date string
    availabilityEndDate?: string | null; // ISO 8601 date string
    repaymentFrequency: RepaymentFrequency;
    maxGracePeriod?: number | null;
    maxGraceUnit?: GracePeriodUnit | null;
    interestRate: number;
    ratePeriod: InterestRatePeriod;
    amortizationMethod: AmortizationMethod;
    interestCollectionMethod: InterestCollectionMethod;
    interestRecognitionCriteria: InterestRecognitionCriteria;
    fees?: LoanFeeConfiguration[]; // Array of loan fees
    // Versioning fields
    version: number;
    status: ProductStatus;
    changeReason?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
    isActive: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
    loansCount?: number; // Number of loan applications linked to this product
  }

  export const LoanProductItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      slug: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      organizationId: { type: "string" },
      userGroupIds: { type: "array", items: { type: "string" } },
      currency: { type: "string" },
      minAmount: { type: "number" },
      maxAmount: { type: "number" },
      minTerm: { type: "integer" },
      maxTerm: { type: "integer" },
      termUnit: { type: "string", enum: LoanTermUnitEnum },
      availabilityStartDate: { type: "string" },
      availabilityEndDate: { type: "string" },
      repaymentFrequency: { type: "string", enum: RepaymentFrequencyEnum },
      maxGracePeriod: { type: "integer" },
      maxGraceUnit: { type: "string", enum: GracePeriodUnitEnum },
      interestRate: { type: "number" },
      ratePeriod: { type: "string", enum: InterestRatePeriodEnum },
      amortizationMethod: { type: "string", enum: AmortizationMethodEnum },
      interestCollectionMethod: { type: "string", enum: InterestCollectionMethodEnum },
      interestRecognitionCriteria: { type: "string", enum: InterestRecognitionCriteriaEnum },
      fees: { type: "array" },
      // Versioning fields
      version: { type: "integer" },
      status: { type: "string", enum: ProductStatusEnum },
      changeReason: { type: "string" },
      approvedBy: { type: "string" },
      approvedAt: { type: "string" },
      isActive: { type: "boolean" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
      loansCount: { type: "integer" },
    },
    required: [
      "id",
      "name",
      "organizationId",
      "currency",
      "minAmount",
      "maxAmount",
      "minTerm",
      "maxTerm",
      "termUnit",
      "repaymentFrequency",
      "interestRate",
      "ratePeriod",
      "amortizationMethod",
      "interestCollectionMethod",
      "interestRecognitionCriteria",
      "version",
      "status",
      "isActive",
    ],
    additionalProperties: true,
  } as const;

  export interface ListLoanProductsResponse {
    success: boolean;
    message: string;
    data: LoanProductItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export const ListLoanProductsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: LoanProductItemSchema },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
        required: ["page", "limit", "total", "totalPages"],
      },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
