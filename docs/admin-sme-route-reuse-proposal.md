# Proposal: Reusing Admin-SME Service Layer for SME User Routes

## Current Situation

### Admin Routes (Current)
- `PUT /admin/sme/onboarding/:userId/step/2` - Admin saves business info for any user
- `PUT /admin/sme/onboarding/:userId/step/3` - Admin saves location info
- `PUT /admin/sme/onboarding/:userId/step/4` - Admin saves personal documents
- etc.

**Characteristics:**
- Requires `requireRole('member')` (admin/super-admin/member)
- Takes `userId` as URL parameter
- Uses `AdminSMEStepXService` methods

### SME User Routes (Current/Proposed)
- `POST /business/register` - Simple business registration (existing)
- `PUT /business/:id` - Edit business (existing, simpler)

**Characteristics:**
- Requires authenticated user (via `getAuth`)
- Uses authenticated user's `clerkId` → resolves to internal `userId`
- Uses `Business` service (different structure)

## Problem

The admin routes and SME user routes have **similar functionality** but:
1. Different route structures
2. Different service layers
3. Code duplication potential
4. UI is almost identical

## Proposed Solution: Service Layer Reuse

### Approach: Make Services Context-Agnostic

The admin services already take `userId` directly. We can:

1. **Keep admin routes as-is** (they work well for admin context)
2. **Create new SME user routes** that:
   - Use authenticated user's `userId` (resolved from `clerkId`)
   - Call the **same admin service methods**
   - Have simpler paths: `/onboarding/step/2`, `/onboarding/step/3`, etc.

### Benefits

✅ **Code Reuse**: Same service logic for both admin and SME users
✅ **Consistency**: Same validation, same business logic
✅ **Maintainability**: One place to update logic
✅ **Clear Separation**: Routes remain separate (different auth, different paths)
✅ **Backward Compatible**: Existing routes continue to work

## Implementation Plan

### Step 1: Create SME User Onboarding Routes

Create new routes file: `src/routes/sme-onboarding.routes.ts`

```typescript
// PUT /onboarding/step/2 - Save business basic info (SME user)
fastify.put("/onboarding/step/2", {
  // ... schema
}, async (request, reply) => {
  const { userId: clerkId } = getAuth(request);
  if (!clerkId) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  // Resolve internal userId from clerkId
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
  
  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  // Reuse admin service!
  const result = await AdminSMEService.saveBusinessBasicInfo(
    user.id,  // Use resolved userId
    request.body
  );
  
  return reply.send(result);
});
```

### Step 2: Route Structure

**Admin Routes** (keep as-is):
- `PUT /admin/sme/onboarding/:userId/step/2`
- `PUT /admin/sme/onboarding/:userId/step/3`
- etc.

**SME User Routes** (new):
- `PUT /onboarding/step/2` - Uses authenticated user
- `PUT /onboarding/step/3` - Uses authenticated user
- `PUT /onboarding/step/4` - Uses authenticated user
- etc.

### Step 3: Helper Function for User Resolution

Create a utility to avoid duplication:

```typescript
// src/utils/user-resolution.ts
export async function resolveUserIdFromAuth(
  request: FastifyRequest
): Promise<string> {
  const { userId: clerkId } = getAuth(request);
  if (!clerkId) {
    throw httpError(401, "[UNAUTHORIZED] Missing authentication");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    throw httpError(404, "[USER_NOT_FOUND] User not found");
  }

  return user.id;
}
```

### Step 4: Route Implementation Example

```typescript
// src/routes/sme-onboarding.routes.ts
import { resolveUserIdFromAuth } from "../utils/user-resolution";

export async function smeOnboardingRoutes(fastify: FastifyInstance) {
  // PUT /onboarding/step/2
  fastify.put("/onboarding/step/2", {
    schema: {
      body: AdminSMEModel.Step2BusinessBasicInfoBodySchema,
      // ... response schema
    },
  }, async (request, reply) => {
    try {
      const userId = await resolveUserIdFromAuth(request);
      const result = await AdminSMEService.saveBusinessBasicInfo(
        userId,
        request.body
      );
      return reply.send(result);
    } catch (error: any) {
      // ... error handling
    }
  });

  // PUT /onboarding/step/3
  fastify.put("/onboarding/step/3", {
    // ... similar pattern
  }, async (request, reply) => {
    const userId = await resolveUserIdFromAuth(request);
    return await AdminSMEService.saveLocationInfo(userId, request.body);
  });

  // ... steps 4-7 follow same pattern
}
```

## Alternative: Unified Route (Not Recommended)

We could create routes that detect context:

```typescript
// NOT RECOMMENDED - Too complex
PUT /onboarding/:userId?/step/2
```

**Problems:**
- Complex route matching
- Unclear authorization logic
- Harder to maintain
- Security concerns (who can access which userId?)

## Recommended Approach: Separate Routes, Shared Services

### Route Structure

```
Admin Routes:
  PUT /admin/sme/onboarding/:userId/step/2
  PUT /admin/sme/onboarding/:userId/step/3
  ...

SME User Routes:
  PUT /onboarding/step/2
  PUT /onboarding/step/3
  ...
```

### Service Layer (Shared)

```typescript
// Both routes call the same service
AdminSMEService.saveBusinessBasicInfo(userId, payload)
AdminSMEService.saveLocationInfo(userId, payload)
// etc.
```

## Migration Strategy

1. **Phase 1**: Create new SME user routes alongside existing ones
2. **Phase 2**: Update frontend to use new routes for SME users
3. **Phase 3**: (Optional) Deprecate old business routes if they're no longer needed
4. **Phase 4**: Keep admin routes as-is (they're working well)

## Questions to Consider

1. **Do existing `/business/register` and `/business/:id` routes need to stay?**
   - If yes, keep them for backward compatibility
   - If no, we can migrate to the new onboarding routes

2. **Should we add GET endpoints for SME users?**
   - `GET /onboarding` - Get current onboarding state
   - `GET /onboarding/step/:stepNumber` - Get specific step data

3. **Progress tracking for SME users?**
   - The admin services already update `smeOnboardingProgress`
   - SME users can use the same progress tracking

## Example: Complete Route File

```typescript
// src/routes/sme-onboarding.routes.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { AdminSMEService } from "../modules/admin-sme/admin-sme.service";
import { AdminSMEModel } from "../modules/admin-sme/admin-sme.model";
import { requireAuth } from "../utils/authz"; // New helper
import { resolveUserIdFromAuth } from "../utils/user-resolution";
import { logger } from "../utils/logger";

export async function smeOnboardingRoutes(fastify: FastifyInstance) {
  // GET /onboarding - Get current onboarding state
  fastify.get("/onboarding", {
    schema: {
      response: {
        200: { type: "object" }, // OnboardingStateResponse
        401: AdminSMEModel.ErrorResponseSchema,
        404: AdminSMEModel.ErrorResponseSchema,
      },
      tags: ["sme-onboarding"],
    },
  }, async (request, reply) => {
    try {
      const userId = await resolveUserIdFromAuth(request);
      const result = await AdminSMEService.getOnboardingState(userId);
      return reply.send(result);
    } catch (error: any) {
      const status = error?.status || 500;
      return reply.code(status).send({
        error: error?.message || "Internal error",
        code: error?.code || "INTERNAL_ERROR",
      });
    }
  });

  // PUT /onboarding/step/2 - Save business basic info
  fastify.put("/onboarding/step/2", {
    schema: {
      body: AdminSMEModel.Step2BusinessBasicInfoBodySchema,
      response: {
        200: { type: "object" },
        400: AdminSMEModel.ErrorResponseSchema,
        401: AdminSMEModel.ErrorResponseSchema,
        404: AdminSMEModel.ErrorResponseSchema,
        500: AdminSMEModel.ErrorResponseSchema,
      },
      tags: ["sme-onboarding"],
    },
  }, async (request, reply) => {
    try {
      const userId = await resolveUserIdFromAuth(request);
      const result = await AdminSMEService.saveBusinessBasicInfo(
        userId,
        request.body
      );
      return reply.send(result);
    } catch (error: any) {
      const status = error?.status || 500;
      logger.error("[SME Onboarding] Error saving step 2", {
        error: error?.message,
      });
      return reply.code(status).send({
        error: error?.message || "Internal error",
        code: error?.code || "INTERNAL_ERROR",
      });
    }
  });

  // PUT /onboarding/step/3 - Save location info
  fastify.put("/onboarding/step/3", {
    schema: {
      body: AdminSMEModel.Step3LocationInfoBodySchema,
      // ... similar
    },
  }, async (request, reply) => {
    const userId = await resolveUserIdFromAuth(request);
    return await AdminSMEService.saveLocationInfo(userId, request.body);
  });

  // ... steps 4-7 follow same pattern
}
```

## Summary

✅ **Yes, it's absolutely possible and recommended!**

**Key Points:**
1. Keep routes separate (admin vs SME user) for clarity and security
2. Reuse the service layer (already takes `userId`)
3. Create helper to resolve `userId` from authenticated user
4. Maintain backward compatibility with existing routes
5. Same validation, same business logic, same data structure

This approach gives you:
- **Code reuse** without sacrificing clarity
- **Security** (clear separation of admin vs user routes)
- **Maintainability** (one service layer to maintain)
- **Flexibility** (can customize routes per context if needed)

