export namespace UserModel {
  export interface SignUpBody {
    email: string;
    firstName: string;
    lastName: string;
    gender: string;
    phoneNumber: string;
    dob: string | Date;
    clerkId: string;
  }

  export interface SignUpResponse {
    email: string;
  }

  export interface ErrorResponse {
    error: string;
    code: string;
  }

  export type OtpRequestBody = {};

  export interface OtpVerificationBody {
    otp: string;
  }

  export interface OtpResponse {
    success: boolean;
    message: string;
    isAlreadyVerified?: boolean;
  }

  export interface BasicSuccessResponse {
    success: boolean;
    message: string;
  }

  export type OtpVerificationResponse = BasicSuccessResponse;

  export type EditPhoneResponse = BasicSuccessResponse;

  export const ErrorResponseSchema = {
    type: "object",
    properties: {
      error: { type: "string" },
      code: { type: "string" },
    },
    required: ["error", "code"],
    additionalProperties: true,
  } as const;

  export const SignUpResponseSchema = {
    type: "object",
    properties: { email: { type: "string" } },
    required: ["email"],
    additionalProperties: true,
  } as const;

  export const OtpRequestBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {},
  } as const;

  export const OtpVerificationBodySchema = {
    type: "object",
    properties: { otp: { type: "string" } },
    required: ["otp"],
    additionalProperties: false,
  } as const;

  export const OtpResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      isAlreadyVerified: { type: "boolean" },
    },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;

  export const BasicSuccessResponseSchema = {
    type: "object",
    properties: { success: { type: "boolean" }, message: { type: "string" } },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;

  export const EditPhoneBodySchema = {
    type: "object",
    properties: { phoneNumber: { type: "string" } },
    required: ["phoneNumber"],
    additionalProperties: false,
  } as const;

  export const EditPhoneResponseSchema = BasicSuccessResponseSchema;

  export const OtpVerificationResponseSchema = BasicSuccessResponseSchema;

  export type PersonalDocType =
    | "national_id_front"
    | "national_id_back"
    | "passport_bio_page"
    | "personal_tax_document"
    | "user_photo";

  export type UserIdType = "national_id" | "passport";

  export interface PersonalDocument {
    docType: PersonalDocType;
    docUrl: string;
  }

  export interface UpdateUserAndDocumentsBody {
    idNumber: string;
    taxNumber: string;
    idType: UserIdType;
    documents: PersonalDocument[];
  }

  export const PersonalDocumentItemSchema = {
    type: "object",
    properties: {
      docType: {
        type: "string",
        enum: [
          "national_id_front",
          "national_id_back",
          "passport_bio_page",
          "personal_tax_document",
          "user_photo",
        ],
      },
      docUrl: { type: "string", minLength: 1, format: "uri" },
    },
    required: ["docType", "docUrl"],
    additionalProperties: false,
  } as const;

  export const UpdateUserAndDocumentsBodySchema = {
    type: "object",
    properties: {
      idNumber: { type: "string", minLength: 1, maxLength: 50 },
      taxNumber: { type: "string", minLength: 1, maxLength: 50 },
      idType: { type: "string", enum: ["national_id", "passport"] },
      documents: { type: "array", items: PersonalDocumentItemSchema, minItems: 1 },
    },
    required: ["idNumber", "taxNumber", "idType", "documents"],
    additionalProperties: false,
    allOf: [
      {
        if: { properties: { idType: { const: "national_id" } }, required: ["idType"] },
        then: {
          allOf: [
            {
              properties: {
                documents: {
                  type: "array",
                  contains: {
                    type: "object",
                    properties: { docType: { const: "national_id_front" } },
                    required: ["docType"],
                  },
                },
              },
            },
            {
              properties: {
                documents: {
                  type: "array",
                  contains: {
                    type: "object",
                    properties: { docType: { const: "national_id_back" } },
                    required: ["docType"],
                  },
                },
              },
            },
          ],
        },
      },
      {
        if: { properties: { idType: { const: "passport" } }, required: ["idType"] },
        then: {
          properties: {
            documents: {
              type: "array",
              contains: {
                type: "object",
                properties: { docType: { const: "passport_bio_page" } },
                required: ["docType"],
              },
            },
          },
        },
      },
    ],
  } as const;

  export const UpdateUserAndDocumentsResponseSchema = BasicSuccessResponseSchema;

  // ------------------------------------------------------------
  // Edit User Profile (exclude email and phoneNumber)
  // ------------------------------------------------------------
  // Allows updating core profile fields while explicitly disallowing
  // email and phoneNumber updates via schema-level constraints.
  export interface EditUserProfileBody {
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
    gender?: string;
    idNumber?: string;
    taxNumber?: string;
    dob?: string | Date;
    idType?: UserIdType;
    role?: string;
    position?: string;
  }

  // JSON Schema: does not include email or phoneNumber and sets
  // additionalProperties to false to prevent their presence.
  export const EditUserProfileBodySchema = {
    type: "object",
    properties: {
      firstName: { type: "string", minLength: 1, maxLength: 100 },
      lastName: { type: "string", minLength: 1, maxLength: 100 },
      imageUrl: { type: "string" },
      gender: { type: "string", minLength: 1, maxLength: 20 },
      idNumber: { type: "string", minLength: 1, maxLength: 50 },
      taxNumber: { type: "string", minLength: 1, maxLength: 50 },
      // Accept ISO date-time strings; service layer can coerce to Date
      dob: { type: "string", format: "date-time" },
      idType: { type: "string", enum: ["national_id", "passport"] },
      role: { type: "string", minLength: 1, maxLength: 50 },
      position: { type: "string", minLength: 1, maxLength: 50 },
    },
    required: [],
    additionalProperties: false,
  } as const;

  // Response can reuse the shared success schema
  export type EditUserProfileResponse = BasicSuccessResponse;
  export const EditUserProfileResponseSchema = BasicSuccessResponseSchema;

  export interface UserProfile {
    success: boolean;
    message: string;
    data: {
      firstName?: string;
      lastName?: string;
      imageUrl?: string;
      gender?: string;
      idNumber?: string;
      taxNumber?: string;
      dob?: string | Date;
      idType?: UserIdType;
      role?: string;
      position?: string;
      email?: string;
      phoneNumber?: string;
    };
  }
  export const GetUserProfileResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          imageUrl: { type: "string" },
          gender: { type: "string" },
          idNumber: { type: "string" },
          taxNumber: { type: "string" },
          dob: { type: "string" },
          idType: { type: "string" },
          role: { type: "string" },
          position: { type: "string" },
          email: { type: "string" },
          phoneNumber: { type: "string" },
        },
      },
    },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;
}
