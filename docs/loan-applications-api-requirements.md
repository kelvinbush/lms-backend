# Loan Applications List Page & Stats API Requirements

This document outlines the data structure and API endpoints required for the loan applications list page, including pagination, filtering, sorting, and statistics.

## Table of Contents
1. [Loan Applications List Endpoint](#loan-applications-list-endpoint)
2. [Loan Applications Stats Endpoint](#loan-applications-stats-endpoint)
3. [Data Structures](#data-structures)
4. [Query Parameters](#query-parameters)
5. [Status Values](#status-values)

---

## 1. Loan Applications List Endpoint

### Endpoint
**GET** `/loan-applications`

### Description
Fetches a paginated list of loan applications with support for filtering, sorting, and searching.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 8 | Number of items per page |
| `status` | string | No | "all" | Filter by status: "all", "approved", "pending", "rejected", "disbursed", "cancelled" |
| `search` | string | No | "" | Search query (searches in loanId, product name, requestedAmount) |
| `sortBy` | string | No | "newest" | Sort option: "newest", "oldest", "ascending", "descending" |
| `sortField` | string | No | "createdAt" | Field to sort by (for backend implementation) |

### Response Structure

```typescript
interface ListLoanApplicationsResponse {
  success: boolean;
  message: string;
  data: {
    applications: LoanApplicationListItem[];
    pagination: PaginationMeta;
  };
}

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

### Example Request
```
GET /loan-applications?page=1&limit=8&status=pending&sortBy=newest&search=LN-48291
```

### Example Response
```json
{
  "success": true,
  "message": "Loan applications retrieved successfully",
  "data": {
    "applications": [
      {
        "id": "1",
        "loanId": "LN-48291",
        "product": "LPO Financing",
        "requestedAmount": "5000",
        "currency": "EUR",
        "tenure": "3 months",
        "status": "pending",
        "appliedOn": "2025-02-02T00:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 20,
      "itemsPerPage": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

## 2. Loan Applications Stats Endpoint

### Endpoint
**GET** `/loan-applications/stats`

### Description
Fetches aggregated statistics for loan applications grouped by status.

### Query Parameters
None required. Stats are calculated based on the authenticated user's loan applications.

### Response Structure

```typescript
interface LoanApplicationsStatsResponse {
  success: boolean;
  message: string;
  data: LoanStatsData;
}

interface LoanStatsData {
  totalApplications: number;
  approvedLoans: number;
  pendingApproval: number;
  rejectedApplications: number;
  disbursedLoans: number;
  cancelledApplications: number;
}
```

### Example Response
```json
{
  "success": true,
  "message": "Loan statistics retrieved successfully",
  "data": {
    "totalApplications": 20,
    "approvedLoans": 5,
    "pendingApproval": 8,
    "rejectedApplications": 3,
    "disbursedLoans": 3,
    "cancelledApplications": 1
  }
}
```

---

## 3. Data Structures

### LoanApplicationListItem

```typescript
interface LoanApplicationListItem {
  id: string;                    // Unique application ID (UUID)
  loanId: string;                 // Display ID (e.g., "LN-48291")
  product: string;                // Loan product name (e.g., "LPO Financing")
  requestedAmount: string;        // Formatted amount as string (e.g., "5,000")
  currency: string;               // ISO currency code (e.g., "EUR", "USD", "KES")
  tenure: string;                 // Formatted tenure (e.g., "3 months", "12 months")
  status: LoanStatus;             // Current status (see Status Values below)
  appliedOn: string;              // ISO 8601 date string (e.g., "2025-02-02T00:00:00Z")
}
```

### Field Mapping from Backend to Frontend

If your backend returns different field names, here's the mapping:

| Frontend Field | Backend Field (Suggested) | Notes |
|----------------|---------------------------|-------|
| `id` | `id` | Application UUID |
| `loanId` | `applicationNumber` or `loanApplicationNumber` | Display ID |
| `product` | `loanProduct.name` | From related loan product |
| `requestedAmount` | `fundingAmount` | Format with commas (e.g., "5,000") |
| `currency` | `fundingCurrency` | ISO currency code |
| `tenure` | `repaymentPeriod` + `termUnit` | Format as "X months/years" |
| `status` | `status` | Map to frontend status values |
| `appliedOn` | `createdAt` or `submittedAt` | ISO 8601 date |

### Status Mapping

Backend status values should be mapped to frontend status values:

| Backend Status | Frontend Status |
|----------------|----------------|
| `kyc_kyb_verification` | `pending` |
| `pending_approval` | `pending` |
| `under_review` | `pending` |
| `approved` | `approved` |
| `rejected` | `rejected` |
| `disbursed` | `disbursed` |
| `cancelled` | `cancelled` |
| `withdrawn` | `cancelled` |

---

## 4. Query Parameters Details

### Pagination

- **Page numbering**: 1-indexed (first page is 1, not 0)
- **Default page size**: 8 items per page
- **Maximum page size**: Recommended 50 items per page

### Filtering

#### Status Filter
- `status=all` - Returns all applications (no filter)
- `status=pending` - Returns applications with status: "pending"
- `status=approved` - Returns applications with status: "approved"
- `status=rejected` - Returns applications with status: "rejected"
- `status=disbursed` - Returns applications with status: "disbursed"
- `status=cancelled` - Returns applications with status: "cancelled"

#### Search
The search parameter should search across:
- `loanId` (application number)
- `product` (loan product name)
- `requestedAmount` (as string)

Search should be case-insensitive and support partial matches.

### Sorting

#### Sort Options
- `sortBy=newest` - Sort by `createdAt` or `submittedAt` descending (newest first)
- `sortBy=oldest` - Sort by `createdAt` or `submittedAt` ascending (oldest first)
- `sortBy=ascending` - Sort by `loanId` ascending (A-Z)
- `sortBy=descending` - Sort by `loanId` descending (Z-A)

---

## 5. Status Values

### Frontend Status Types

```typescript
type LoanStatus = "pending" | "approved" | "rejected" | "disbursed" | "cancelled";
type StatusFilter = "all" | "approved" | "pending" | "rejected" | "disbursed" | "cancelled";
```

### Status Display

| Status | Background Color | Text Color | Display Text |
|--------|------------------|------------|--------------|
| `pending` | `#FFE5B0` | `#8C5E00` | "Pending" |
| `approved` | `#B0EFDF` | `#007054` | "Approved" |
| `rejected` | `#E9B7BD` | `#650D17` | "Rejected" |
| `disbursed` | `#E1EFFE` | `#1E429F` | "Disbursed" |
| `cancelled` | `#B6BABC` | `#090D11` | "Cancelled" |

---

## Implementation Notes

### Frontend Expectations

1. **Pagination Component** expects:
   - `currentPage`: Current page number
   - `totalPages`: Total number of pages
   - `totalItems`: Total number of items across all pages
   - `startIndex`: Starting index of current page (0-indexed)
   - `endIndex`: Ending index of current page (0-indexed, exclusive)

2. **Search** is performed client-side on the filtered results, but should ideally be server-side for better performance with large datasets.

3. **Stats** are displayed in 6 stat cards:
   - Total Applications
   - Approved Loans
   - Pending Approval
   - Rejected Applications
   - Disbursed Loans
   - Cancelled Applications

### Backend Recommendations

1. **Pagination**: Use cursor-based pagination for better performance with large datasets, or offset-based if simpler.

2. **Search**: Implement full-text search on relevant fields for better user experience.

3. **Stats**: Consider caching stats since they don't change frequently. Invalidate cache when loan application status changes.

4. **Filtering**: Combine status filter with search for optimal results.

5. **Sorting**: Default to newest first if no sort parameter is provided.

### Error Handling

Both endpoints should return standard error responses:

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  error?: {
    code: string;
    details?: any;
  };
}
```

### Authentication

Both endpoints require authentication. The backend should:
- Filter applications based on the authenticated user
- For entrepreneurs: Show only their own applications
- For admins: Show all applications (or based on permissions)

---

## External User (Entrepreneur) Endpoints

### 1. List My Loan Applications

**GET** `/loan-applications/my-applications`

Retrieves a paginated list of loan applications for the authenticated entrepreneur (external user). Only returns applications where the user is the entrepreneur.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | string | No | "1" | Page number (1-indexed) |
| `limit` | string | No | "8" | Number of items per page (max: 50) |
| `status` | string | No | "all" | Filter by status: "all", "pending", "approved", "rejected", "disbursed", "cancelled" |
| `search` | string | No | "" | Search query (searches in loanId, product name, requestedAmount) |
| `sortBy` | string | No | "newest" | Sort option: "newest", "oldest", "ascending", "descending" |

#### Response (200 OK)

```typescript
{
  success: true;
  message: "Loan applications retrieved successfully";
  data: {
    applications: ExternalLoanApplicationListItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
```

#### Example Request
```
GET /loan-applications/my-applications?page=1&limit=8&status=pending&sortBy=newest&search=LN-48291
```

#### Example Response
```json
{
  "success": true,
  "message": "Loan applications retrieved successfully",
  "data": {
    "applications": [
      {
        "id": "app_123",
        "loanId": "LN-48291",
        "product": "LPO Financing",
        "requestedAmount": "5,000",
        "currency": "EUR",
        "tenure": "3 months",
        "status": "pending",
        "appliedOn": "2025-02-02T00:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 20,
      "itemsPerPage": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### 2. Get My Loan Application Detail

**GET** `/loan-applications/my-applications/:id`

Retrieves detailed information about a specific loan application for the authenticated entrepreneur. Only returns the application if the user is the entrepreneur.

#### Path Parameters

```typescript
{
  id: string; // Loan application ID
}
```

#### Response (200 OK)

```typescript
{
  success: true;
  message: "Loan application retrieved successfully";
  data: {
    id: string;
    loanId: string; // Display ID (e.g., "LN-48291")
    product: string; // Loan product name
    requestedAmount: string; // Formatted amount (e.g., "5,000")
    currency: string; // ISO currency code
    tenure: string; // Formatted tenure (e.g., "3 months", "50 days")
    status: "pending" | "approved" | "rejected" | "disbursed" | "cancelled";
    appliedOn: string; // ISO 8601 date string
    // Additional detail fields
    fundingAmount: number; // Raw amount
    repaymentPeriod: number; // Raw repayment period
    termUnit: string; // Unit from loan product (days, weeks, months, etc.)
    intendedUseOfFunds: string;
    interestRate: number;
    submittedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
    disbursedAt?: string;
    cancelledAt?: string;
    rejectionReason?: string;
  };
}
```

#### Error Responses

- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User is not the entrepreneur for this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

#### Notes

- **Authorization**: Entrepreneurs can only access their own applications
- **Status Mapping**: Backend statuses are mapped to simplified frontend statuses:
  - All review/workflow statuses → `"pending"`
  - `approved` → `"approved"`
  - `rejected` → `"rejected"`
  - `disbursed` → `"disbursed"`
  - `cancelled` → `"cancelled"`
- **Tenure Format**: Automatically formatted based on loan product's `termUnit` (e.g., "50 days", "3 months")
- **Amount Format**: Automatically formatted with commas (e.g., "5,000")

---

## Example Integration

### Frontend Hook Usage

```typescript
// Fetch loan applications list
const { data, isLoading } = useListLoanApplicationsQuery({
  page: 1,
  limit: 8,
  status: "pending",
  sortBy: "newest",
  search: ""
});

// Fetch stats
const { data: stats, isLoading: isLoadingStats } = useLoanApplicationsStatsQuery();
```

### Backend Implementation Checklist

- [ ] Implement GET `/loan-applications` with pagination
- [ ] Implement GET `/loan-applications/stats`
- [ ] Support status filtering
- [ ] Support search functionality
- [ ] Support sorting (newest, oldest, ascending, descending)
- [ ] Map backend status values to frontend status values
- [ ] Format amounts with commas (e.g., "5,000")
- [ ] Format tenure as "X months" or "X years"
- [ ] Return ISO 8601 date strings
- [ ] Implement proper error handling
- [ ] Add authentication/authorization checks
- [ ] Consider caching for stats endpoint
