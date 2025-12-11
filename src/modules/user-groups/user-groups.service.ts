import { and, eq, inArray, isNull, count, or, like, desc } from "drizzle-orm";
import { db } from "../../db";
import { userGroups, userGroupMembers, users, businessProfiles, businessUserGroups } from "../../db/schema";
import type { UserGroupsModel } from "./user-groups.model";
import { logger } from "../../utils/logger";
import { ResponseCachingService } from "../response-caching/response-caching.service";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

type GroupRow = typeof userGroups.$inferSelect;

function mapRow(r: GroupRow, businessCount?: number): UserGroupsModel.GroupItem {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    updatedAt: r.updatedAt?.toISOString?.() ?? null,
    businessCount: businessCount ?? 0,
  };
}

export abstract class UserGroupsService {
  static async create(
    clerkId: string,
    body: UserGroupsModel.CreateGroupBody,
  ): Promise<UserGroupsModel.GroupItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");
      if (!body.name) throw httpError(400, "[INVALID_INPUT] name is required");

      // Generate slug if missing and ensure uniqueness
      let desiredSlug = body.slug?.trim() || slugify(body.name);
      if (!desiredSlug) desiredSlug = slugify(`${body.name}-${Date.now()}`);

      // Ensure unique slug (append suffix if needed)
      let finalSlug = desiredSlug;
      let attempt = 0;
      // Simple loop for uniqueness check (few iterations expected)
      // Note: considering soft deletes still reserving slug uniqueness
      while (true) {
        const [existing] = await db
          .select({ id: userGroups.id })
          .from(userGroups)
          .where(eq(userGroups.slug, finalSlug))
          .limit(1);
        if (!existing) break;
        attempt += 1;
        finalSlug = `${desiredSlug}-${attempt}`;
      }

      const [group] = await db
        .insert(userGroups)
        .values({
          name: body.name,
          slug: finalSlug,
          description: body.description ?? null,
        })
        .returning();

      // Membership handling (optional at creation)
      if (body.userIds && body.userIds.length > 0) {
        const uniqueUserIds = Array.from(new Set(body.userIds));
        const found = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, uniqueUserIds));
        const validIds = new Set(found.map((u) => u.id));
        const rows = uniqueUserIds
          .filter((id) => validIds.has(id))
          .map((id) => ({ userId: id, groupId: group.id }));
        if (rows.length) {
          await db.insert(userGroupMembers).values(rows).onConflictDoNothing();
          // Invalidate members cache for this group
          await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${group.id}/members*`);
        }
      }

      // New groups have 0 businesses
      return mapRow(group, 0);
    } catch (error: any) {
      logger.error("Error creating user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_USER_GROUP_ERROR] Failed to create group");
    }
  }

  static async list(): Promise<{ success: boolean; message: string; data: UserGroupsModel.GroupItem[] }> {
    try {
      // Optimized query: Get groups with business counts in a single query
      const rows = await db
        .select({
          id: userGroups.id,
          name: userGroups.name,
          slug: userGroups.slug,
          description: userGroups.description,
          createdAt: userGroups.createdAt,
          updatedAt: userGroups.updatedAt,
          businessCount: count(businessUserGroups.id),
        })
        .from(userGroups)
        .leftJoin(
          businessUserGroups,
          eq(businessUserGroups.groupId, userGroups.id)
        )
        .where(isNull(userGroups.deletedAt))
        .groupBy(userGroups.id);

      return {
        success: true,
        message: "Groups retrieved successfully",
        data: rows.map((r) => mapRow(r, Number(r.businessCount))),
      };
    } catch (error: any) {
      logger.error("Error listing user groups:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_USER_GROUPS_ERROR] Failed to list groups");
    }
  }

  static async getById(id: string): Promise<UserGroupsModel.GroupItem> {
    try {
      // Get group with business count
      const [result] = await db
        .select({
          id: userGroups.id,
          name: userGroups.name,
          slug: userGroups.slug,
          description: userGroups.description,
          createdAt: userGroups.createdAt,
          updatedAt: userGroups.updatedAt,
          businessCount: count(businessUserGroups.id),
        })
        .from(userGroups)
        .leftJoin(
          businessUserGroups,
          eq(businessUserGroups.groupId, userGroups.id)
        )
        .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
        .groupBy(userGroups.id)
        .limit(1);
      
      if (!result) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");
      return mapRow(result, Number(result.businessCount));
    } catch (error: any) {
      logger.error("Error getting user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_USER_GROUP_ERROR] Failed to get group");
    }
  }

  static async update(
    clerkId: string,
    id: string,
    body: UserGroupsModel.EditGroupBody,
  ): Promise<UserGroupsModel.GroupItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Prepare slug if provided
      let newSlug: string | undefined;
      if (body.slug) {
        const desiredSlug = slugify(body.slug);
        let finalSlug = desiredSlug;
        let attempt = 0;
        while (true) {
          const [existing] = await db
            .select({ id: userGroups.id })
            .from(userGroups)
            .where(and(eq(userGroups.slug, finalSlug), isNull(userGroups.deletedAt)));
          if (!existing || existing.id === id) break;
          attempt += 1;
          finalSlug = `${desiredSlug}-${attempt}`;
        }
        newSlug = finalSlug;
      }

      const [updated] = await db
        .update(userGroups)
        .set({
          name: body.name ?? undefined,
          slug: newSlug ?? undefined,
          description: body.description ?? undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
        .returning();

      if (!updated) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Get business count for the updated group
      const [{ businessCount }] = await db
        .select({ businessCount: count(businessUserGroups.id) })
        .from(businessUserGroups)
        .where(eq(businessUserGroups.groupId, id));

      // Membership operations
      if (body.userIds && body.userIds.length >= 0) {
        // Replace full membership set
        await db.delete(userGroupMembers).where(eq(userGroupMembers.groupId, id));
        const uniqueUserIds = Array.from(new Set(body.userIds));
        if (uniqueUserIds.length) {
          const found = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, uniqueUserIds));
          const validIds = new Set(found.map((u) => u.id));
          const rows = uniqueUserIds
            .filter((uid) => validIds.has(uid))
            .map((uid) => ({ userId: uid, groupId: id }));
          if (rows.length) await db.insert(userGroupMembers).values(rows).onConflictDoNothing();
        }
        // Invalidate members cache for this group
        await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${id}/members*`);
      } else {
        // Incremental add/remove
        if (body.addUserIds && body.addUserIds.length) {
          const uniqueUserIds = Array.from(new Set(body.addUserIds));
          const found = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, uniqueUserIds));
          const validIds = new Set(found.map((u) => u.id));
          const rows = uniqueUserIds
            .filter((uid) => validIds.has(uid))
            .map((uid) => ({ userId: uid, groupId: id }));
          if (rows.length) await db.insert(userGroupMembers).values(rows).onConflictDoNothing();
        }
        if (body.removeUserIds && body.removeUserIds.length) {
          const uniqueUserIds = Array.from(new Set(body.removeUserIds));
          await db
            .delete(userGroupMembers)
            .where(and(eq(userGroupMembers.groupId, id), inArray(userGroupMembers.userId, uniqueUserIds)));
        }
        // Invalidate members cache for this group
        await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${id}/members*`);
      }

      return mapRow(updated, Number(businessCount));
    } catch (error: any) {
      logger.error("Error updating user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_USER_GROUP_ERROR] Failed to update group");
    }
  }

  static async remove(
    clerkId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)));
      if (!existing) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      await db
        .update(userGroups)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(userGroups.id, id));

      // Invalidate members cache for this group
      await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${id}/members*`);

      return { success: true, message: "Group deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_USER_GROUP_ERROR] Failed to delete group");
    }
  }

  static async listMembers(
    groupId: string,
    query: UserGroupsModel.ListGroupMembersQuery = {}
  ): Promise<{ success: boolean; message: string; data: UserGroupsModel.GroupMemberItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      // Ensure group exists (soft-delete aware)
      const [group] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
        .limit(1);
      if (!group) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Pagination
      const page = query.page ? Math.max(1, parseInt(query.page)) : 1;
      const limit = Math.min(query.limit ? Math.max(1, parseInt(query.limit)) : 20, 100);
      const offset = (page - 1) * limit;

      const [{ total }] = await db
        .select({ total: count() })
        .from(userGroupMembers)
        .where(eq(userGroupMembers.groupId, groupId));

      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phoneNumber: users.phoneNumber,
          imageUrl: users.imageUrl,
        })
        .from(userGroupMembers)
        .innerJoin(users, eq(users.id, userGroupMembers.userId))
        .where(eq(userGroupMembers.groupId, groupId))
        .limit(limit)
        .offset(offset);

      const data = rows.map((r) => ({
        id: r.id,
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
        email: r.email ?? null,
        phoneNumber: r.phoneNumber ?? null,
        imageUrl: r.imageUrl ?? null,
      }));

      return {
        success: true,
        message: "Group members retrieved successfully",
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing group members:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_GROUP_MEMBERS_ERROR] Failed to list group members");
    }
  }

  /**
   * Search businesses for assignment to a user group
   * 
   * @description Efficiently searches active businesses by name or owner email,
   * and indicates if each business is already assigned to the specified group.
   * Uses a single optimized query with LEFT JOIN to check membership.
   * 
   * @param groupId - The user group ID
   * @param query - Search query parameters
   * @returns Paginated list of businesses with membership status
   * 
   * @throws {404} If group is not found
   * @throws {500} If search fails
   */
  static async searchBusinessesForGroup(
    groupId: string,
    query: UserGroupsModel.SearchBusinessesForGroupQuery = {}
  ): Promise<{
    success: boolean;
    message: string;
    data: UserGroupsModel.BusinessSearchItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    try {
      // Verify group exists
      const [group] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
        .limit(1);
      if (!group) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Pagination
      const page = query.page ? Math.max(1, parseInt(query.page)) : 1;
      const limit = Math.min(query.limit ? Math.max(1, parseInt(query.limit)) : 20, 100);
      const offset = (page - 1) * limit;

      // Build search conditions
      const whereConditions = [isNull(businessProfiles.deletedAt)];

      if (query.search && query.search.trim().length > 0) {
        const searchTerm = `%${query.search.trim()}%`;
        // Search by business name (indexed) or owner email (indexed)
        whereConditions.push(
          or(
            like(businessProfiles.name, searchTerm),
            like(users.email, searchTerm)
          )!
        );
      }

      // Optimized single query: Get businesses with owner info and membership status
      // Using LEFT JOIN to check if business is already in group
      const results = await db
        .select({
          businessId: businessProfiles.id,
          businessName: businessProfiles.name,
          businessDescription: businessProfiles.description,
          businessSector: businessProfiles.sector,
          businessCountry: businessProfiles.country,
          businessCity: businessProfiles.city,
          ownerId: users.id,
          ownerFirstName: users.firstName,
          ownerLastName: users.lastName,
          ownerEmail: users.email,
          isInGroup: businessUserGroups.id, // Will be null if not in group
        })
        .from(businessProfiles)
        .innerJoin(users, eq(businessProfiles.userId, users.id))
        .leftJoin(
          businessUserGroups,
          and(
            eq(businessUserGroups.businessId, businessProfiles.id),
            eq(businessUserGroups.groupId, groupId)
          )
        )
        .where(and(...whereConditions))
        .orderBy(desc(businessProfiles.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination (separate optimized count query)
      const countConditions = [isNull(businessProfiles.deletedAt)];
      if (query.search && query.search.trim().length > 0) {
        const searchTerm = `%${query.search.trim()}%`;
        countConditions.push(
          or(
            like(businessProfiles.name, searchTerm),
            like(users.email, searchTerm)
          )!
        );
      }

      const [{ total }] = await db
        .select({ total: count() })
        .from(businessProfiles)
        .innerJoin(users, eq(businessProfiles.userId, users.id))
        .where(and(...countConditions));

      // Map results
      const data: UserGroupsModel.BusinessSearchItem[] = results.map((r) => ({
        id: r.businessId,
        name: r.businessName,
        description: r.businessDescription ?? null,
        sector: r.businessSector ?? null,
        country: r.businessCountry ?? null,
        city: r.businessCity ?? null,
        owner: {
          id: r.ownerId,
          firstName: r.ownerFirstName ?? null,
          lastName: r.ownerLastName ?? null,
          email: r.ownerEmail,
        },
        isAlreadyInGroup: r.isInGroup !== null, // If businessUserGroups.id exists, business is in group
      }));

      return {
        success: true,
        message: "Businesses retrieved successfully",
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error searching businesses for group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[SEARCH_BUSINESSES_FOR_GROUP_ERROR] Failed to search businesses");
    }
  }

  /**
   * Assign businesses to a user group
   * 
   * @description Efficiently assigns one or more businesses to a user group.
   * Skips businesses that are already assigned and validates that businesses exist.
   * 
   * @param groupId - The user group ID
   * @param businessIds - Array of business IDs to assign
   * @returns Assignment result with counts
   * 
   * @throws {404} If group is not found
   * @throws {400} If businessIds array is empty
   * @throws {500} If assignment fails
   */
  static async assignBusinessesToGroup(
    groupId: string,
    businessIds: string[]
  ): Promise<UserGroupsModel.AssignBusinessesToGroupResponse> {
    try {
      if (!businessIds || businessIds.length === 0) {
        throw httpError(400, "[INVALID_INPUT] businessIds array is required and cannot be empty");
      }

      // Verify group exists
      const [group] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
        .limit(1);
      if (!group) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Remove duplicates
      const uniqueBusinessIds = Array.from(new Set(businessIds));

      // Validate businesses exist and are active
      const validBusinesses = await db
        .select({ id: businessProfiles.id })
        .from(businessProfiles)
        .where(
          and(
            inArray(businessProfiles.id, uniqueBusinessIds),
            isNull(businessProfiles.deletedAt)
          )
        );

      const validBusinessIds = new Set(validBusinesses.map((b) => b.id));
      const invalidBusinessIds = uniqueBusinessIds.filter((id) => !validBusinessIds.has(id));

      // Check which businesses are already in the group
      const existingAssignments = await db
        .select({ businessId: businessUserGroups.businessId })
        .from(businessUserGroups)
        .where(
          and(
            eq(businessUserGroups.groupId, groupId),
            inArray(businessUserGroups.businessId, Array.from(validBusinessIds))
          )
        );

      const existingBusinessIds = new Set(existingAssignments.map((a) => a.businessId));

      // Filter out businesses already in group
      const businessesToAssign = Array.from(validBusinessIds).filter(
        (id) => !existingBusinessIds.has(id)
      );

      // Assign businesses (batch insert with conflict handling)
      let assigned = 0;
      if (businessesToAssign.length > 0) {
        const rows = businessesToAssign.map((businessId) => ({
          businessId,
          groupId,
        }));

        // Use onConflictDoNothing to handle race conditions gracefully
        await db.insert(businessUserGroups).values(rows).onConflictDoNothing();
        assigned = businessesToAssign.length;
      }

      const skipped = existingBusinessIds.size;

      return {
        success: true,
        message: `Successfully assigned ${assigned} business(es) to group. ${skipped} already assigned, ${invalidBusinessIds.length} invalid.`,
        assigned,
        skipped,
        invalid: invalidBusinessIds,
      };
    } catch (error: any) {
      logger.error("Error assigning businesses to group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[ASSIGN_BUSINESSES_TO_GROUP_ERROR] Failed to assign businesses");
    }
  }

  /**
   * Remove a business from a user group
   * 
   * @description Removes a business from a user group.
   * 
   * @param groupId - The user group ID
   * @param businessId - The business ID to remove
   * @returns Success message
   * 
   * @throws {404} If group or business assignment is not found
   * @throws {500} If removal fails
   */
  static async removeBusinessFromGroup(
    groupId: string,
    businessId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify group exists
      const [group] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
        .limit(1);
      if (!group) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Check if assignment exists
      const [assignment] = await db
        .select({ id: businessUserGroups.id })
        .from(businessUserGroups)
        .where(
          and(
            eq(businessUserGroups.groupId, groupId),
            eq(businessUserGroups.businessId, businessId)
          )
        )
        .limit(1);

      if (!assignment) {
        throw httpError(
          404,
          "[BUSINESS_NOT_IN_GROUP] Business is not assigned to this group"
        );
      }

      // Remove assignment
      await db
        .delete(businessUserGroups)
        .where(
          and(
            eq(businessUserGroups.groupId, groupId),
            eq(businessUserGroups.businessId, businessId)
          )
        );

      return {
        success: true,
        message: "Business removed from group successfully",
      };
    } catch (error: any) {
      logger.error("Error removing business from group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[REMOVE_BUSINESS_FROM_GROUP_ERROR] Failed to remove business");
    }
  }
}
