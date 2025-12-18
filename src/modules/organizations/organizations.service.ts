import { and, count, desc, eq, isNull, like } from "drizzle-orm";
import { db } from "../../db";
import { loanProducts, organizations } from "../../db/schema";
import { logger } from "../../utils/logger";
import type { OrganizationsModel } from "./organizations.model";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

type OrganizationRow = typeof organizations.$inferSelect;

function mapRow(r: OrganizationRow): OrganizationsModel.OrganizationItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
  };
}

export abstract class OrganizationsService {
  /**
   * List organizations with pagination and search
   */
  static async list(
    query: OrganizationsModel.ListOrganizationsQuery = {}
  ): Promise<OrganizationsModel.PaginatedOrganizationsResponse> {
    try {
      const page = query.page ? Number.parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? Number.parseInt(query.limit) : 10, 100);
      const offset = (page - 1) * limit;

      const whereConditions = [isNull(organizations.deletedAt)];

      if (query.search) {
        const searchTerm = `%${query.search}%`;
        whereConditions.push(like(organizations.name, searchTerm));
      }

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(organizations)
        .where(and(...whereConditions));

      // Get paginated results
      const rows = await db
        .select()
        .from(organizations)
        .where(and(...whereConditions))
        .orderBy(desc(organizations.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        items: rows.map(mapRow),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error("Error listing organizations:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_ORGANIZATIONS_ERROR] Failed to list organizations");
    }
  }

  /**
   * Get organization by ID
   */
  static async getById(id: string): Promise<OrganizationsModel.OrganizationItem> {
    try {
      const [row] = await db
        .select()
        .from(organizations)
        .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
        .limit(1);

      if (!row) {
        throw httpError(404, "[ORGANIZATION_NOT_FOUND] Organization not found");
      }

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error getting organization:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_ORGANIZATION_ERROR] Failed to get organization");
    }
  }

  /**
   * Create organization
   */
  static async create(
    body: OrganizationsModel.CreateOrganizationBody
  ): Promise<OrganizationsModel.OrganizationItem> {
    try {
      if (!body.name || body.name.trim().length === 0) {
        throw httpError(400, "[INVALID_INPUT] name is required and cannot be empty");
      }

      // Check for duplicate name
      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.name, body.name.trim()), isNull(organizations.deletedAt)))
        .limit(1);

      if (existing) {
        throw httpError(409, "[DUPLICATE_NAME] Organization name already exists");
      }

      const [row] = await db
        .insert(organizations)
        .values({
          name: body.name.trim(),
          description: body.description?.trim() || null,
        })
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error creating organization:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_ORGANIZATION_ERROR] Failed to create organization");
    }
  }

  /**
   * Update organization
   */
  static async update(
    id: string,
    body: OrganizationsModel.UpdateOrganizationBody
  ): Promise<OrganizationsModel.OrganizationItem> {
    try {
      const [existing] = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
        .limit(1);

      if (!existing) {
        throw httpError(404, "[ORGANIZATION_NOT_FOUND] Organization not found");
      }

      // Check for duplicate name if name is being updated
      if (body.name && body.name.trim() !== existing.name) {
        const [duplicate] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(and(eq(organizations.name, body.name.trim()), isNull(organizations.deletedAt)))
          .limit(1);

        if (duplicate) {
          throw httpError(409, "[DUPLICATE_NAME] Organization name already exists");
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) {
        updateData.name = body.name.trim();
      }
      if (body.description !== undefined) {
        updateData.description = body.description?.trim() || null;
      }

      const [row] = await db
        .update(organizations)
        .set(updateData)
        .where(eq(organizations.id, id))
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error updating organization:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_ORGANIZATION_ERROR] Failed to update organization");
    }
  }

  /**
   * Delete organization (soft delete)
   *
   * @description Soft deletes an organization. Cannot delete if there are loan products linked to it.
   *
   * @param id - The organization ID
   * @returns Success message
   *
   * @throws {404} If organization is not found
   * @throws {400} If organization has linked loan products
   * @throws {500} If deletion fails
   */
  static async delete(id: string): Promise<{ success: boolean; message: string }> {
    try {
      // Optimized: Check existence and count products in a single query using subquery
      const [result] = await db
        .select({
          orgId: organizations.id,
          productCount: count(loanProducts.id),
        })
        .from(organizations)
        .leftJoin(
          loanProducts,
          and(eq(loanProducts.organizationId, organizations.id), isNull(loanProducts.deletedAt))
        )
        .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
        .groupBy(organizations.id)
        .limit(1);

      if (!result) {
        throw httpError(404, "[ORGANIZATION_NOT_FOUND] Organization not found");
      }

      if (result.productCount > 0) {
        throw httpError(
          400,
          `[ORGANIZATION_HAS_PRODUCTS] Cannot delete organization with ${result.productCount} linked loan product(s). Delete or archive the loan products first.`
        );
      }

      await db
        .update(organizations)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(organizations.id, id));

      return { success: true, message: "Organization deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting organization:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_ORGANIZATION_ERROR] Failed to delete organization");
    }
  }
}
