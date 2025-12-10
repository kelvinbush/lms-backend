# Loan Fees API

## Base URL
```
/api/loan-fees
```

## Authentication
- **Read operations** (GET): Public - no authentication required
- **Write operations** (POST, PATCH, DELETE): Requires authentication with `admin`, `super-admin`, or `member` role

## Endpoints

### 1. List Loan Fees
**GET** `/loan-fees`

**Query Parameters:**
- `page?: string` - Page number (default: 1)
- `limit?: string` - Items per page (default: 10, max: 100)
- `search?: string` - Search by fee name
- `includeArchived?: "true" | "false"` - Include archived fees (default: false)

**Response (200 OK):**
```typescript
{
  items: LoanFee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LoanFee {
  id: string;
  name: string;
  calculationMethod: 'flat' | 'percentage';
  rate: number;
  collectionRule: 'upfront' | 'end_of_term';
  allocationMethod: string;
  calculationBasis: 'principal' | 'total_disbursed';
  isArchived: boolean;
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
}
```

**Example:**
```bash
GET /loan-fees?page=1&limit=20&search=processing
```

### 2. Get Loan Fee
**GET** `/loan-fees/:id`

**Response (200 OK):** `LoanFee`

### 3. Create Loan Fee
**POST** `/loan-fees`

**Authentication:** Required (admin/super-admin/member)

**Request Body:**
```typescript
{
  name: string;                    // Required, max 255 chars
  calculationMethod: 'flat' | 'percentage';
  rate: number;                    // Required, fee rate/percentage
  collectionRule: 'upfront' | 'end_of_term';
  allocationMethod: string;         // e.g., "first_installment", "spread_installments"
  calculationBasis: 'principal' | 'total_disbursed';
}
```

**Response (201 Created):** `LoanFee`

**Example:**
```json
{
  "name": "Processing Fee",
  "calculationMethod": "percentage",
  "rate": 2.5,
  "collectionRule": "upfront",
  "allocationMethod": "first_installment",
  "calculationBasis": "principal"
}
```

### 4. Update Loan Fee
**PATCH** `/loan-fees/:id`

**Authentication:** Required (admin/super-admin/member)

**Request Body:** All fields optional (same as create)

**Response (200 OK):** `LoanFee`

### 5. Delete Loan Fee
**DELETE** `/loan-fees/:id`

**Authentication:** Required (admin/super-admin/member)

**Special Behavior:**
- If fee is **linked to loan products**: Archives the fee instead of deleting
- If fee is **not linked**: Soft deletes the fee

**Response (200 OK):**
```typescript
{
  success: boolean;
  message: string;  // Indicates if archived or deleted
}
```

### 6. Unarchive Loan Fee
**POST** `/loan-fees/:id/unarchive`

**Authentication:** Required (admin/super-admin/member)

**Response (200 OK):** `LoanFee`

## Error Responses

All endpoints may return:
- **400 Bad Request** - Invalid input data or fee not archived (for unarchive)
- **401 Unauthorized** - Missing or invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Loan fee not found
- **409 Conflict** - Duplicate fee name
- **500 Internal Server Error** - Server error

## Notes

- Loan fees can be reused across multiple loan products
- Fees linked to products cannot be deleted, only archived
- Archived fees can be unarchived and reused
