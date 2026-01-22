# Loan Products: Remove `isActive` Field - Refactoring Plan

## Summary

The `isActive` boolean field in `loan_products` table is redundant with the `status` enum field. This document outlines the plan to remove `isActive` and use only `status` for consistency.

## Current State

- **`status`**: Enum with values `"draft"`, `"active"`, `"archived"` - Primary lifecycle field
- **`isActive`**: Boolean (default: `true`) - Redundant field that should always match `status === "active"`

## Issues with Current Implementation

1. **Redundant Validation**: `validateLoanProduct` checks both `isActive === true` AND `status === "active"`
2. **Inconsistent Updates**: `updateStatus` only updates `status`, not `isActive`, causing potential inconsistency
3. **Redundant Deletion**: `remove` sets both `isActive: false` AND `status: "archived"`
4. **Independent Setting**: `create` allows setting `isActive` independently of `status`

## Files to Modify

### 1. Database Schema
- **File**: `src/db/schema/loanProducts.ts`
  - Remove `isActive: boolean("is_active")` field
  - Remove index `idxLoanProductsActive`

### 2. Service Layer
- **File**: `src/modules/loan-products/loan-products.service.ts`
  - Remove `isActive` from `create` method (line 231)
  - Remove `isActive` filter from `list` method (lines 398-401)
  - Remove `isActive` from `update` method (line 785)
  - Remove `isActive: false` from `remove` method (line 940)
  - Remove `isActive` from all `select` queries (lines 482, 586, 1163)
  - Update `mapRow` function to derive `isActive` from `status` if needed for backward compatibility

### 3. Models
- **File**: `src/modules/loan-products/loan-products.model.ts`
  - Remove `isActive?: boolean` from `CreateLoanProductBody` (line 75)
  - Remove `isActive?: boolean` from `EditLoanProductBody` (line 105)
  - Remove `isActive?: string` from `ListLoanProductsQuery` (line 128)
  - Remove `isActive: boolean` from `LoanProductItem` (line 278)
  - Remove `isActive` from JSON schemas (lines 184, 317, 340)

### 4. Routes
- **File**: `src/routes/loan-products.routes.ts`
  - Remove `isActive` query parameter from search endpoint (lines 246, 254)
  - Remove `isActive` from response transformation (line 276)
  - Remove `isActive` from schema definitions (lines 86, 161, 187)

### 5. Validators
- **File**: `src/modules/loan-applications/loan-applications.validators.ts`
  - Remove `eq(loanProducts.isActive, true)` check (line 43)
  - Keep only `eq(loanProducts.status, "active")` check (line 44)

## Migration Strategy

### Option 1: Clean Removal (Recommended)
1. Remove all `isActive` references from code
2. Create database migration to drop `is_active` column and index
3. Update frontend to use `status === "active"` instead of `isActive`

### Option 2: Backward Compatibility (If Frontend Depends on `isActive`)
1. Keep `isActive` in API responses as a computed field: `isActive: status === "active"`
2. Remove `isActive` from database schema
3. Remove `isActive` from create/update operations
4. Gradually migrate frontend to use `status`

## Database Migration

```sql
-- Drop index first
DROP INDEX IF EXISTS idx_loan_products_active;

-- Drop column
ALTER TABLE loan_products DROP COLUMN IF EXISTS is_active;
```

## Testing Checklist

- [ ] Create loan product (should not accept `isActive` in request)
- [ ] Update loan product (should not accept `isActive` in request)
- [ ] List loan products (should not filter by `isActive`, use `status` instead)
- [ ] Search loan products (should not use `isActive` query parameter)
- [ ] Get loan product by ID (should not return `isActive` in response)
- [ ] Update product status (should work correctly)
- [ ] Delete product (should set `status: "archived"` only)
- [ ] Validate loan product for application (should check `status === "active"` only)
- [ ] Get available products (should filter by `status === "active"` only)

## Backward Compatibility Notes

If the frontend currently uses `isActive`:
- Consider adding a computed `isActive` field in API responses temporarily
- Document the migration path for frontend
- Plan deprecation timeline

## Benefits

1. **Eliminates Redundancy**: Single source of truth for product availability
2. **Prevents Inconsistencies**: No risk of `isActive` and `status` being out of sync
3. **Simplifies Code**: Fewer fields to manage and validate
4. **Clearer API**: `status` is more descriptive than `isActive`
