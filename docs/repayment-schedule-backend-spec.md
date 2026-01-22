# Repayment Schedule Backend Implementation Specification

## Overview

This document describes the repayment schedule calculation logic that needs to be implemented in the backend. The repayment schedule generates a detailed payment plan for loan applications based on various loan parameters including loan amount, interest rate, repayment period, structure, cycle, grace period, and return type.

## Table of Contents

1. [Data Models](#data-models)
2. [Input Parameters](#input-parameters)
3. [Core Calculation Logic](#core-calculation-logic)
4. [Output Structure](#output-structure)
5. [API Endpoints](#api-endpoints)
6. [Business Rules](#business-rules)
7. [Examples](#examples)

---

## Data Models

### PaymentScheduleRow

Represents a single payment in the repayment schedule.

```typescript
interface PaymentScheduleRow {
  paymentNo: number;              // Sequential payment number (1, 2, 3, ...)
  dueDate: Date;                  // Date when payment is due
  paymentDue: number;             // Total payment amount due
  interest: number;               // Interest portion of payment (or revenue share)
  principal: number;              // Principal portion of payment (or capital redemption)
  outstandingBalance: number;    // Remaining loan balance after payment (0 for revenue sharing except last)
}
```

### Loan Parameters

```typescript
interface RepaymentScheduleInput {
  loanAmount: number;                    // Principal loan amount
  interestRate: number;                  // Annual interest rate (as percentage, e.g., 12.5 for 12.5%)
  repaymentPeriod: number;              // Total number of payment periods (in months)
  repaymentStructure: "principal_and_interest" | "bullet_repayment";
  repaymentCycle: "daily" | "weekly" | "bi_weekly" | "monthly" | "quarterly";
  firstPaymentDate: string;              // ISO 8601 date string for first payment
  gracePeriod: number;                   // Grace period in months (default: 0)
  returnType: "interest_based" | "revenue_sharing";
  customFees?: CustomFee[];              // Optional custom fees
}

interface CustomFee {
  name: string;                          // Fee name (e.g., "Facility Fee", "Processing Fee")
  amount: number;                        // Fee amount (flat) or percentage rate
  type: "flat" | "percentage";           // Calculation method
}
```

### Repayment Schedule Response

```typescript
interface RepaymentScheduleResponse {
  schedule: PaymentScheduleRow[];
  summary: {
    totalPaymentDue: number;             // Sum of all paymentDue amounts
    totalInterest: number;               // Sum of all interest amounts
    totalPrincipal: number;              // Sum of all principal amounts
    monthlyPayment: number;              // Regular monthly payment (excluding grace period)
    facilityFee: number;                // Total facility fee from customFees
  };
  loanSummary: {
    loanAmount: number;
    currency: string;
    repaymentPeriod: number;
    interestRate: number;
    repaymentStructure: string;
    repaymentCycle: string;
    gracePeriod: number;
    firstPaymentDate: string;
    returnType: string;
  };
}
```

---

## Input Parameters

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `loanAmount` | number | Principal loan amount | `100000` |
| `interestRate` | number | Annual interest rate as percentage | `12.5` (for 12.5%) |
| `repaymentPeriod` | number | Total number of payment periods | `12` (12 months) |
| `repaymentStructure` | string | Payment structure type | `"principal_and_interest"` or `"bullet_repayment"` |
| `repaymentCycle` | string | Payment frequency | `"monthly"`, `"quarterly"`, etc. |
| `firstPaymentDate` | string | ISO 8601 date for first payment | `"2024-01-15T00:00:00Z"` |
| `returnType` | string | Return calculation type | `"interest_based"` or `"revenue_sharing"` |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `gracePeriod` | number | `0` | Grace period in months |
| `customFees` | CustomFee[] | `[]` | Additional fees (facility fees, etc.) |

---

## Core Calculation Logic

### Step 1: Determine Payment Cycle Multiplier

Convert repayment cycle to months between payments:

```typescript
const monthsPerCycle: Record<string, number> = {
  daily: 1/30,        // ~0.033 months
  weekly: 7/30,       // ~0.233 months
  bi_weekly: 14/30,   // ~0.467 months
  monthly: 1,         // 1 month
  quarterly: 3,       // 3 months
};

const cycleMonths = monthsPerCycle[repaymentCycle] || 1;
```

### Step 2: Calculate Based on Return Type

#### A. Revenue Sharing Model

**Key Characteristics:**
- Revenue Share Rate is a **FLAT total percentage** (not annual)
- Capital is repaid in **FULL at the END** (bullet style)
- Monthly revenue share = Total share / Term

**Calculation:**

```typescript
// Total revenue share = Loan Amount × (Revenue Share Rate / 100)
const totalRevenueShare = loanAmount * (interestRate / 100);

// Monthly revenue share (distributed evenly)
const monthlyRevenueShare = totalRevenueShare / repaymentPeriod;

// For each payment period:
for (let i = 1; i <= repaymentPeriod; i++) {
  const isLastPayment = (i === repaymentPeriod);
  
  // Capital redemption only on last payment
  const capitalRedemption = isLastPayment ? loanAmount : 0;
  
  // Total payment = revenue share + capital (if last payment)
  const paymentDue = monthlyRevenueShare + capitalRedemption;
  
  // Outstanding balance stays at loanAmount until last payment
  const outstandingBalance = isLastPayment ? 0 : loanAmount;
  
  // Interest field stores revenue share distribution
  // Principal field stores capital redemption
}
```

**Example:**
- Loan Amount: 100,000
- Revenue Share Rate: 15% (total, not annual)
- Repayment Period: 12 months
- Total Revenue Share: 100,000 × 0.15 = 15,000
- Monthly Revenue Share: 15,000 / 12 = 1,250
- Payments 1-11: Payment Due = 1,250 (revenue share only)
- Payment 12: Payment Due = 1,250 + 100,000 = 101,250 (revenue share + capital)

#### B. Interest-Based Model

**Key Characteristics:**
- Uses annual interest rate
- Supports grace period (interest-only payments)
- Two repayment structures: amortized or bullet

**Calculation:**

```typescript
// Convert annual rate to monthly rate
const monthlyInterestRate = interestRate / 100 / 12;

// Determine grace period and amortization periods
const gracePeriodPayments = gracePeriod;
const amortizationPayments = repaymentPeriod - gracePeriodPayments;

// Calculate amortized payment (if applicable)
let amortizedPayment = 0;
if (amortizationPayments > 0 && repaymentStructure === "principal_and_interest") {
  // Standard amortization formula
  amortizedPayment = loanAmount * 
    (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, amortizationPayments)) / 
    (Math.pow(1 + monthlyInterestRate, amortizationPayments) - 1);
}

let outstandingBalance = loanAmount;

// For each payment period:
for (let i = 1; i <= repaymentPeriod; i++) {
  const isGracePeriodPayment = (i <= gracePeriodPayments);
  const isLastPayment = (i === repaymentPeriod);
  
  if (isGracePeriodPayment) {
    // Grace period: Interest-only, no principal reduction
    interestPayment = outstandingBalance * monthlyInterestRate;
    principalPayment = 0;
    paymentDue = interestPayment;
    // Balance remains unchanged
    
  } else if (repaymentStructure === "principal_and_interest") {
    // Amortized repayment after grace period
    interestPayment = outstandingBalance * monthlyInterestRate;
    principalPayment = amortizedPayment - interestPayment;
    paymentDue = amortizedPayment;
    outstandingBalance -= principalPayment;
    
    // Handle rounding on last payment
    if (isLastPayment) {
      outstandingBalance = 0;
    }
    
  } else {
    // Bullet repayment: Interest only until last payment
    interestPayment = outstandingBalance * monthlyInterestRate;
    principalPayment = isLastPayment ? loanAmount : 0;
    paymentDue = isLastPayment ? loanAmount + interestPayment : interestPayment;
    
    if (isLastPayment) {
      outstandingBalance = 0;
    }
  }
}
```

**Example 1: Amortized with Grace Period**
- Loan Amount: 100,000
- Interest Rate: 12% annual
- Repayment Period: 12 months
- Grace Period: 3 months
- Repayment Structure: principal_and_interest

**Calculation:**
- Monthly Interest Rate: 12% / 12 = 1% = 0.01
- Grace Period Payments: 3 (interest-only)
- Amortization Payments: 9
- Amortized Payment (for months 4-12): ~11,702.05

**Schedule:**
- Months 1-3: Payment Due = 1,000 (interest only), Balance = 100,000
- Months 4-11: Payment Due = 11,702.05, Interest ~1,000, Principal ~10,702, Balance decreases
- Month 12: Payment Due = 11,702.05 (adjusted for rounding), Balance = 0

**Example 2: Bullet Repayment**
- Loan Amount: 100,000
- Interest Rate: 12% annual
- Repayment Period: 12 months
- Repayment Structure: bullet_repayment

**Schedule:**
- Months 1-11: Payment Due = 1,000 (interest only), Balance = 100,000
- Month 12: Payment Due = 101,000 (interest + principal), Balance = 0

### Step 3: Calculate Due Dates

```typescript
const startDate = new Date(firstPaymentDate);

for (let i = 1; i <= repaymentPeriod; i++) {
  const dueDate = new Date(startDate);
  // Add (i - 1) * cycleMonths to start date
  dueDate.setMonth(dueDate.getMonth() + (i - 1) * cycleMonths);
  
  // Store dueDate in schedule row
}
```

**Note:** Date calculation should handle month-end edge cases (e.g., if start date is Jan 31, next payment should be Feb 28/29, not invalid date).

### Step 4: Calculate Custom Fees (Facility Fee)

```typescript
let facilityFee = 0;

for (const fee of customFees) {
  if (fee.type === "flat") {
    facilityFee += fee.amount;
  } else if (fee.type === "percentage") {
    facilityFee += (loanAmount * fee.amount / 100);
  }
}
```

**Note:** Facility fee is typically a one-time fee and may be added to the first payment or disbursement, but it's shown separately in the summary.

---

## Output Structure

### Payment Schedule Array

Array of `PaymentScheduleRow` objects, one for each payment period.

### Summary Totals

```typescript
{
  totalPaymentDue: number,    // Sum of all paymentDue values
  totalInterest: number,       // Sum of all interest values
  totalPrincipal: number,      // Sum of all principal values (should equal loanAmount for interest_based)
  monthlyPayment: number,     // Regular payment amount (excluding grace period)
  facilityFee: number         // Total from customFees
}
```

**Monthly Payment Calculation:**

For **revenue_sharing**: Monthly payment = first payment's revenue share (same for all except last)

For **interest_based**: Monthly payment = first amortized payment after grace period (or first payment if no grace period)

```typescript
function getMonthlyPayment(schedule: PaymentScheduleRow[], returnType: string, gracePeriod: number): number {
  if (schedule.length === 0) return 0;
  
  if (returnType === "revenue_sharing") {
    // Revenue sharing: monthly payment is the revenue share
    return schedule[0].interest; // Revenue share distribution
  } else {
    // Interest-based: find first non-grace period payment
    const firstAmortizedPayment = schedule.find((row, index) => index >= gracePeriod);
    return firstAmortizedPayment ? firstAmortizedPayment.paymentDue : schedule[0].paymentDue;
  }
}
```

---

## API Endpoints

### 1. Calculate Repayment Schedule

**Endpoint:** `POST /api/loan-applications/:id/repayment-schedule/calculate`

**Request Body:**
```json
{
  "loanAmount": 100000,
  "interestRate": 12.5,
  "repaymentPeriod": 12,
  "repaymentStructure": "principal_and_interest",
  "repaymentCycle": "monthly",
  "firstPaymentDate": "2024-01-15T00:00:00Z",
  "gracePeriod": 0,
  "returnType": "interest_based",
  "customFees": [
    {
      "name": "Facility Fee",
      "amount": 2500,
      "type": "flat"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": [
      {
        "paymentNo": 1,
        "dueDate": "2024-01-15T00:00:00Z",
        "paymentDue": 8884.87,
        "interest": 1041.67,
        "principal": 7843.20,
        "outstandingBalance": 92156.80
      },
      // ... more rows
    ],
    "summary": {
      "totalPaymentDue": 106618.44,
      "totalInterest": 6618.44,
      "totalPrincipal": 100000.00,
      "monthlyPayment": 8884.87,
      "facilityFee": 2500.00
    },
    "loanSummary": {
      "loanAmount": 100000,
      "currency": "USD",
      "repaymentPeriod": 12,
      "interestRate": 12.5,
      "repaymentStructure": "principal_and_interest",
      "repaymentCycle": "monthly",
      "gracePeriod": 0,
      "firstPaymentDate": "2024-01-15T00:00:00Z",
      "returnType": "interest_based"
    }
  }
}
```

### 2. Get Repayment Schedule (from Loan Application)

**Endpoint:** `GET /api/loan-applications/:id/repayment-schedule`

**Response:** Same as above, but calculated from loan application's active version or base data.

### 3. Regenerate Schedule (Submit Counter Offer)

**Endpoint:** `POST /api/loan-applications/:id/counter-offer`

**Request Body:**
```json
{
  "fundingAmount": 100000,
  "repaymentPeriod": 12,
  "returnType": "interest_based",
  "interestRate": 12.5,
  "repaymentStructure": "principal_and_interest",
  "repaymentCycle": "monthly",
  "gracePeriod": 90,  // in days (converted to months: 90/30 = 3 months)
  "firstPaymentDate": "2024-01-15T00:00:00Z",
  "customFees": [
    {
      "name": "Facility Fee",
      "amount": 2500,
      "type": "flat"
    }
  ]
}
```

**Note:** This endpoint updates the loan application's active version and returns the updated repayment schedule.

---

## Business Rules

### 1. Visibility Rules

- Repayment schedule is only available when loan application status is:
  - `document_generation`
  - `signing_execution`
  - `awaiting_disbursement`
  - `disbursed`

- Regeneration is only allowed at `document_generation` stage.

### 2. Data Priority

When calculating schedule, use data in this order:
1. `activeVersion` data (if exists)
2. Base loan application data (fallback)

### 3. Rounding Rules

- All monetary values should be rounded to 2 decimal places.
- On the last payment, ensure `outstandingBalance` is exactly 0 (adjust final payment if needed).
- Total principal should equal loan amount (for interest_based loans).

### 4. Date Handling

- Due dates are calculated by adding `(paymentNo - 1) * cycleMonths` to `firstPaymentDate`.
- Handle month-end edge cases (e.g., Jan 31 + 1 month = Feb 28/29).
- All dates should be in ISO 8601 format.

### 5. Grace Period

- Grace period is specified in **days** in the API but converted to **months** for calculation (divide by 30, round).
- During grace period: interest-only payments, no principal reduction.
- After grace period: normal amortization or bullet repayment applies.

### 6. Revenue Sharing Model

- Revenue Share Rate is a **total percentage**, not annual.
- Capital is repaid in full on the last payment (bullet style).
- Monthly revenue share is distributed evenly across all periods.
- Outstanding balance remains at loan amount until last payment.

### 7. Custom Fees

- Facility fees are calculated separately and shown in summary.
- Fees can be flat amounts or percentages of loan amount.
- Fees are typically one-time charges (not included in payment schedule rows).

---

## Examples

### Example 1: Amortized Loan with Grace Period

**Input:**
```json
{
  "loanAmount": 100000,
  "interestRate": 12,
  "repaymentPeriod": 12,
  "repaymentStructure": "principal_and_interest",
  "repaymentCycle": "monthly",
  "firstPaymentDate": "2024-01-15T00:00:00Z",
  "gracePeriod": 3,
  "returnType": "interest_based"
}
```

**Output (first 5 and last rows):**
```json
{
  "schedule": [
    {
      "paymentNo": 1,
      "dueDate": "2024-01-15T00:00:00Z",
      "paymentDue": 1000.00,
      "interest": 1000.00,
      "principal": 0.00,
      "outstandingBalance": 100000.00
    },
    {
      "paymentNo": 2,
      "dueDate": "2024-02-15T00:00:00Z",
      "paymentDue": 1000.00,
      "interest": 1000.00,
      "principal": 0.00,
      "outstandingBalance": 100000.00
    },
    {
      "paymentNo": 3,
      "dueDate": "2024-03-15T00:00:00Z",
      "paymentDue": 1000.00,
      "interest": 1000.00,
      "principal": 0.00,
      "outstandingBalance": 100000.00
    },
    {
      "paymentNo": 4,
      "dueDate": "2024-04-15T00:00:00Z",
      "paymentDue": 11702.05,
      "interest": 1000.00,
      "principal": 10702.05,
      "outstandingBalance": 89297.95
    },
    {
      "paymentNo": 5,
      "dueDate": "2024-05-15T00:00:00Z",
      "paymentDue": 11702.05,
      "interest": 892.98,
      "principal": 10809.07,
      "outstandingBalance": 78488.88
    },
    // ... rows 6-11 ...
    {
      "paymentNo": 12,
      "dueDate": "2024-12-15T00:00:00Z",
      "paymentDue": 11702.05,
      "interest": 115.73,
      "principal": 11586.32,
      "outstandingBalance": 0.00
    }
  ],
  "summary": {
    "totalPaymentDue": 105302.60,
    "totalInterest": 5302.60,
    "totalPrincipal": 100000.00,
    "monthlyPayment": 11702.05,
    "facilityFee": 0.00
  }
}
```

### Example 2: Revenue Sharing Model

**Input:**
```json
{
  "loanAmount": 100000,
  "interestRate": 15,
  "repaymentPeriod": 12,
  "repaymentStructure": "bullet_repayment",
  "repaymentCycle": "monthly",
  "firstPaymentDate": "2024-01-15T00:00:00Z",
  "gracePeriod": 0,
  "returnType": "revenue_sharing"
}
```

**Output (first 3 and last rows):**
```json
{
  "schedule": [
    {
      "paymentNo": 1,
      "dueDate": "2024-01-15T00:00:00Z",
      "paymentDue": 1250.00,
      "interest": 1250.00,
      "principal": 0.00,
      "outstandingBalance": 100000.00
    },
    {
      "paymentNo": 2,
      "dueDate": "2024-02-15T00:00:00Z",
      "paymentDue": 1250.00,
      "interest": 1250.00,
      "principal": 0.00,
      "outstandingBalance": 100000.00
    },
    // ... rows 3-11 (same pattern) ...
    {
      "paymentNo": 12,
      "dueDate": "2024-12-15T00:00:00Z",
      "paymentDue": 101250.00,
      "interest": 1250.00,
      "principal": 100000.00,
      "outstandingBalance": 0.00
    }
  ],
  "summary": {
    "totalPaymentDue": 115000.00,
    "totalInterest": 15000.00,
    "totalPrincipal": 100000.00,
    "monthlyPayment": 1250.00,
    "facilityFee": 0.00
  }
}
```

### Example 3: Bullet Repayment

**Input:**
```json
{
  "loanAmount": 100000,
  "interestRate": 12,
  "repaymentPeriod": 12,
  "repaymentStructure": "bullet_repayment",
  "repaymentCycle": "monthly",
  "firstPaymentDate": "2024-01-15T00:00:00Z",
  "gracePeriod": 0,
  "returnType": "interest_based"
}
```

**Output (first 2 and last rows):**
```json
{
  "schedule": [
    {
      "paymentNo": 1,
      "dueDate": "2024-01-15T00:00:00Z",
      "paymentDue": 1000.00,
      "interest": 1000.00,
      "principal": 0.00,
      "outstandingBalance": 100000.00
    },
    // ... rows 2-11 (same pattern: 1000 interest only) ...
    {
      "paymentNo": 12,
      "dueDate": "2024-12-15T00:00:00Z",
      "paymentDue": 101000.00,
      "interest": 1000.00,
      "principal": 100000.00,
      "outstandingBalance": 0.00
    }
  ],
  "summary": {
    "totalPaymentDue": 112000.00,
    "totalInterest": 12000.00,
    "totalPrincipal": 100000.00,
    "monthlyPayment": 1000.00,
    "facilityFee": 0.00
  }
}
```

---

## Implementation Notes

### 1. Precision and Rounding

- Use decimal arithmetic libraries (e.g., `decimal.js` in JavaScript/TypeScript, `decimal.Decimal` in Python) to avoid floating-point precision issues.
- Round all monetary values to 2 decimal places at the end of calculations.
- Ensure the last payment adjusts to make outstanding balance exactly 0.

### 2. Date Calculations

- Use proper date libraries that handle month-end edge cases.
- Example: If first payment is Jan 31 and cycle is monthly, second payment should be Feb 28/29 (not invalid date).

### 3. Validation

Validate inputs:
- `loanAmount` > 0
- `interestRate` >= 0
- `repaymentPeriod` > 0
- `gracePeriod` >= 0 and < `repaymentPeriod`
- `firstPaymentDate` is a valid date
- `repaymentStructure` is one of allowed values
- `repaymentCycle` is one of allowed values
- `returnType` is one of allowed values

### 4. Error Handling

- Return clear error messages for invalid inputs.
- Handle edge cases (e.g., 0% interest rate, 1-month term, etc.).
- Validate that grace period doesn't exceed repayment period.

### 5. Performance

- Calculation is O(n) where n = repaymentPeriod.
- For large repayment periods (e.g., 360 months), ensure efficient date calculations.

---

## Testing Checklist

- [ ] Amortized loan without grace period
- [ ] Amortized loan with grace period
- [ ] Bullet repayment without grace period
- [ ] Bullet repayment with grace period
- [ ] Revenue sharing model
- [ ] Different repayment cycles (daily, weekly, bi-weekly, monthly, quarterly)
- [ ] Edge cases: 1-month term, 0% interest, very large loan amounts
- [ ] Date edge cases: month-end dates, leap years
- [ ] Rounding: last payment ensures balance = 0
- [ ] Custom fees calculation
- [ ] Total principal equals loan amount (for interest_based)
- [ ] Monthly payment calculation for both return types

---

## Migration Notes

When implementing in the backend:

1. **Preserve existing calculations**: Ensure the backend produces identical results to the frontend implementation.
2. **API compatibility**: Maintain the same request/response structure as documented.
3. **Data storage**: Consider storing calculated schedules in the database for historical records.
4. **Versioning**: Track changes to repayment schedules when counter offers are submitted.

---
