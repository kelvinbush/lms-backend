export namespace InternalUsersModel {
  export type Role = "super-admin" | "admin" | "member";

  export interface CreateInvitationBody {
    email: string;
    role: Role;
  }

  export interface CreateInvitationResponse {
    success: boolean;
    invitationId: string;
  }

  export const CreateInvitationBodySchema = {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      role: { type: "string", enum: ["super-admin", "admin", "member"] },
    },
    required: ["email", "role"],
    additionalProperties: false,
  } as const;

  export const CreateInvitationResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      invitationId: { type: "string" },
    },
    required: ["success", "invitationId"],
    additionalProperties: false,
  } as const;

  export interface ListedUserItem {
    name: string;
    imageUrl?: string;
    phoneNumber?: string;
    email: string;
    role?: Role;
    status: "pending" | "active" | "inactive";
    clerkId?: string;
    invitationId?: string;
    createdAt?: string;
    updatedAt?: string;
  }

  export const ListedUserItemSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      imageUrl: { type: "string" },
      phoneNumber: { type: "string" },
      email: { type: "string" },
      role: { type: "string", enum: ["super-admin", "admin", "member"] },
      status: { type: "string", enum: ["pending", "active", "inactive"] },
      clerkId: { type: "string" },
      invitationId: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["name", "email", "status"],
    additionalProperties: true,
  } as const;

  export interface ListUsersResponse {
    items: ListedUserItem[];
  }
  export const ListUsersResponseSchema = {
    type: "object",
    properties: { items: { type: "array", items: ListedUserItemSchema } },
    required: ["items"],
    additionalProperties: false,
  } as const;

  export interface InvitationIdParams {
    id: string;
  }
  export const InvitationIdParamsSchema = {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  } as const;

  export interface BasicSuccessResponse {
    success: boolean;
  }
  export const BasicSuccessResponseSchema = {
    type: "object",
    properties: { success: { type: "boolean" } },
    required: ["success"],
    additionalProperties: false,
  } as const;

  export interface ClerkUserIdParams {
    clerkUserId: string;
  }
  export const ClerkUserIdParamsSchema = {
    type: "object",
    properties: { clerkUserId: { type: "string" } },
    required: ["clerkUserId"],
    additionalProperties: false,
  } as const;
}
