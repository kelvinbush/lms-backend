export namespace OrganizationsModel {
  export interface CreateOrganizationBody {
    name: string; // Required, max 255 chars
    description?: string; // Optional
  }

  export interface UpdateOrganizationBody {
    name?: string; // Optional, max 255 chars
    description?: string; // Optional
  }

  export interface OrganizationItem {
    id: string;
    name: string;
    description?: string | null;
    createdAt: string; // ISO 8601 timestamp
    updatedAt: string; // ISO 8601 timestamp
  }

  export interface ListOrganizationsQuery {
    page?: string;
    limit?: string;
    search?: string; // Search by name
  }

  export interface PaginatedOrganizationsResponse {
    items: OrganizationItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

  export const CreateOrganizationBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: "string" },
    },
    required: ["name"],
  } as const;

  export const UpdateOrganizationBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: "string" },
    },
  } as const;

  export const OrganizationItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "name", "createdAt", "updatedAt"],
    additionalProperties: true,
  } as const;

  export const PaginatedOrganizationsResponseSchema = {
    type: "object",
    properties: {
      items: { type: "array", items: OrganizationItemSchema },
      total: { type: "integer" },
      page: { type: "integer" },
      limit: { type: "integer" },
      totalPages: { type: "integer" },
    },
    required: ["items", "total", "page", "limit", "totalPages"],
  } as const;
}
