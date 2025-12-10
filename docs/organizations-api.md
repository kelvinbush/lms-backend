# Organizations API

## Base URL
```
/api/organizations
```

## Authentication
- **Read operations** (GET): Public - no authentication required
- **Write operations** (POST, PATCH, DELETE): Requires authentication with `admin`, `super-admin`, or `member` role

## Endpoints

### 1. List Organizations
**GET** `/organizations`

**Query Parameters:**
- `page?: string` - Page number (default: 1)
- `limit?: string` - Items per page (default: 10, max: 100)
- `search?: string` - Search by organization name

**Response (200 OK):**
```typescript
{
  items: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Organization {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
}
```

**Example:**
```bash
GET /organizations?page=1&limit=20&search=Ecobank
```

### 2. Get Organization
**GET** `/organizations/:id`

**Response (200 OK):** `Organization`

**Example:**
```bash
GET /organizations/org_123456
```

### 3. Create Organization
**POST** `/organizations`

**Authentication:** Required (admin/super-admin/member)

**Request Body:**
```typescript
{
  name: string;        // Required, max 255 chars
  description?: string; // Optional
}
```

**Response (201 Created):** `Organization`

**Example:**
```json
{
  "name": "MK Green Facility (Ecobank)",
  "description": "Green financing facility managed by Ecobank"
}
```

### 4. Update Organization
**PATCH** `/organizations/:id`

**Authentication:** Required (admin/super-admin/member)

**Request Body:**
```typescript
{
  name?: string;        // Optional, max 255 chars
  description?: string;  // Optional
}
```

**Response (200 OK):** `Organization`

### 5. Delete Organization
**DELETE** `/organizations/:id`

**Authentication:** Required (admin/super-admin/member)

**Response (200 OK):**
```typescript
{
  success: boolean;
  message: string;
}
```

## Error Responses

All endpoints may return:
- **400 Bad Request** - Invalid input data
- **401 Unauthorized** - Missing or invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Organization not found
- **409 Conflict** - Duplicate organization name
- **500 Internal Server Error** - Server error

## Notes

- Organization names must be unique
- Organizations are used as loan providers in loan product creation
- Deleting an organization may fail if it's referenced by existing loan products (backend handles this)
