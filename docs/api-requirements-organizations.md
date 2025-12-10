# API Requirements: Organizations CRUD

## Overview
This document outlines the API requirements for Organizations CRUD operations. Currently, we only require basic fields: `name` and `description`.

## Endpoints

### List Organizations
**GET** `/organizations`

Query Parameters:
- `page?: number` (default: 1)
- `limit?: number` (default: 10)
- `search?: string` (optional search by name)

Response:
```typescript
interface PaginatedOrganizationsResponse {
  items: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### Get Organization
**GET** `/organizations/:id`

Response:
```typescript
interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
}
```

### Create Organization
**POST** `/organizations`

Request Body:
```typescript
interface CreateOrganizationRequest {
  name: string;        // Required, max 255 chars
  description?: string; // Optional
}
```

Response: `Organization` (201 Created)

### Update Organization
**PUT** `/organizations/:id` or **PATCH** `/organizations/:id`

Request Body:
```typescript
interface UpdateOrganizationRequest {
  name?: string;        // Optional, max 255 chars
  description?: string; // Optional
}
```

Response: `Organization` (200 OK)

### Delete Organization
**DELETE** `/organizations/:id`

Response:
```typescript
interface DeleteOrganizationResponse {
  success: boolean;
  message?: string;
}
```

## Validation Rules

1. **Name**: Required, must be non-empty string, max 255 characters
2. **Description**: Optional, string field
3. **Name Uniqueness**: Organization names should be unique (backend decision)

## Example Requests

### Create Organization
```json
{
  "name": "MK Green Facility (Ecobank)",
  "description": "Green financing facility managed by Ecobank"
}
```

### Update Organization
```json
{
  "name": "MK Green Facility (Ecobank) - Updated",
  "description": "Updated description"
}
```

## Notes

- Organizations are used as loan providers in the loan product creation flow
- The `name` field is displayed in the "Loan provider/organization" dropdown in Step 1
- Organizations should be manageable through the `/organizations` page (to be implemented)
- When deleting an organization, consider if there are existing loan products referencing it (backend should handle this appropriately)

