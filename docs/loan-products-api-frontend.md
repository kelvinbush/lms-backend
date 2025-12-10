# Loan Products API - Frontend Guide

## Base URL
```
/api/loan-products
```

## Authentication
- **Read operations** (GET): Public - no authentication required
- **Write operations** (POST, PATCH, DELETE): Requires authentication with `admin`, `super-admin`, or `member` role

## Product Status

Products have three statuses:
- **draft** - Being configured, not available for applications
- **active** - Available for new loan applications
- **archived** - Historical record, read-only

## Endpoints

### 1. List Loan Products
**GET** `/loan-products`

**Query Parameters:**
- `page?: string` - Page number (default: 1)
- `limit?: string` - Items per page (default: 20, max: 100)
- `status?: "draft" | "active" | "archived"` - Filter by status
- `includeArchived?: "true" | "false"` - Include archived (default: false)
- `currency?: string` - Filter by currency code
- `minAmount?: string` - Filter by minimum amount
- `maxAmount?: string` - Filter by maximum amount
- `minTerm?: string` - Filter by minimum term
- `maxTerm?: string` - Filter by maximum term
- `termUnit?: "days" | "weeks" | "months" | "quarters" | "years"`
- `ratePeriod?: "per_day" | "per_month" | "per_quarter" | "per_year"`
- `amortizationMethod?: "flat" | "reducing_balance"`
- `repaymentFrequency?: "weekly" | "biweekly" | "monthly" | "quarterly"`
- `isActive?: "true" | "false"` - Filter by active status
- `search?: string` - Search in name, description, summary
- `sortBy?: "name" | "createdAt" | "updatedAt" | "interestRate" | "minAmount" | "maxAmount"`
- `sortOrder?: "asc" | "desc"` - Default: desc

**Response (200 OK):**
```typescript
{
  success: boolean;
  message: string;
  data: LoanProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 2. Get Loan Product
**GET** `/loan-products/:id`

**Response (200 OK):** `LoanProduct`

### 3. Create Loan Product
**POST** `/loan-products`

**Authentication:** Required (admin/super-admin/member)

**Request Body:**
```typescript
{
  // Basic Details
  name: string;                    // Required, max 150 chars
  slug?: string;                   // Optional, max 180 chars
  summary?: string;
  description?: string;
  organizationId: string;         // Required
  userGroupIds: string[];          // Required, array of user group IDs
  currency: string;                // Required, ISO currency code
  minAmount: number;               // Required
  maxAmount: number;               // Required
  minTerm: number;                  // Required
  maxTerm: number;                  // Required
  termUnit: 'days' | 'weeks' | 'months' | 'quarters' | 'years';
  
  // Availability Window
  availabilityStartDate?: string;  // Optional, format: YYYY-MM-DD
  availabilityEndDate?: string;    // Optional, format: YYYY-MM-DD
  
  // Repayment Terms
  repaymentFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  maxGracePeriod?: number;
  maxGraceUnit?: 'days' | 'weeks' | 'months' | 'years';
  
  // Interest Details
  interestRate: number;            // Required, percentage
  ratePeriod: 'per_day' | 'per_month' | 'per_quarter' | 'per_year';
  amortizationMethod: 'flat' | 'reducing_balance';
  interestCollectionMethod: 'installments' | 'deducted' | 'capitalized';
  interestRecognitionCriteria: 'on_disbursement' | 'when_accrued';
  
  // Fees (Optional)
  fees?: Array<{
    loanFeeId?: string;            // Use existing fee
    feeName?: string;              // Create new fee inline
    calculationMethod: 'flat' | 'percentage';
    rate: number;
    collectionRule: 'upfront' | 'end_of_term';
    allocationMethod: string;
    calculationBasis: 'principal' | 'total_disbursed';
  }>;
  
  status?: 'draft' | 'active' | 'archived';  // Default: draft
  isActive?: boolean;                        // Default: true
}
```

**Response (201 Created):** `LoanProduct`

**Example:**
```json
{
  "name": "MK Green Facility",
  "slug": "MK-GF-001",
  "summary": "Green financing for SMEs",
  "organizationId": "org_123",
  "userGroupIds": ["ug_456"],
  "currency": "EUR",
  "minAmount": 1000,
  "maxAmount": 50000,
  "minTerm": 30,
  "maxTerm": 365,
  "termUnit": "days",
  "availabilityStartDate": "2024-01-01",
  "availabilityEndDate": "2024-12-31",
  "repaymentFrequency": "monthly",
  "maxGracePeriod": 7,
  "maxGraceUnit": "days",
  "interestRate": 5.5,
  "ratePeriod": "per_month",
  "amortizationMethod": "flat",
  "interestCollectionMethod": "installments",
  "interestRecognitionCriteria": "when_accrued",
  "fees": [
    {
      "feeName": "Processing Fee",
      "calculationMethod": "percentage",
      "rate": 2.5,
      "collectionRule": "upfront",
      "allocationMethod": "first_installment",
      "calculationBasis": "principal"
    }
  ]
}
```

### 4. Update Loan Product
**PATCH** `/loan-products/:id`

**Authentication:** Required (admin/super-admin/member)

**Request Body:** All fields optional (same structure as create)

**Edit Rules:**
- **draft**: ✅ Can edit all fields
- **active**: ✅ Can edit all fields (version increments on critical changes)
- **archived**: ❌ Cannot edit (read-only)

**Response (200 OK):** `LoanProduct`

### 5. Delete Loan Product
**DELETE** `/loan-products/:id`

**Authentication:** Required (admin/super-admin/member)

**Response (200 OK):**
```typescript
{
  success: boolean;
  message: string;
}
```

### 6. Update Product Status
**PATCH** `/loan-products/:id/status`

**Authentication:** Required (admin/super-admin/member)

**Request Body:**
```typescript
{
  status: 'draft' | 'active' | 'archived';
  changeReason: string;  // Required
  approvedBy: string;    // Required, user ID
}
```

**Valid Transitions:**
- `draft` → `active`
- `active` → `archived`
- `archived` → `active`

**Response (200 OK):** `LoanProduct`

### 7. Get Available Products
**GET** `/loan-products/available`

Returns only active products available for loan applications.

**Response (200 OK):**
```typescript
{
  success: boolean;
  message: string;
  data: LoanProduct[];
}
```

## Response Types

```typescript
interface LoanProduct {
  id: string;
  name: string;
  slug?: string | null;
  summary?: string | null;
  description?: string | null;
  organizationId: string;
  userGroupIds?: string[];
  currency: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  termUnit: 'days' | 'weeks' | 'months' | 'quarters' | 'years';
  availabilityStartDate?: string | null;  // YYYY-MM-DD
  availabilityEndDate?: string | null;    // YYYY-MM-DD
  repaymentFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  maxGracePeriod?: number | null;
  maxGraceUnit?: 'days' | 'weeks' | 'months' | 'years' | null;
  interestRate: number;
  ratePeriod: 'per_day' | 'per_month' | 'per_quarter' | 'per_year';
  amortizationMethod: 'flat' | 'reducing_balance';
  interestCollectionMethod: 'installments' | 'deducted' | 'capitalized';
  interestRecognitionCriteria: 'on_disbursement' | 'when_accrued';
  fees?: Array<{
    loanFeeId: string;
    feeName: string;
    calculationMethod: 'flat' | 'percentage';
    rate: number;
    collectionRule: 'upfront' | 'end_of_term';
    allocationMethod: string;
    calculationBasis: 'principal' | 'total_disbursed';
  }>;
  version: number;
  status: 'draft' | 'active' | 'archived';
  changeReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}
```

## Error Responses

All endpoints may return:
- **400 Bad Request** - Invalid input, invalid status transition, or archived product edit attempt
- **401 Unauthorized** - Missing or invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Loan product not found
- **409 Conflict** - Duplicate product name
- **500 Internal Server Error** - Server error

## Important Notes

- **Organization & User Groups**: Must exist before creating a loan product
- **Fees**: Can use existing fees via `loanFeeId` or create inline via `feeName`
- **Dates**: Availability dates must be in `YYYY-MM-DD` format
- **Archived Products**: Cannot be edited, only viewed
- **Versioning**: Active products auto-increment version on critical field changes
- **Validation**: `maxAmount >= minAmount`, `maxTerm >= minTerm`, `availabilityEndDate >= availabilityStartDate`
