# Admin SME API Performance Analysis & Optimization Recommendations

## Executive Summary

After analyzing the admin-sme write/mutation endpoints, I've identified several performance bottlenecks that are causing slow response times. The main issues are:

1. **N+1 Query Patterns** in document upserts (Steps 5, 6, 7)
2. **Redundant Database Queries** - `getOnboardingState` called after every mutation
3. **Sequential Query Execution** instead of parallel queries
4. **Inefficient Bulk Operations** - individual queries instead of batch operations
5. **Missing Query Optimization** - queries that could be combined or cached

## Detailed Findings

### 1. N+1 Query Problem in Document Upserts (CRITICAL)

**Location**: `admin-sme.step5.service.ts`, `admin-sme.step6.service.ts`, `admin-sme.step7.service.ts`

**Problem**: 
```typescript
// Current implementation - N+1 queries
for (const doc of normalized) {
  const existing = await tx.query.businessDocuments.findFirst({
    where: and(
      eq(businessDocuments.businessId, business.id),
      eq(businessDocuments.docType, doc.docType as any),
      isNull(businessDocuments.deletedAt)
    ),
  });
  // ... then update or insert
}
```

**Impact**: If 5 documents are submitted, this results in:
- 5 separate `findFirst` queries
- 5 separate `update` or `insert` operations
- Total: **10+ database round trips** per request

**Solution**: Batch query all existing documents once, then process in memory.

### 2. Redundant `getOnboardingState` Calls (HIGH)

**Location**: All step services call `getOnboardingState` at the end

**Problem**:
```typescript
// After transaction completes
return await AdminSMEService.getOnboardingState(userId);
```

`getOnboardingState` performs:
- 1 query for user
- 1 query for progress
- 1 query for business

**Impact**: Every mutation adds **3 extra queries** that could be avoided by returning data already fetched in the transaction.

**Solution**: Return the onboarding state from data already loaded in the transaction, or make `getOnboardingState` optional.

### 3. Sequential User/Business Lookups (MEDIUM)

**Location**: All step services

**Problem**:
```typescript
const user = await db.query.users.findFirst({ ... });
// ... later in transaction
const business = await db.query.businessProfiles.findFirst({ ... });
```

**Impact**: These queries are sequential when they could be parallel, adding unnecessary latency.

**Solution**: Use `Promise.all()` to fetch user and business in parallel when both are needed.

### 4. Inefficient Progress Updates (MEDIUM)

**Location**: All step services

**Problem**:
```typescript
const progress = await tx.query.smeOnboardingProgress.findFirst({ ... });
// ... then conditionally update or insert
```

**Impact**: Every step queries progress, then conditionally updates. This could use PostgreSQL's `ON CONFLICT` (upsert) for atomic operations.

**Solution**: Use Drizzle's `.onConflictDoUpdate()` for atomic upserts.

### 5. Step 1: Double Updates and Redundant Queries (CRITICAL)

**Location**: `admin-sme.step1.service.ts`

**Problem in `createSMEUser`**:
```typescript
// 1. Email check (outside transaction)
const existingUser = await db.query.users.findFirst({ ... });

// 2. Transaction: insert user + insert progress
await db.transaction(async (tx) => { ... });

// 3. AFTER transaction: getOnboardingState (3 more queries!)
const onboardingState = await AdminSMEService.getOnboardingState(result.id);
```

**Problem in `updateSMEUser`**:
```typescript
// 1. Query user
const user = await db.query.users.findFirst({ ... });

// 2. Conditional email check
if (payload.email !== user.email) {
  const existingWithEmail = await db.query.users.findFirst({ ... });
}

// 3. Transaction:
await db.transaction(async (tx) => {
  // Update users (first time)
  await tx.update(users).set({ ... });
  
  // Query progress
  const progress = await tx.query.smeOnboardingProgress.findFirst({ ... });
  
  // Update/insert progress
  // ...
  
  // Update users AGAIN (second time - redundant!)
  await tx.update(users).set({ onboardingStep: 1, ... });
});

// 4. AFTER transaction: getOnboardingState (3 more queries!)
return await AdminSMEService.getOnboardingState(userId);
```

**Impact**: 
- `createSMEUser`: 1 query + 2 in transaction + 3 after = **6 queries total**
- `updateSMEUser`: 2-3 queries + 4 operations in transaction + 3 after = **9-10 queries total**
- **Double update to users table** in `updateSMEUser` (lines 118-130 and 162-168)
- **Redundant getOnboardingState** - we already have all the data from the transaction

**Solution**: 
1. Eliminate redundant `getOnboardingState` call - return data from transaction
2. Combine the two `users` updates in `updateSMEUser` into one
3. Move email check inside transaction for better consistency
4. Use parallel queries in `getOnboardingState` if we must call it

### 6. Step 2: Multiple Separate Operations (MEDIUM)

**Location**: `admin-sme.step2.service.ts`

**Problem**:
- Separate delete + insert for user groups
- Separate soft delete + insert for video links
- Separate soft delete + insert for photos

**Impact**: 6+ separate operations that could be optimized.

**Solution**: Use bulk operations where possible, or combine delete+insert into single upsert operations.

### 7. Step 4: Inefficient Document Upserts (MEDIUM)

**Location**: `admin-sme.step4.service.ts`

**Problem**:
```typescript
// Query all existing
const existing = await tx.query.personalDocuments.findMany({ ... });
// Then loop through updates individually
for (const d of toUpdate) {
  await tx.update(personalDocuments).set({ ... }).where(...);
}
```

**Impact**: Multiple individual updates instead of batch operations.

**Solution**: Use bulk update operations or PostgreSQL's `UPDATE ... FROM` for batch updates.

## Optimization Recommendations

### Priority 1: Critical Fixes (Immediate Impact)

#### 1.1 Fix Step 1 Double Updates and Redundant Queries

**Before** (`updateSMEUser`):
```typescript
await db.transaction(async (tx) => {
  // First update
  await tx.update(users).set({
    email: payload.email,
    firstName: payload.firstName,
    // ... other fields
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  // Query progress
  const progress = await tx.query.smeOnboardingProgress.findFirst({ ... });
  
  // Update progress
  // ...
  
  // Second update (redundant!)
  await tx.update(users).set({
    onboardingStep: 1,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
});

// Then call getOnboardingState (3 more queries!)
return await AdminSMEService.getOnboardingState(userId);
```

**After**:
```typescript
let updatedUser: typeof users.$inferSelect;
let progress: typeof smeOnboardingProgress.$inferSelect | null = null;

await db.transaction(async (tx) => {
  // Single update with all fields including onboardingStep
  const [userResult] = await tx
    .update(users)
    .set({
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phoneNumber: payload.phone,
      dob: dob,
      gender: payload.gender,
      position: payload.position,
      onboardingStep: 1, // Include in single update
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId))
    .returning();
  
  updatedUser = userResult;

  // Atomic upsert for progress
  progress = await tx
    .insert(smeOnboardingProgress)
    .values({
      userId: userId,
      currentStep: 1,
      completedSteps: completedSteps as any,
      lastSavedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: smeOnboardingProgress.userId,
      set: {
        currentStep: 1,
        completedSteps: completedSteps as any,
        lastSavedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
    .then(rows => rows[0] || null);
});

// Return state from data we already have (no extra queries!)
return {
  userId: updatedUser.id,
  currentStep: progress?.currentStep ?? 1,
  completedSteps: (progress?.completedSteps as number[]) ?? [],
  user: {
    email: updatedUser.email,
    firstName: updatedUser.firstName,
    // ... map all fields
  },
  business: null, // No business in Step 1
};
```

**Expected Improvement**: 50-60% reduction in Step 1 response time.

#### 1.2 Fix N+1 Queries in Document Upserts

**Before** (Steps 5, 6, 7):
```typescript
for (const doc of normalized) {
  const existing = await tx.query.businessDocuments.findFirst({ ... });
  if (existing) {
    await tx.update(businessDocuments).set({ ... });
  } else {
    await tx.insert(businessDocuments).values({ ... });
  }
}
```

**After**:
```typescript
// Batch query all existing documents once
const existingDocs = await tx.query.businessDocuments.findMany({
  where: and(
    eq(businessDocuments.businessId, business.id),
    inArray(businessDocuments.docType, normalized.map(d => d.docType)),
    isNull(businessDocuments.deletedAt)
  ),
});

const existingMap = new Map(
  existingDocs.map(d => [d.docType, d])
);

// Process in memory
const toUpdate: Array<{ id: string; doc: any }> = [];
const toInsert: any[] = [];

for (const doc of normalized) {
  const existing = existingMap.get(doc.docType);
  if (existing) {
    toUpdate.push({ id: existing.id, doc });
  } else {
    toInsert.push({ businessId: business.id, ...doc });
  }
}

// Batch operations
if (toUpdate.length > 0) {
  // Use batch update or individual updates in parallel
  await Promise.all(
    toUpdate.map(({ id, doc }) =>
      tx.update(businessDocuments)
        .set({ ...doc, updatedAt: new Date() })
        .where(eq(businessDocuments.id, id))
    )
  );
}

if (toInsert.length > 0) {
  await tx.insert(businessDocuments).values(toInsert);
}
```

**Expected Improvement**: 50-70% reduction in query time for document-heavy steps.

#### 1.3 Eliminate Redundant `getOnboardingState` Calls

**Before**:
```typescript
// After transaction
return await AdminSMEService.getOnboardingState(userId);
```

**After**:
```typescript
// Return state from data already loaded
return {
  userId: user.id,
  currentStep: progress?.currentStep ?? stepNumber,
  completedSteps: completedSteps,
  user: {
    email: user.email,
    firstName: user.firstName,
    // ... other fields
  },
  business: business ? {
    id: business.id,
    name: business.name,
    // ... other fields
  } : null,
};
```

**Expected Improvement**: 30-40% reduction in total query time per mutation.

### Priority 2: High Impact Optimizations

#### 2.1 Parallel User/Business Lookups

**Before**:
```typescript
const user = await db.query.users.findFirst({ ... });
const business = await db.query.businessProfiles.findFirst({ ... });
```

**After**:
```typescript
const [user, business] = await Promise.all([
  db.query.users.findFirst({ where: eq(users.id, userId) }),
  db.query.businessProfiles.findFirst({
    where: and(
      eq(businessProfiles.userId, userId),
      isNull(businessProfiles.deletedAt)
    ),
  }),
]);
```

**Expected Improvement**: 20-30% reduction in lookup time.

#### 2.2 Use Atomic Upserts for Progress

**Before**:
```typescript
const progress = await tx.query.smeOnboardingProgress.findFirst({ ... });
if (progress) {
  await tx.update(smeOnboardingProgress).set({ ... });
} else {
  await tx.insert(smeOnboardingProgress).values({ ... });
}
```

**After**:
```typescript
await tx
  .insert(smeOnboardingProgress)
  .values({
    userId,
    currentStep: stepNumber,
    completedSteps: completedSteps as any,
    lastSavedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: smeOnboardingProgress.userId,
    set: {
      currentStep: stepNumber,
      completedSteps: completedSteps as any,
      lastSavedAt: new Date(),
      updatedAt: new Date(),
    },
  });
```

**Expected Improvement**: 10-15% reduction in progress update time.

### Priority 3: Medium Impact Optimizations

#### 3.1 Optimize Step 2 Bulk Operations

**Current**: Separate delete + insert for user groups, videos, photos

**Optimized**: Use `ON CONFLICT` upserts or batch operations where applicable.

#### 3.2 Batch Document Updates in Step 4

**Current**: Individual updates in a loop

**Optimized**: Use PostgreSQL's `UPDATE ... FROM` or batch update operations.

### Priority 4: Database Index Optimizations

#### 4.1 Add Composite Indexes (if missing)

Check if these composite indexes exist:
- `(businessId, docType, deletedAt)` on `business_documents` - **CRITICAL**
- `(userId, docType, deletedAt)` on `personal_documents` - **CRITICAL**
- `(businessId, deletedAt)` on `business_user_groups` - **HIGH**
- `(businessId, deletedAt)` on `business_video_links` - **HIGH**
- `(businessId, deletedAt)` on `business_photos` - **HIGH**

#### 4.2 Verify Index Usage

Run `EXPLAIN ANALYZE` on slow queries to ensure indexes are being used.

## Implementation Plan

### Phase 1: Quick Wins (1-2 days)
1. ✅ Fix N+1 queries in Steps 5, 6, 7
2. ✅ Eliminate redundant `getOnboardingState` calls
3. ✅ Add parallel user/business lookups

**Expected Overall Improvement**: 60-80% reduction in mutation endpoint response times

### Phase 2: Database Optimizations (1 day)
1. ✅ Add missing composite indexes
2. ✅ Verify index usage with `EXPLAIN ANALYZE`
3. ✅ Optimize progress upserts

**Expected Additional Improvement**: 10-20% further reduction

### Phase 3: Advanced Optimizations (2-3 days)
1. ✅ Optimize Step 2 bulk operations
2. ✅ Batch document updates in Step 4
3. ✅ Consider connection pooling optimizations

**Expected Additional Improvement**: 5-10% further reduction

## Monitoring & Validation

### Before Optimization
- Measure current response times for each endpoint
- Log query counts per request
- Identify slowest operations

### After Optimization
- Compare response times
- Verify query count reduction
- Monitor database load

### Key Metrics to Track
- Average response time per endpoint
- P95/P99 response times
- Database query count per request
- Database connection pool usage
- Transaction duration

## Estimated Performance Gains

| Endpoint | Current (est.) | After Phase 1 | After Phase 2 | After Phase 3 |
|----------|---------------|---------------|---------------|---------------|
| Step 1 (Create) | 200-300ms | **80-120ms** | 60-100ms | 50-80ms |
| Step 1 (Update) | 300-500ms | **100-150ms** | 80-120ms | 70-100ms |
| Step 2 | 400-600ms | 200-300ms | 150-200ms | 120-150ms |
| Step 3 | 300-400ms | 200-250ms | 150-200ms | 120-150ms |
| Step 4 | 500-800ms | 200-300ms | 150-250ms | 120-200ms |
| Step 5 | 600-1000ms | 250-400ms | 200-300ms | 150-250ms |
| Step 6 | 600-1000ms | 250-400ms | 200-300ms | 150-250ms |
| Step 7 | 600-1000ms | 250-400ms | 200-300ms | 150-250ms |

*Note: Actual improvements depend on data volume and database performance*

## Additional Recommendations

### 1. Connection Pooling
- Ensure PostgreSQL connection pool is properly configured
- Monitor pool usage and adjust `max` connections if needed

### 2. Query Result Caching
- Consider caching `getOnboardingState` results for a short TTL (e.g., 5-10 seconds)
- Use Redis or in-memory cache for frequently accessed data

### 3. Async Processing
- For non-critical operations (logging, notifications), consider moving to background jobs
- Use job queues (Bull, BullMQ) for heavy operations

### 4. Database Query Logging
- Enable slow query logging in PostgreSQL
- Monitor queries taking > 100ms

### 5. Load Testing
- Perform load tests before and after optimizations
- Use tools like k6, Artillery, or Apache Bench

## Conclusion

The main performance bottlenecks are:
1. **N+1 queries** in document operations (most critical)
2. **Redundant queries** from `getOnboardingState` calls
3. **Sequential execution** instead of parallel queries

Addressing these issues should result in **60-80% improvement** in mutation endpoint performance, with the most significant gains in Steps 5, 6, and 7 (document-heavy operations).

