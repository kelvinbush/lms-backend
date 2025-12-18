import { loanApplicationStatusEnum, type loanApplications } from "../../db/schema";

export namespace LoanApplicationsModel {
  // Status values derived from DB enum
  export const LoanApplicationStatusEnum = loanApplicationStatusEnum.enumValues;
  export type LoanApplicationStatus = (typeof loanApplications.$inferSelect)["status"];

  // Create loan application input
  export interface CreateLoanApplicationBody {
    businessId: string; // Required - ID of the selected business/SME
    entrepreneurId: string; // Required - ID of the entrepreneur/business owner
    loanProductId: string; // Required - ID of the selected loan product
    fundingAmount: number; // Required - Amount requested (primary currency)
    fundingCurrency: string; // Required - ISO currency code (e.g., "EUR", "USD", "KES")
    convertedAmount?: number; // Optional - Converted amount in secondary currency
    convertedCurrency?: string; // Optional - Secondary currency code
    exchangeRate?: number; // Optional - Exchange rate used for conversion (e.g., 150.90)
    repaymentPeriod: number; // Required - Preferred repayment period (in months)
    intendedUseOfFunds: string; // Required - Description of intended use (max 100 characters)
    interestRate: number; // Required - Interest rate per annum (percentage, e.g., 10 for 10%)
    loanSource?: string; // Optional - Source of loan application (e.g., "Admin Platform", "SME Platform")
  }

  // Create loan application response
  export interface CreateLoanApplicationResponse {
    id: string;
    loanId: string; // Auto-generated loan application ID (e.g., "LN-48291")
    businessId: string;
    entrepreneurId: string;
    loanProductId: string;
    fundingAmount: number;
    fundingCurrency: string;
    convertedAmount?: number;
    convertedCurrency?: string;
    exchangeRate?: number;
    repaymentPeriod: number;
    intendedUseOfFunds: string;
    interestRate: number;
    loanSource: string;
    status: LoanApplicationStatus; // Initial status (typically "kyc_kyb_verification")
    createdAt: string; // ISO 8601 timestamp
    createdBy: string; // User ID of the creator
    updatedAt: string; // ISO 8601 timestamp
  }

  // List loan applications query parameters
  export interface ListLoanApplicationsQuery {
    // Pagination
    page?: string; // Default: 1
    limit?: string; // Default: 20, Max: 100

    // Search
    search?: string; // Search across: loanId, businessName, applicant name, applicant email, loanProduct, loanSource

    // Filters
    status?: LoanApplicationStatus; // Filter by status
    loanProduct?: string; // Filter by loan product name (case-insensitive exact match)
    loanSource?: string; // Filter by loan source (case-insensitive exact match)

    // Date Filters
    applicationDate?: "today" | "this_week" | "this_month" | "last_month" | "this_year";
    createdAtFrom?: string; // ISO 8601 date string (YYYY-MM-DD)
    createdAtTo?: string; // ISO 8601 date string (YYYY-MM-DD)

    // Sorting
    sortBy?: "createdAt" | "applicationNumber" | "applicantName" | "amount";
    sortOrder?: "asc" | "desc"; // Default: "desc"
  }

  // Loan application item (for list response)
  export interface LoanApplication {
    id: string;
    loanId: string; // Display ID (e.g., "LN-48291")
    loanSource: string;
    businessName: string;
    entrepreneurId: string; // Required for navigation
    businessId: string; // Required for navigation
    applicant: {
      name: string; // Full name of entrepreneur/business owner
      email: string;
      phone: string;
      avatar?: string;
    };
    loanProduct: string; // Loan product name
    loanProductId: string; // Loan product ID
    loanRequested: number; // Funding amount
    loanCurrency: string; // Currency of loanRequested
    loanTenure: number; // Repayment period in months
    status: LoanApplicationStatus;
    createdAt: string; // ISO 8601 timestamp
    createdBy: string; // Creator name or ID
    lastUpdated: string; // ISO 8601 timestamp
  }

  // List loan applications response
  export interface ListLoanApplicationsResponse {
    data: LoanApplication[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  // Loan application statistics query parameters
  export interface LoanApplicationStatsQuery {
    status?: LoanApplicationStatus;
    loanProduct?: string;
    loanSource?: string;
    applicationDate?: "today" | "this_week" | "this_month" | "last_month" | "this_year";
    createdAtFrom?: string;
    createdAtTo?: string;
  }

  // Loan application statistics response
  export interface LoanApplicationStatsResponse {
    totalApplications: number;
    totalAmount: number; // Sum of all loanRequested amounts
    averageAmount: number; // Average loanRequested amount
    pendingApproval: number; // Count of applications in pending states
    approved: number; // Count of approved applications
    rejected: number; // Count of rejected applications
    disbursed: number; // Count of disbursed applications
    cancelled: number; // Count of cancelled applications

    // Percentage changes (compared to previous period)
    totalApplicationsChange?: number; // Percentage change (e.g., 15.5 for +15.5%)
    totalAmountChange?: number; // Percentage change
    pendingApprovalChange?: number; // Percentage change
    approvedChange?: number; // Percentage change
    rejectedChange?: number; // Percentage change
    disbursedChange?: number; // Percentage change
    cancelledChange?: number; // Percentage change
  }

  // Loan application detail (for getById response)
  export interface LoanApplicationDetail {
    id: string;
    loanId: string; // Display ID (e.g., "LN-48291")
    businessId: string;
    entrepreneurId: string;
    loanProductId: string;
    fundingAmount: number;
    fundingCurrency: string;
    convertedAmount?: number;
    convertedCurrency?: string;
    exchangeRate?: number;
    repaymentPeriod: number; // in months
    intendedUseOfFunds: string;
    interestRate: number;
    loanSource: string;
    status: LoanApplicationStatus;
    submittedAt?: string; // ISO 8601 timestamp
    approvedAt?: string; // ISO 8601 timestamp
    rejectedAt?: string; // ISO 8601 timestamp
    disbursedAt?: string; // ISO 8601 timestamp
    cancelledAt?: string; // ISO 8601 timestamp
    rejectionReason?: string;
    createdAt: string; // ISO 8601 timestamp
    updatedAt: string; // ISO 8601 timestamp
    lastUpdatedAt?: string; // ISO 8601 timestamp
    createdBy: string; // User ID
    lastUpdatedBy?: string; // User ID
    // Convenience fields (for easy frontend access)
    businessName: string;
    sector?: string | null;
    applicantName: string; // Full name of entrepreneur/applicant
    organizationName: string; // Name of organization providing the loan
    creatorName: string; // Full name of creator
    // Related data
    business: {
      id: string;
      name: string;
      description?: string | null;
      sector?: string | null;
      country?: string | null;
      city?: string | null;
      entityType?: string | null;
    };
    entrepreneur: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      phoneNumber?: string | null;
      imageUrl?: string | null;
    };
    loanProduct: {
      id: string;
      name: string;
      currency: string;
      minAmount: number;
      maxAmount: number;
    };
    creator: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    };
    lastUpdatedByUser?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    };
  }

  // JSON Schemas for validation
  export const CreateLoanApplicationBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      businessId: { type: "string", minLength: 1 },
      entrepreneurId: { type: "string", minLength: 1 },
      loanProductId: { type: "string", minLength: 1 },
      fundingAmount: { type: "number", minimum: 0 },
      fundingCurrency: { type: "string", minLength: 3, maxLength: 10 },
      convertedAmount: { type: "number", minimum: 0 },
      convertedCurrency: { type: "string", minLength: 3, maxLength: 10 },
      exchangeRate: { type: "number", minimum: 0 },
      repaymentPeriod: { type: "integer", minimum: 1, maximum: 60 },
      intendedUseOfFunds: { type: "string", minLength: 1, maxLength: 100 },
      interestRate: { type: "number", minimum: 0, maximum: 100 },
      loanSource: { type: "string", maxLength: 100 },
    },
    required: [
      "businessId",
      "entrepreneurId",
      "loanProductId",
      "fundingAmount",
      "fundingCurrency",
      "repaymentPeriod",
      "intendedUseOfFunds",
      "interestRate",
    ],
  } as const;

  export const CreateLoanApplicationResponseSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      loanId: { type: "string" },
      businessId: { type: "string" },
      entrepreneurId: { type: "string" },
      loanProductId: { type: "string" },
      fundingAmount: { type: "number" },
      fundingCurrency: { type: "string" },
      convertedAmount: { type: "number" },
      convertedCurrency: { type: "string" },
      exchangeRate: { type: "number" },
      repaymentPeriod: { type: "integer" },
      intendedUseOfFunds: { type: "string" },
      interestRate: { type: "number" },
      loanSource: { type: "string" },
      status: { type: "string", enum: LoanApplicationStatusEnum },
      createdAt: { type: "string" },
      createdBy: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: [
      "id",
      "loanId",
      "businessId",
      "entrepreneurId",
      "loanProductId",
      "fundingAmount",
      "fundingCurrency",
      "repaymentPeriod",
      "intendedUseOfFunds",
      "interestRate",
      "loanSource",
      "status",
      "createdAt",
      "createdBy",
      "updatedAt",
    ],
  } as const;

  export const LoanApplicationDetailSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      loanId: { type: "string" },
      businessId: { type: "string" },
      entrepreneurId: { type: "string" },
      loanProductId: { type: "string" },
      fundingAmount: { type: "number" },
      fundingCurrency: { type: "string" },
      convertedAmount: { type: "number" },
      convertedCurrency: { type: "string" },
      exchangeRate: { type: "number" },
      repaymentPeriod: { type: "integer" },
      intendedUseOfFunds: { type: "string" },
      interestRate: { type: "number" },
      loanSource: { type: "string" },
      status: { type: "string", enum: LoanApplicationStatusEnum },
      submittedAt: { type: "string" },
      approvedAt: { type: "string" },
      rejectedAt: { type: "string" },
      disbursedAt: { type: "string" },
      cancelledAt: { type: "string" },
      rejectionReason: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
      lastUpdatedAt: { type: "string" },
      createdBy: { type: "string" },
      lastUpdatedBy: { type: "string" },
      businessName: { type: "string" },
      sector: { type: "string" },
      applicantName: { type: "string" },
      organizationName: { type: "string" },
      creatorName: { type: "string" },
      business: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          sector: { type: "string" },
          country: { type: "string" },
          city: { type: "string" },
          entityType: { type: "string" },
        },
        required: ["id", "name"],
      },
      entrepreneur: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phoneNumber: { type: "string" },
          imageUrl: { type: "string" },
        },
        required: ["id", "email"],
      },
      loanProduct: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          currency: { type: "string" },
          minAmount: { type: "number" },
          maxAmount: { type: "number" },
        },
        required: ["id", "name", "currency", "minAmount", "maxAmount"],
      },
      creator: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
        },
        required: ["id", "email"],
      },
      lastUpdatedByUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
        },
        required: ["id", "email"],
      },
    },
    required: [
      "id",
      "loanId",
      "businessId",
      "entrepreneurId",
      "loanProductId",
      "fundingAmount",
      "fundingCurrency",
      "repaymentPeriod",
      "intendedUseOfFunds",
      "interestRate",
      "loanSource",
      "status",
      "createdAt",
      "updatedAt",
      "createdBy",
      "businessName",
      "applicantName",
      "organizationName",
      "creatorName",
      "business",
      "entrepreneur",
      "loanProduct",
      "creator",
    ],
  } as const;

  // Timeline event
  export interface TimelineEvent {
    id: string;
    type:
      | "submitted"
      | "cancelled"
      | "review_in_progress"
      | "rejected"
      | "approved"
      | "awaiting_disbursement"
      | "disbursed";
    title: string;
    description?: string;
    date: string; // ISO date string or formatted date (e.g., "2025-01-25" or "Jan 25, 2025")
    time?: string; // Optional: Time string (e.g., "6:04PM" or "18:04")
    updatedDate?: string; // Optional: For in-progress events, when it was last updated
    updatedTime?: string; // Optional: Time of last update
    performedBy?: string; // Optional: Name of person who performed the action (e.g., "Shalyne Waweru")
    performedById?: string; // Optional: ID of the user who performed the action
    lineColor?: "green" | "orange" | "grey"; // Optional: Visual indicator color
  }

  // Timeline response
  export interface TimelineResponse {
    data: TimelineEvent[];
  }

  export const TimelineResponseSchema = {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: [
                "submitted",
                "cancelled",
                "review_in_progress",
                "rejected",
                "approved",
                "awaiting_disbursement",
                "disbursed",
              ],
            },
            title: { type: "string" },
            description: { type: "string" },
            date: { type: "string" },
            time: { type: "string" },
            updatedDate: { type: "string" },
            updatedTime: { type: "string" },
            performedBy: { type: "string" },
            performedById: { type: "string" },
            lineColor: { type: "string", enum: ["green", "orange", "grey"] },
          },
          required: ["id", "type", "title", "date"],
        },
      },
    },
    required: ["data"],
  } as const;

  // Update status request body
  export interface UpdateStatusBody {
    status: LoanApplicationStatus;
    reason?: string; // Optional reason for the status change
    rejectionReason?: string; // Required if status = "rejected"
  }

  export const UpdateStatusBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: LoanApplicationStatusEnum },
      reason: { type: "string", maxLength: 500 },
      rejectionReason: { type: "string", maxLength: 1000 },
    },
    required: ["status"],
  } as const;
}
