/**
 * Admin SME Management - Model definitions for multi-step onboarding
 */

export namespace AdminSMEModel {
  // ============================================
  // Step 1: User Information
  // ============================================
  export interface Step1UserInfoBody {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    dob: string | Date;
    gender: string;
    position: string;
  }

  export const Step1UserInfoBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      email: { type: "string", format: "email" },
      firstName: { type: "string", minLength: 1, maxLength: 100 },
      lastName: { type: "string", minLength: 1, maxLength: 100 },
      phone: { type: "string", minLength: 1, maxLength: 32 },
      dob: { type: "string", format: "date" },
      gender: { type: "string", minLength: 1, maxLength: 20 },
      position: { type: "string", minLength: 1, maxLength: 50 },
    },
    required: ["email", "firstName", "lastName", "phone", "dob", "gender", "position"],
  } as const;

  // ============================================
  // Step 2: Business Basic Info
  // ============================================
  export interface Step2BusinessBasicInfoBody {
    logo?: string; // Logo URL
    name: string;
    entityType: string;
    year: number; // Year of incorporation
    sectors: string[]; // Array of sectors
    description?: string;
    userGroupId?: string; // Single user group ID (can be extended to multiple)
    criteria?: string[]; // Selection criteria (2xCriteria)
    noOfEmployees?: number;
    website?: string;
    videoLinks?: Array<{
      url: string;
      source?: string; // "youtube", "vimeo", "direct", etc.
    }>;
    businessPhotos?: string[]; // Array of photo URLs (max 5)
  }

  export const Step2BusinessBasicInfoBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      logo: { type: "string" },
      name: { type: "string", minLength: 1, maxLength: 150 },
      entityType: { type: "string", minLength: 1, maxLength: 50 },
      year: { type: "integer", minimum: 1900, maximum: 2100 },
      sectors: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
      },
      description: { type: "string", maxLength: 2000 },
      userGroupId: { type: "string" },
      criteria: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
      noOfEmployees: { type: "integer", minimum: 0 },
      website: { type: "string" },
      videoLinks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            source: { type: "string" },
          },
          required: ["url"],
        },
      },
      businessPhotos: {
        type: "array",
        items: { type: "string" },
        maxItems: 5, // Max 5 photos
      },
    },
    required: ["name", "entityType", "year", "sectors"],
  } as const;

  // ============================================
  // Step 3: Location Info
  // ============================================
  export interface Step3LocationInfoBody {
    countriesOfOperation: string[]; // Array of country names/codes
    companyHQ?: string;
    city?: string;
    registeredOfficeAddress?: string;
    registeredOfficeCity?: string;
    registeredOfficeZipCode?: string;
  }

  export const Step3LocationInfoBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      countriesOfOperation: {
        type: "array",
        items: { type: "string", minLength: 1 },
        minItems: 1,
      },
      companyHQ: { type: "string", maxLength: 100 },
      city: { type: "string", maxLength: 100 },
      registeredOfficeAddress: { type: "string" },
      registeredOfficeCity: { type: "string", maxLength: 100 },
      registeredOfficeZipCode: { type: "string", maxLength: 20 },
    },
    required: ["countriesOfOperation"],
  } as const;

  // ============================================
  // Step 4: Personal Documents
  // ============================================
  export interface Step4PersonalDocumentsBody {
    documents: Array<{
      docType: string;
      docUrl: string;
    }>;
    idNumber?: string;
    taxNumber?: string;
    idType?: string;
  }

  export const Step4PersonalDocumentsBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      documents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            docType: { type: "string", minLength: 1 },
            docUrl: { type: "string", minLength: 1 },
          },
          required: ["docType", "docUrl"],
        },
      },
      idNumber: { type: "string", maxLength: 50 },
      taxNumber: { type: "string", maxLength: 50 },
      idType: { type: "string", maxLength: 50 },
    },
    required: ["documents"],
  } as const;

  // ============================================
  // Step 5: Business Documents - Company Info
  // ============================================
  export interface Step5CompanyInfoDocumentsBody {
    documents: Array<{
      docType: string; // CR1, CR2, CR8, CR12, certificate_of_incorporation, etc.
      docUrl: string;
      isPasswordProtected?: boolean;
      docPassword?: string;
    }>;
  }

  export const Step5CompanyInfoDocumentsBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      documents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            docType: { type: "string", minLength: 1 },
            docUrl: { type: "string", minLength: 1 },
            isPasswordProtected: { type: "boolean" },
            docPassword: { type: "string" },
          },
          required: ["docType", "docUrl"],
        },
      },
    },
    required: ["documents"],
  } as const;

  // ============================================
  // Step 6: Business Documents - Financial
  // ============================================
  export interface Step6FinancialDocumentsBody {
    documents: Array<{
      docType: string; // annual_bank_statement, audited_financial_statements, etc.
      docUrl: string;
      docYear?: number;
      docBankName?: string;
      isPasswordProtected?: boolean;
      docPassword?: string;
    }>;
  }

  export const Step6FinancialDocumentsBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      documents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            docType: { type: "string", minLength: 1 },
            docUrl: { type: "string", minLength: 1 },
            docYear: { type: "integer", minimum: 1900, maximum: 2100 },
            docBankName: { type: "string", maxLength: 100 },
            isPasswordProtected: { type: "boolean" },
            docPassword: { type: "string" },
          },
          required: ["docType", "docUrl"],
        },
      },
    },
    required: ["documents"],
  } as const;

  // ============================================
  // Step 7: Business Documents - Permits & Pitch Deck
  // ============================================
  export interface Step7PermitAndPitchDocumentsBody {
    documents: Array<{
      docType: string; // business_permit, pitch_deck, business_plan, etc.
      docUrl: string;
      isPasswordProtected?: boolean;
      docPassword?: string;
    }>;
  }

  export const Step7PermitAndPitchDocumentsBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      documents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            docType: { type: "string", minLength: 1 },
            docUrl: { type: "string", minLength: 1 },
            isPasswordProtected: { type: "boolean" },
            docPassword: { type: "string" },
          },
          required: ["docType", "docUrl"],
        },
      },
    },
    required: ["documents"],
  } as const;

  // ============================================
  // Common Response Types
  // ============================================
  export interface BasicSuccessResponse {
    success: boolean;
    message?: string;
  }

  export interface ErrorResponse {
    error: string;
    code: string;
  }

  export interface OnboardingStateResponse {
    userId: string;
    currentStep: number | null;
    completedSteps: number[];
    user: {
      email: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      dob: Date | null;
      gender: string | null;
      position: string | null;
      onboardingStatus: string;
      idNumber: string | null;
      taxNumber: string | null;
      idType: string | null;
    };
    business: {
      id: string | null;
      name: string | null;
      // Financial details (summary)
      averageMonthlyTurnover: number | null;
      averageYearlyTurnover: number | null;
      previousLoans: boolean | null;
      loanAmount: number | null;
      defaultCurrency: string | null;
      recentLoanStatus: string | null;
      defaultReason: string | null;
    } | null;
  }

  export interface CreateUserResponse {
    userId: string;
    onboardingState: OnboardingStateResponse;
  }

  export interface InvitationResponse {
    success: boolean;
    invitationId: string;
    message?: string;
  }

  // ============================================
  // List Response Types
  // ============================================
  export interface SMEUserListItem {
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    onboardingStatus: "draft" | "pending_invitation" | "active";
    onboardingStep: number | null;
    currentStep: number | null;
    completedSteps: number[];
    business: {
      id: string;
      name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
  }

  export interface ListSMEUsersResponse {
    items: SMEUserListItem[];
    total: number;
    page?: number;
    limit?: number;
  }

  export interface ListSMEUsersQuery {
    page?: string;
    limit?: string;
    onboardingStatus?: "draft" | "pending_invitation" | "active";
    search?: string; // Search by email, firstName, lastName
  }

  export interface GetSMEUserDetailResponse extends OnboardingStateResponse {
    business: {
      id: string;
      name: string;
      entityType: string | null;
      logo: string | null;
      sectors: string[] | null;
      description: string | null;
      yearOfIncorporation: number | null;
      city: string | null;
      country: string | null;
      companyHQ: string | null;
      // Step 2 extended fields
      noOfEmployees: number | null;
      website: string | null;
      selectionCriteria: string[] | null;
      userGroupIds: string[]; // A business can belong to multiple programs/user groups
      // Financial details (full)
      averageMonthlyTurnover: number | null;
      averageYearlyTurnover: number | null;
      previousLoans: boolean | null;
      loanAmount: number | null;
      defaultCurrency: string | null;
      recentLoanStatus: string | null;
      defaultReason: string | null;
      // Step 3 extended fields
      countriesOfOperation: string[] | null;
      registeredOfficeAddress: string | null;
      registeredOfficeCity: string | null;
      registeredOfficeZipCode: string | null;
      // Media from Step 2
      videoLinks: Array<{
        url: string;
        source: string | null;
      }>;
      businessPhotos: string[];
      // Timestamps
      createdAt: string | null;
      updatedAt: string | null;
    } | null;
  }

  // ============================================
  // Financial Details Types
  // ============================================
  export interface SaveFinancialDetailsBody {
    averageMonthlyTurnover?: number | null;
    averageYearlyTurnover?: number | null;
    previousLoans?: boolean | null;
    loanAmount?: number | null;
    defaultCurrency?: string | null;
    recentLoanStatus?: "fully_repaid" | "currently_repaying" | "defaulted" | null;
    defaultReason?: string | null;
  }

  // ============================================
  // Entrepreneurs Stats Types
  // ============================================
  export interface StatMetric {
    value: number;
    deltaPercent: number;
  }

  export interface EntrepreneursStatsResponse {
    period: {
      current: string;
      previous: string;
    };
    totalSMEs: StatMetric;
    completeProfiles: StatMetric;
    incompleteProfiles: StatMetric;
    pendingActivation: StatMetric;
    smesWithLoans: StatMetric;
  }

  // ============================================
  // Document Response Types
  // ============================================
  export interface PersonalDocumentItem {
    id: string;
    docType: string;
    docUrl: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface ListPersonalDocumentsResponse {
    success: boolean;
    message: string;
    data: PersonalDocumentItem[];
  }

  export interface BusinessDocumentItem {
    id: string;
    docType: string;
    docUrl: string;
    isPasswordProtected: boolean;
    docPassword: string | null;
    docBankName: string | null;
    docYear: number | null;
    createdAt: string;
    updatedAt: string;
  }

  export interface ListBusinessDocumentsResponse {
    success: boolean;
    message: string;
    data: BusinessDocumentItem[];
  }

  // ============================================
  // Entrepreneur List Types
  // ============================================
  export interface EntrepreneurListItem {
    // Identity
    userId: string;
    createdAt: string;

    // Registered user
    imageUrl: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;

    // Onboarding / status
    onboardingStatus: "draft" | "pending_invitation" | "active";
    businessProfileProgress: number;

    // Business summary
    business: {
      id: string;
      name: string;
      sectors: string[];
      country: string | null;
    } | null;

    // User groups (programs)
    userGroups: {
      id: string;
      name: string;
    }[];

    // Aggregated flags
    hasCompleteProfile: boolean;
    hasPendingActivation: boolean;
  }

  export interface EntrepreneurListResponse {
    items: EntrepreneurListItem[];
    total: number;
    page?: number;
    limit?: number;
  }

  export const EntrepreneurListItemSchema = {
    type: "object",
    properties: {
      userId: { type: "string" },
      createdAt: { type: "string" },
      imageUrl: { type: ["string", "null"] },
      firstName: { type: ["string", "null"] },
      lastName: { type: ["string", "null"] },
      email: { type: "string" },
      phone: { type: ["string", "null"] },
      onboardingStatus: {
        type: "string",
        enum: ["draft", "pending_invitation", "active"],
      },
      businessProfileProgress: { type: "number" },
      business: {
        type: ["object", "null"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          sectors: { type: "array", items: { type: "string" } },
          country: { type: ["string", "null"] },
        },
      },
      userGroups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
          required: ["id", "name"],
        },
      },
      hasCompleteProfile: { type: "boolean" },
      hasPendingActivation: { type: "boolean" },
    },
    required: [
      "userId",
      "createdAt",
      "email",
      "onboardingStatus",
      "businessProfileProgress",
      "business",
      "userGroups",
      "hasCompleteProfile",
      "hasPendingActivation",
    ],
  } as const;

  export const EntrepreneurListResponseSchema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: EntrepreneurListItemSchema,
      },
      total: { type: "integer" },
      page: { type: ["integer", "null"] },
      limit: { type: ["integer", "null"] },
    },
    required: ["items", "total"],
  } as const;

  // ============================================
  // Route Parameter Schemas
  // ============================================
  export const UserIdParamsSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      userId: { type: "string", minLength: 1 },
    },
    required: ["userId"],
  } as const;

  export const StepParamsSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      userId: { type: "string", minLength: 1 },
      step: { type: "integer", minimum: 1, maximum: 7 },
    },
    required: ["userId", "step"],
  } as const;

  export const ListSMEUsersQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "string", pattern: "^[0-9]+$" },
      limit: { type: "string", pattern: "^[0-9]+$" },
      onboardingStatus: {
        type: "string",
        enum: ["draft", "pending_invitation", "active"],
      },
      search: { type: "string", minLength: 1, maxLength: 100 },
    },
  } as const;

  export const SMEUserListItemSchema = {
    type: "object",
    properties: {
      userId: { type: "string" },
      email: { type: "string" },
      firstName: { type: ["string", "null"] },
      lastName: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      onboardingStatus: {
        type: "string",
        enum: ["draft", "pending_invitation", "active"],
      },
      onboardingStep: { type: ["integer", "null"] },
      currentStep: { type: ["integer", "null"] },
      completedSteps: { type: "array", items: { type: "integer" } },
      business: {
        type: ["object", "null"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: [
      "userId",
      "email",
      "onboardingStatus",
      "currentStep",
      "completedSteps",
      "business",
      "createdAt",
      "updatedAt",
    ],
  } as const;

  export const ListSMEUsersResponseSchema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: SMEUserListItemSchema,
      },
      total: { type: "integer" },
      page: { type: ["integer", "null"] },
      limit: { type: ["integer", "null"] },
    },
    required: ["items", "total"],
  } as const;

  export const GetSMEUserDetailResponseSchema = {
    type: "object",
    properties: {
      userId: { type: "string" },
      currentStep: { type: ["integer", "null"] },
      completedSteps: { type: "array", items: { type: "integer" } },
      user: {
        type: "object",
        properties: {
          email: { type: "string" },
          firstName: { type: ["string", "null"] },
          lastName: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          dob: { type: ["string", "null"] },
          gender: { type: ["string", "null"] },
          position: { type: ["string", "null"] },
          onboardingStatus: { type: "string" },
          idNumber: { type: ["string", "null"] },
          taxNumber: { type: ["string", "null"] },
          idType: { type: ["string", "null"] }, 
        },
        required: ["email", "onboardingStatus"],
      },
      business: {
        type: ["object", "null"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          entityType: { type: ["string", "null"] },
          logo: { type: ["string", "null"] },
          sectors: { type: ["array", "null"], items: { type: "string" } },
          description: { type: ["string", "null"] },
          yearOfIncorporation: { type: ["integer", "null"] },
          city: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          companyHQ: { type: ["string", "null"] },
          averageMonthlyTurnover: { type: ["number", "null"] },
          averageYearlyTurnover: { type: ["number", "null"] },
          previousLoans: { type: ["boolean", "null"] },
          loanAmount: { type: ["number", "null"] },
          defaultCurrency: { type: ["string", "null"] },
          recentLoanStatus: { type: ["string", "null"] },
          defaultReason: { type: ["string", "null"] },
          noOfEmployees: { type: ["integer", "null"] },
          website: { type: ["string", "null"] },
          selectionCriteria: {
            type: ["array", "null"],
            items: { type: "string" },
          },
          userGroupIds: {
            type: "array",
            items: { type: "string" },
          },
          countriesOfOperation: {
            type: ["array", "null"],
            items: { type: "string" },
          },
          registeredOfficeAddress: { type: ["string", "null"] },
          registeredOfficeCity: { type: ["string", "null"] },
          registeredOfficeZipCode: { type: ["string", "null"] },
          videoLinks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                source: { type: ["string", "null"] },
              },
              required: ["url"],
            },
          },
          businessPhotos: {
            type: "array",
            items: { type: "string" },
          },
          createdAt: { type: ["string", "null"] },
          updatedAt: { type: ["string", "null"] },
        },
      },
    },
    required: ["userId", "currentStep", "completedSteps", "user", "business"],
  } as const;

  export const BasicSuccessResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: ["string", "null"] },
    },
    required: ["success"],
  } as const;

  export const ErrorResponseSchema = {
    type: "object",
    properties: {
      error: { type: "string" },
      code: { type: "string" },
    },
    required: ["error", "code"],
  } as const;

  export const PersonalDocumentItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      docType: { type: "string" },
      docUrl: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "docType", "docUrl", "createdAt", "updatedAt"],
  } as const;

  export const ListPersonalDocumentsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: {
        type: "array",
        items: PersonalDocumentItemSchema,
      },
    },
    required: ["success", "message", "data"],
  } as const;

  export const EntrepreneursStatsResponseSchema = {
    type: "object",
    properties: {
      period: {
        type: "object",
        properties: {
          current: { type: "string" },
          previous: { type: "string" },
        },
        required: ["current", "previous"],
      },
      totalSMEs: {
        type: "object",
        properties: {
          value: { type: "number" },
          deltaPercent: { type: "number" },
        },
        required: ["value", "deltaPercent"],
      },
      completeProfiles: {
        type: "object",
        properties: {
          value: { type: "number" },
          deltaPercent: { type: "number" },
        },
        required: ["value", "deltaPercent"],
      },
      incompleteProfiles: {
        type: "object",
        properties: {
          value: { type: "number" },
          deltaPercent: { type: "number" },
        },
        required: ["value", "deltaPercent"],
      },
      pendingActivation: {
        type: "object",
        properties: {
          value: { type: "number" },
          deltaPercent: { type: "number" },
        },
        required: ["value", "deltaPercent"],
      },
      smesWithLoans: {
        type: "object",
        properties: {
          value: { type: "number" },
          deltaPercent: { type: "number" },
        },
        required: ["value", "deltaPercent"],
      },
    },
    required: [
      "period",
      "totalSMEs",
      "completeProfiles",
      "incompleteProfiles",
      "pendingActivation",
      "smesWithLoans",
    ],
  } as const;

  export const BusinessDocumentItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      docType: { type: "string" },
      docUrl: { type: "string" },
      isPasswordProtected: { type: "boolean" },
      docPassword: { type: ["string", "null"] },
      docBankName: { type: ["string", "null"] },
      docYear: { type: ["integer", "null"] },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "docType", "docUrl", "isPasswordProtected", "createdAt", "updatedAt"],
  } as const;

  export const ListBusinessDocumentsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: {
        type: "array",
        items: BusinessDocumentItemSchema,
      },
    },
    required: ["success", "message", "data"],
  } as const;

  export const SaveFinancialDetailsBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      averageMonthlyTurnover: { type: ["number", "null"] },
      averageYearlyTurnover: { type: ["number", "null"] },
      previousLoans: { type: ["boolean", "null"] },
      loanAmount: { type: ["number", "null"] },
      defaultCurrency: { type: ["string", "null"] },
      recentLoanStatus: {
        type: ["string", "null"],
        enum: ["fully_repaid", "currently_repaying", "defaulted", null],
      },
      defaultReason: { type: ["string", "null"] },
    },
  } as const;
}

