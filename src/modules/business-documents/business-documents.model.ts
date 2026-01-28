import { businessDocumentTypeEnum } from "../../db/schema";
import type { BusinessDocumentType } from "../../db/schema";

export namespace BusinessDocumentsModel {
  // Keep a local runtime enum list to power JSON Schema (must be string[])
  export const BusinessDocumentTypeEnum: BusinessDocumentType[] = [
    // Reuse enum values directly from the DB schema as the single source of truth
    ...businessDocumentTypeEnum.enumValues,
  ];

  export interface BusinessDocumentItem {
    id?: string;
    docType: BusinessDocumentType;
    docUrl: string;
    isPasswordProtected?: boolean;
    docPassword?: string;
    docBankName?: string;
    docYear?: number;
    docName?: string | null;
  }

  // Body can be a single item or an array of items
  export type AddDocumentsBody = BusinessDocumentItem | BusinessDocumentItem[];

  // Params for routes that include :businessId
  export interface BusinessIdParams {
    id: string;
  }
  export const BusinessIdParamsSchema = {
    type: "object",
    additionalProperties: false,
    properties: { id: { type: "string", minLength: 1 } },
    required: ["id"],
  } as const;

  // JSON Schema for a single business document item
  export const BusinessDocumentItemSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      docType: { type: "string", enum: BusinessDocumentTypeEnum },
      docUrl: { type: "string", minLength: 1, format: "uri" },
      isPasswordProtected: { type: "boolean" },
      docPassword: { type: "string", minLength: 1, maxLength: 200 },
      docBankName: { type: "string", minLength: 1, maxLength: 100 },
      docYear: { type: "integer", minimum: 1900, maximum: 2100 },
      docName: { type: "string", minLength: 1, maxLength: 200 },
    },
    required: ["docType", "docUrl"],
    allOf: [
      // If isPasswordProtected true -> require docPassword
      {
        if: {
          properties: { isPasswordProtected: { const: true } },
          required: ["isPasswordProtected"],
        },
        then: { required: ["docPassword"] },
      },
      // If docType is audited_financial_statements -> require docYear
      {
        if: {
          properties: { docType: { const: "audited_financial_statements" } },
          required: ["docType"],
        },
        then: { required: ["docYear"] },
      },
      // If docType is annual_bank_statement -> require docYear and docBankName
      {
        if: { properties: { docType: { const: "annual_bank_statement" } }, required: ["docType"] },
        then: { required: ["docYear", "docBankName"] },
      },
      // If docType is 'other' -> require docName
      {
        if: { properties: { docType: { const: "other" } }, required: ["docType"] },
        then: { required: ["docName"] },
      },
    ],
  } as const;

  // Accept either a single document object or an array of document objects (min 1)
  export const AddDocumentsBodySchema = {
    anyOf: [
      BusinessDocumentItemSchema,
      { type: "array", items: BusinessDocumentItemSchema, minItems: 1 },
    ],
    additionalProperties: false,
  } as const;

  // Basic success response for add/upsert
  export interface BasicSuccessResponse {
    success: boolean;
    message: string;
  }
  export type AddDocumentsResponse = BasicSuccessResponse;
  export const AddDocumentsResponseSchema = {
    type: "object",
    properties: { success: { type: "boolean" }, message: { type: "string" } },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;

  // List response
  export interface ListDocumentsResponse {
    success: boolean;
    message: string;
    data: BusinessDocumentItem[];
  }
  export const ListDocumentsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: BusinessDocumentItemSchema },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
