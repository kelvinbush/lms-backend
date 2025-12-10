# API Requirements: Loan Product Creation

## Overview
This document outlines the API requirements for creating loan products through a single API call, consolidating data from all 3 steps of the loan product creation flow.

## Endpoint

### Create Loan Product
**POST** `/loan-products`

Creates a new loan product with all associated configuration in a single request.

## Request Payload

```typescript
interface CreateLoanProductRequest {
  // Step 1: Basic Loan Details (matches UI exactly)
  name: string;                    // Required, max 150 chars
  slug?: string;                   // Optional, max 180 chars (loan code/identifier)
  summary?: string;                // Optional (loan description)
  description?: string;            // Optional (full description)
  organizationId: string;         // Required (loan provider/organization ID - maps from UI field "loanProvider")
  userGroupIds: string[];          // Required (loan visibility - array of user group IDs, maps from UI field "loanVisibility" which is single value, transform to array)
  currency: string;                // Required, ISO currency code (e.g., "EUR", "USD")
  minAmount: number;              // Required, minimum loan amount
  maxAmount: number;              // Required, maximum loan amount
  minTerm: number;                // Required, minimum loan duration
  maxTerm: number;                // Required, maximum loan duration
  termUnit: 'days' | 'weeks' | 'months' | 'quarters' | 'years';  // Required
  
  // Optional: Loan availability window
  availabilityStartDate?: string; // ISO 8601 date string (optional, format: YYYY-MM-DD)
  availabilityEndDate?: string;   // ISO 8601 date string (optional, format: YYYY-MM-DD)
  
  // Step 2: Loan Repayment Terms (matches UI exactly)
  repaymentFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';  // Required
  maxGracePeriod?: number;        // Optional, maximum grace period value (from UI field "maxGracePeriod")
  maxGraceUnit?: 'days' | 'weeks' | 'months' | 'years';  // Optional, grace period unit (from UI field "maxGraceUnit")
  
  // Step 2: Loan Interest Details (matches UI exactly)
  interestRate: number;            // Required, interest rate percentage (from UI field "interestRate")
  ratePeriod: 'per_day' | 'per_month' | 'per_quarter' | 'per_year';  // Required
  amortizationMethod: 'flat' | 'reducing_balance';  // Required (interest calculation method)
  interestCollectionMethod: 'installments' | 'deducted' | 'capitalized';  // Required
  interestRecognitionCriteria: 'on_disbursement' | 'when_accrued';  // Required
  
  // Step 3: Loan Fees (matches UI exactly)
  fees?: LoanFeeConfiguration[];  // Optional array of loan fees
}

interface LoanFeeConfiguration {
  loanFeeId?: string;              // Optional, ID of existing loan fee
  feeName?: string;                // Required if loanFeeId not provided (for new fees)
  calculationMethod: 'flat' | 'percentage';  // Required
  rate: number;                    // Required, fee rate/percentage
  collectionRule: 'upfront' | 'end_of_term';  // Required
  allocationMethod: string;        // Required (e.g., "first_installment", "spread_installments")
  calculationBasis: 'principal' | 'total_disbursed';  // Required
}
```

## Response

### Success Response (201 Created)
```typescript
interface CreateLoanProductResponse {
  id: string;
  name: string;
  slug?: string;
  summary?: string;
  description?: string;
  organizationId: string;
  userGroupIds: string[];
  currency: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  termUnit: string;
  repaymentFrequency: string;
  interestRate: number;
  ratePeriod: string;
  amortizationMethod: string;
  interestCollectionMethod: string;
  interestRecognitionCriteria: string;
  fees: LoanFeeConfiguration[];
  isActive: boolean;
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
}
```

### Error Response (400 Bad Request)
```typescript
interface ErrorResponse {
  error: string;
  message: string;
  details?: {
    field: string;
    message: string;
  }[];
}
```

## Validation Rules

1. **Amount Validation**: `maxAmount >= minAmount`
2. **Term Validation**: `maxTerm >= minTerm`
3. **Currency**: Must be a valid ISO 4217 currency code
4. **Organization ID**: Must reference an existing organization
5. **User Group IDs**: All IDs must reference existing user groups (transform single `loanVisibility` value to array)
6. **Date Range**: If both `availabilityStartDate` and `availabilityEndDate` are provided, `availabilityEndDate >= availabilityStartDate`
7. **Fees**: If `loanFeeId` is provided, it must reference an existing loan fee. If creating a new fee inline, `feeName` is required.

## Example Request

```json
{
  "name": "MK Green Facility",
  "slug": "MK-GF-001",
  "summary": "A green financing loan product for SMEs",
  "currency": "EUR",
  "minAmount": 1000,
  "maxAmount": 50000,
  "minTerm": 30,
  "maxTerm": 365,
  "termUnit": "days",
  "organizationId": "org-123",
  "userGroupIds": ["ug-456", "ug-789"],
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
  ],
  "isActive": true
}
```

## Notes

- All required fields must be present and valid
- **Field Mapping** (UI → API transformations):
  - UI field `loanProvider` (string) → API field `organizationId` (string)
  - UI field `loanVisibility` (single string) → API field `userGroupIds` (string[]) - transform single value to array
  - UI fields `availabilityStartDate` and `availabilityEndDate` (Date objects) → API fields (ISO 8601 strings, format: YYYY-MM-DD) - transform using `format(date, 'yyyy-MM-dd')`
  - UI field `maxGracePeriod` (string) → API field `maxGracePeriod` (number) - convert string to number
  - UI field `interestRate` (string) → API field `interestRate` (number) - convert string to number
- The API should handle creation of inline loan fees if `feeName` is provided instead of `loanFeeId`
- User groups and organization must exist before creating the loan product
- The response should include the complete loan product object with all relationships resolved
- **Loan availability window**: Date range picker implemented in UI, dates should be formatted as ISO 8601 (YYYY-MM-DD) when submitting to API

