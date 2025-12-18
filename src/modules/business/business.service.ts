import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { businessProfiles } from "../../db/schema";
import { users } from "../../db/schema";
import { logger } from "../../utils/logger";
import type { BusinessModel } from "./business.model";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class Business {
  /**
   * Register a new business profile for a user
   * @param clerkId Clerk user id, used to resolve internal users.id
   * @param payload Business registration payload
   */
  static async register(
    clerkId: string,
    payload: BusinessModel.RegisterBusinessInput
  ): Promise<{ id: string }> {
    try {
      if (!clerkId) {
        throw httpError(401, "[UNAUTHORIZED] Missing user context");
      }

      // Resolve internal user id from Clerk id
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Map payload to DB schema fields (apply necessary conversions)
      const values = {
        userId: user.id,
        name: payload.name,
        description: payload.description ?? null,
        entityType: payload.entityType,
        country: payload.country,
        yearOfIncorporation: String(payload.yearOfIncorporation),
        isOwned: payload.isOwned,
        ownershipPercentage:
          typeof payload.ownershipPercentage === "number"
            ? Math.round(payload.ownershipPercentage)
            : null,
        ownershipType: payload.ownershipType ?? null,
        sector: payload.sector,
      } as any;

      const created = await db
        .insert(businessProfiles)
        .values(values)
        .returning({ id: businessProfiles.id });

      return { id: created[0].id };
    } catch (error: any) {
      logger.error("Error registering business:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[BUSINESS_REGISTER_ERROR] An error occurred while registering the business"
      );
    }
  }

  /**
   * Edit an existing business profile belonging to the user
   * @param clerkId Clerk user id, used to resolve internal users.id
   * @param businessId Business profile id to edit
   * @param payload Partial set of fields to update (must include at least one field validated upstream)
   */
  static async edit(
    clerkId: string,
    businessId: string,
    payload: BusinessModel.EditBusinessBody
  ): Promise<{ id: string }> {
    try {
      if (!clerkId) {
        throw httpError(401, "[UNAUTHORIZED] Missing user context");
      }

      // Resolve internal user id from Clerk id
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Ensure the business exists and belongs to the user
      const existing = await db.query.businessProfiles.findFirst({
        where: and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, user.id)),
      });

      if (!existing) {
        throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");
      }

      // Build the updates object only with provided fields
      const updates: any = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.description !== undefined) updates.description = payload.description ?? null;
      if (payload.imageUrl !== undefined) updates.imageUrl = payload.imageUrl ?? null;
      if (payload.coverImage !== undefined) updates.coverImage = payload.coverImage ?? null;
      if (payload.entityType !== undefined) updates.entityType = payload.entityType;
      if (payload.country !== undefined) updates.country = payload.country;
      if (payload.city !== undefined) updates.city = payload.city ?? null;
      if (payload.address !== undefined) updates.address = payload.address ?? null;
      if (payload.zipCode !== undefined) updates.zipCode = payload.zipCode ?? null;
      if (payload.address2 !== undefined) updates.address2 = payload.address2 ?? null;
      if (payload.yearOfIncorporation !== undefined)
        updates.yearOfIncorporation = String(payload.yearOfIncorporation);
      if (payload.isOwned !== undefined) updates.isOwned = payload.isOwned;
      if (payload.sector !== undefined) updates.sector = payload.sector;
      if (payload.avgMonthlyTurnover !== undefined)
        updates.avgMonthlyTurnover = String(payload.avgMonthlyTurnover);
      if (payload.avgYearlyTurnover !== undefined)
        updates.avgYearlyTurnover = String(payload.avgYearlyTurnover);
      if (payload.borrowingHistory !== undefined)
        updates.borrowingHistory = payload.borrowingHistory;
      if (payload.amountBorrowed !== undefined)
        updates.amountBorrowed = String(payload.amountBorrowed);
      if (payload.loanStatus !== undefined) updates.loanStatus = payload.loanStatus ?? null;
      if (payload.defaultReason !== undefined)
        updates.defaultReason = payload.defaultReason ?? null;
      if (payload.currency !== undefined) updates.currency = payload.currency ?? null;
      if (payload.ownershipPercentage !== undefined)
        updates.ownershipPercentage =
          typeof payload.ownershipPercentage === "number"
            ? Math.round(payload.ownershipPercentage)
            : null;
      if (payload.ownershipType !== undefined)
        updates.ownershipType = payload.ownershipType ?? null;

      // Normalization rules
      // 1) If borrowingHistory is explicitly false, reset related fields
      if (payload.borrowingHistory === false) {
        updates.borrowingHistory = false;
        updates.loanStatus = null;
        updates.defaultReason = null;
        updates.amountBorrowed = "0"; // numeric in DB stored as string
      }

      // 2) If loanStatus is provided and is not "defaulted", defaultReason should be null
      if (
        payload.loanStatus !== undefined &&
        payload.loanStatus !== null &&
        payload.loanStatus !== "defaulted"
      ) {
        updates.defaultReason = null;
      }

      if (Object.keys(updates).length === 0) {
        throw httpError(400, "[INVALID_INPUT] No updatable fields provided");
      }

      updates.updatedAt = new Date();

      const updated = await db
        .update(businessProfiles)
        .set(updates)
        .where(and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, user.id)))
        .returning({ id: businessProfiles.id });

      if (!updated?.length) {
        throw httpError(500, "[BUSINESS_EDIT_ERROR] Failed to update business profile");
      }

      return { id: updated[0].id };
    } catch (error: any) {
      logger.error("Error editing business:", error);
      if (error?.status) throw error;
      throw httpError(500, "[BUSINESS_EDIT_ERROR] An error occurred while editing the business");
    }
  }

  /**
   * List all active business profiles belonging to the user
   * @param clerkId Clerk user id, used to resolve internal users.id
   */
  static async listByUser(clerkId: string): Promise<BusinessModel.ListBusinessesResponse> {
    try {
      if (!clerkId) {
        throw httpError(401, "[UNAUTHORIZED] Missing user context");
      }

      // Resolve internal user id from Clerk id
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      const rows = await db.query.businessProfiles.findMany({
        where: and(eq(businessProfiles.userId, user.id), isNull(businessProfiles.deletedAt)),
        columns: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          coverImage: true,
          entityType: true,
          country: true,
          city: true,
          address: true,
          zipCode: true,
          address2: true,
          sector: true,
          yearOfIncorporation: true,
          avgMonthlyTurnover: true,
          avgYearlyTurnover: true,
          borrowingHistory: true,
          amountBorrowed: true,
          loanStatus: true,
          defaultReason: true,
          currency: true,
          ownershipType: true,
          isOwned: true,
          ownershipPercentage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const data: BusinessModel.BusinessItem[] = rows.map((r: any) => ({
        ...r,
        avgMonthlyTurnover:
          r.avgMonthlyTurnover !== null && r.avgMonthlyTurnover !== undefined
            ? Number(r.avgMonthlyTurnover)
            : null,
        avgYearlyTurnover:
          r.avgYearlyTurnover !== null && r.avgYearlyTurnover !== undefined
            ? Number(r.avgYearlyTurnover)
            : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      }));

      return {
        success: true,
        message: "Businesses retrieved successfully",
        data,
      };
    } catch (error: any) {
      logger.error("Error listing businesses:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_BUSINESSES_ERROR] Failed to list businesses");
    }
  }
}
