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
    };
    business: {
      id: string | null;
      name: string | null;
      // Add other business fields as needed
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
}

