# Admin SME Audit Trail API

## Overview

The Audit Trail API allows frontend applications to retrieve a complete history of all admin actions performed on SME user accounts. This provides transparency, accountability, and compliance tracking.

## Base URL

All endpoints are prefixed with `/admin/sme`

## Authentication

All endpoints require authentication with a role of `member`, `admin`, or `super-admin`.

## Endpoints

### GET /admin/sme/users/:userId/audit-trail

Retrieve the audit trail for a specific SME user.

#### Path Parameters

- `userId` (string, required) - The internal user ID of the SME user

#### Query Parameters

- `page` (string, optional) - Page number (default: 1)
- `limit` (string, optional) - Items per page (default: 50)
- `action` (string, optional) - Filter by specific action type

#### Action Types

Available action types for filtering:

- `user_created` - New SME user created
- `user_updated` - User information updated
- `user_details_updated` - Consolidated user details update
- `step_1_saved` - User info (Step 1) saved
- `step_2_saved` - Business basic info (Step 2) saved
- `step_3_saved` - Location info (Step 3) saved
- `step_4_saved` - Personal documents (Step 4) saved
- `step_5_saved` - Company info documents (Step 5) saved
- `step_6_saved` - Financial documents (Step 6) saved
- `step_7_saved` - Permits & pitch deck (Step 7) saved
- `business_info_updated` - Business information updated
- `financial_details_updated` - Financial details updated
- `invitation_sent` - Invitation sent to SME user
- `invitation_resent` - Invitation resent to SME user
- `documents_uploaded` - Documents uploaded
- `documents_updated` - Documents updated
- `documents_deleted` - Documents deleted

#### Response

**200 OK**

```json
{
  "items": [
    {
      "id": "clx1234567890",
      "action": "step_2_saved",
      "description": "Saved business basic info: Acme Corp",
      "details": {
        "businessName": "Acme Corp",
        "entityType": "LLC"
      },
      "beforeData": null,
      "afterData": {
        "name": "Acme Corp",
        "entityType": "LLC"
      },
      "adminUser": {
        "id": "clx0987654321",
        "email": "admin@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1
  }
}
```

**Response Fields:**

- `items` (array) - Array of audit trail entries
  - `id` (string) - Unique audit entry ID
  - `action` (string) - Action type performed
  - `description` (string | null) - Human-readable description
  - `details` (object | null) - Additional action details (JSON parsed)
  - `beforeData` (object | null) - State before action (for updates)
  - `afterData` (object | null) - State after action (for updates)
  - `adminUser` (object) - Admin who performed the action
    - `id` (string) - Admin user ID
    - `email` (string) - Admin email
    - `firstName` (string | null) - Admin first name
    - `lastName` (string | null) - Admin last name
  - `ipAddress` (string | null) - IP address of the request
  - `userAgent` (string | null) - Browser/client user agent
  - `createdAt` (string) - ISO 8601 timestamp

- `pagination` (object) - Pagination metadata
  - `page` (number) - Current page number
  - `limit` (number) - Items per page
  - `total` (number) - Total number of entries
  - `totalPages` (number) - Total number of pages

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Invalid query parameters",
  "code": "INVALID_QUERY"
}
```

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

**404 Not Found**
```json
{
  "error": "SME user not found",
  "code": "USER_NOT_FOUND"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal error",
  "code": "INTERNAL_ERROR"
}
```

## Usage Examples

### Fetch all audit trail entries for a user

```typescript
const response = await fetch(
  `/admin/sme/users/${userId}/audit-trail`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const data = await response.json();
```

### Fetch with pagination

```typescript
const response = await fetch(
  `/admin/sme/users/${userId}/audit-trail?page=2&limit=20`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const data = await response.json();
```

### Filter by action type

```typescript
const response = await fetch(
  `/admin/sme/users/${userId}/audit-trail?action=invitation_sent`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const data = await response.json();
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

function useAuditTrail(userId: string, page = 1, limit = 50, action?: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAuditTrail = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        if (action) params.append('action', action);

        const response = await fetch(
          `/admin/sme/users/${userId}/audit-trail?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch audit trail');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditTrail();
  }, [userId, page, limit, action]);

  return { data, loading, error };
}
```

## Notes

- Entries are sorted by `createdAt` in descending order (most recent first)
- The `details`, `beforeData`, and `afterData` fields are JSON objects that have been parsed from stored JSON strings
- If an admin user is deleted, the `adminUser` object will still contain the admin user ID, but email/name may show as "Unknown"
- IP addresses and user agents are captured automatically from the request headers
- The audit trail is read-only - entries cannot be modified or deleted through the API

## UI Recommendations

1. **Timeline View**: Display entries in a chronological timeline
2. **Action Badges**: Use color-coded badges for different action types
3. **Admin Info**: Show admin user email/name prominently
4. **Details Modal**: Expand `details`, `beforeData`, `afterData` in a modal for detailed view
5. **Filtering**: Provide dropdown/select for action type filtering
6. **Pagination**: Implement standard pagination controls
7. **Export**: Consider adding CSV/PDF export functionality (future enhancement)

