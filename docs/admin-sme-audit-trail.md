# Admin SME Audit Trail

## Overview

The Admin SME Audit Trail system tracks all admin actions/mutations performed on SME user accounts. This provides accountability, compliance, and a complete history of changes made by administrators.

## Architecture

### Database Schema

**Table:** `admin_sme_audit_trail`

**Fields:**
- `id` - Unique identifier
- `adminUserId` - Internal user ID of the admin who performed the action
- `smeUserId` - Internal user ID of the SME user affected
- `action` - Type of action (enum)
- `description` - Human-readable description
- `details` - JSON string with additional action details
- `beforeData` - JSON string of state before action (for updates)
- `afterData` - JSON string of state after action (for updates)
- `ipAddress` - IP address of the request
- `userAgent` - Browser/client user agent
- `createdAt` - Timestamp of the action

**Indexes:**
- Primary lookups: admin user, SME user, action, created date
- Composite indexes for common query patterns

### Action Types

The following actions are tracked:

1. **User Management:**
   - `user_created` - New SME user created
   - `user_updated` - User information updated
   - `user_details_updated` - Consolidated user details update

2. **Onboarding Steps:**
   - `step_1_saved` - User info (Step 1)
   - `step_2_saved` - Business basic info (Step 2)
   - `step_3_saved` - Location info (Step 3)
   - `step_4_saved` - Personal documents (Step 4)
   - `step_5_saved` - Company info documents (Step 5)
   - `step_6_saved` - Financial documents (Step 6)
   - `step_7_saved` - Permits & pitch deck (Step 7)

3. **Business Actions:**
   - `business_info_updated` - Business information updated
   - `financial_details_updated` - Financial details updated

4. **Invitation Actions:**
   - `invitation_sent` - Invitation sent to SME user
   - `invitation_resent` - Invitation resent to SME user

5. **Document Actions:**
   - `documents_uploaded` - Documents uploaded
   - `documents_updated` - Documents updated
   - `documents_deleted` - Documents deleted

## Implementation

### Service Layer

**File:** `src/modules/admin-sme/admin-sme-audit.service.ts`

The `AdminSMEAuditService` provides:
- `logAction()` - Logs an admin action (non-blocking)
- `extractRequestMetadata()` - Extracts IP address and user agent from request

**Key Features:**
- Non-blocking: Errors in audit logging don't fail the main operation
- Automatic admin user resolution from Clerk ID
- Request metadata extraction (IP, user agent)

### Route Integration

**File:** `src/routes/admin-sme.routes.ts`

All mutation endpoints automatically log audit events:
- After successful operations
- Includes relevant context (user email, document counts, etc.)
- Captures request metadata

**Covered Endpoints:**
1. ✅ `POST /admin/sme/onboarding/start` → `user_created`
2. ✅ `PUT /admin/sme/onboarding/:userId/step-1` → `step_1_saved`
3. ✅ `PUT /admin/sme/onboarding/:userId/step-2` → `step_2_saved`
4. ✅ `PUT /admin/sme/onboarding/:userId/step-3` → `step_3_saved`
5. ✅ `PUT /admin/sme/onboarding/:userId/step-4` → `step_4_saved`
6. ✅ `PUT /admin/sme/onboarding/:userId/step-5` → `step_5_saved`
7. ✅ `PUT /admin/sme/onboarding/:userId/step-6` → `step_6_saved`
8. ✅ `PUT /admin/sme/onboarding/:userId/step-7` → `step_7_saved`
9. ✅ `PUT /admin/sme/users/:userId/details` → `user_details_updated`
10. ✅ `PUT /admin/sme/users/:userId/financial-details` → `financial_details_updated`
11. ✅ `POST /admin/sme/onboarding/:userId/invite` → `invitation_sent` or `invitation_resent`

**Note:** Read operations (GET endpoints) are not tracked as per requirements.

## Usage Example

```typescript
// In a route handler, after successful mutation:
await logAdminAction(
  request,
  smeUserId,
  "step_2_saved",
  `Saved business basic info: ${businessName}`,
  { businessName, entityType },
);
```

## Querying Audit Trail

### Common Queries

**Get all actions for a specific SME user:**
```sql
SELECT * FROM admin_sme_audit_trail 
WHERE sme_user_id = :userId 
ORDER BY created_at DESC;
```

**Get all actions by a specific admin:**
```sql
SELECT * FROM admin_sme_audit_trail 
WHERE admin_user_id = :adminId 
ORDER BY created_at DESC;
```

**Get actions by type:**
```sql
SELECT * FROM admin_sme_audit_trail 
WHERE action = 'invitation_sent' 
ORDER BY created_at DESC;
```

**Get recent actions:**
```sql
SELECT * FROM admin_sme_audit_trail 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Future Enhancements

Potential improvements:
1. **API Endpoint** - Add GET endpoint to retrieve audit trail for a user
2. **Filtering** - Add filters by action type, date range, admin user
3. **Pagination** - Support paginated results
4. **Export** - Export audit trail to CSV/PDF
5. **Alerts** - Notify on sensitive actions (e.g., user deletion)
6. **Change Diff** - Visual diff of before/after data
7. **Admin Dashboard** - UI to view audit trail

## Notes

- Audit logging is **non-blocking** - failures don't affect the main operation
- Admin user is resolved from Clerk ID automatically
- Request metadata (IP, user agent) is captured automatically
- All timestamps are timezone-aware
- Foreign key constraints ensure data integrity

