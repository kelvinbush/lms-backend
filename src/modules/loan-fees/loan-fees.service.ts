import { and, count, desc, eq, isNull, like } from "drizzle-orm";
import { db } from "../../db";
import { loanFees, loanProductsLoanFees } from "../../db/schema";
import { logger } from "../../utils/logger";
import type { LoanFeesModel } from "./loan-fees.model";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

type LoanFeeRow = typeof loanFees.$inferSelect;

function mapRow(r: LoanFeeRow): LoanFeesModel.LoanFeeItem {
  return {
    id: r.id,
    name: r.name,
    calculationMethod: r.calculationMethod,
    rate: toNumber(r.rate) ?? 0,
    collectionRule: r.collectionRule,
    allocationMethod: r.allocationMethod,
    calculationBasis: r.calculationBasis,
    isArchived: r.isArchived,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
  };
}

export abstract class LoanFeesService {
  /**
   * List loan fees with pagination and search
   */
  static async list(
    query: LoanFeesModel.ListLoanFeesQuery = {}
  ): Promise<LoanFeesModel.PaginatedLoanFeesResponse> {
    try {
      const page = query.page ? Number.parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? Number.parseInt(query.limit) : 10, 100);
      const offset = (page - 1) * limit;

      const whereConditions = [isNull(loanFees.deletedAt)];

      if (query.includeArchived !== "true") {
        whereConditions.push(eq(loanFees.isArchived, false));
      }

      if (query.search) {
        const searchTerm = `%${query.search}%`;
        whereConditions.push(like(loanFees.name, searchTerm));
      }

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(loanFees)
        .where(and(...whereConditions));

      // Get paginated results
      const rows = await db
        .select()
        .from(loanFees)
        .where(and(...whereConditions))
        .orderBy(desc(loanFees.createdAt))
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
      logger.error("Error listing loan fees:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_LOAN_FEES_ERROR] Failed to list loan fees");
    }
  }

  /**
   * Get loan fee by ID
   */
  static async getById(id: string): Promise<LoanFeesModel.LoanFeeItem> {
    try {
      const [row] = await db
        .select()
        .from(loanFees)
        .where(and(eq(loanFees.id, id), isNull(loanFees.deletedAt)))
        .limit(1);

      if (!row) {
        throw httpError(404, "[LOAN_FEE_NOT_FOUND] Loan fee not found");
      }

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error getting loan fee:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_FEE_ERROR] Failed to get loan fee");
    }
  }

  /**
   * Create loan fee
   */
  static async create(body: LoanFeesModel.CreateLoanFeeBody): Promise<LoanFeesModel.LoanFeeItem> {
    try {
      if (!body.name || body.name.trim().length === 0) {
        throw httpError(400, "[INVALID_INPUT] name is required and cannot be empty");
      }

      // Check for duplicate name
      const [existing] = await db
        .select({ id: loanFees.id })
        .from(loanFees)
        .where(and(eq(loanFees.name, body.name.trim()), isNull(loanFees.deletedAt)))
        .limit(1);

      if (existing) {
        throw httpError(409, "[DUPLICATE_NAME] Loan fee name already exists");
      }

      const [row] = await db
        .insert(loanFees)
        .values({
          name: body.name.trim(),
          calculationMethod: body.calculationMethod as any,
          rate: body.rate as any,
          collectionRule: body.collectionRule as any,
          allocationMethod: body.allocationMethod,
          calculationBasis: body.calculationBasis as any,
          isArchived: false,
        })
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error creating loan fee:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_LOAN_FEE_ERROR] Failed to create loan fee");
    }
  }

  /**
   * Update loan fee
   */
  static async update(
    id: string,
    body: LoanFeesModel.UpdateLoanFeeBody
  ): Promise<LoanFeesModel.LoanFeeItem> {
    try {
      const [existing] = await db
        .select({ id: loanFees.id, name: loanFees.name })
        .from(loanFees)
        .where(and(eq(loanFees.id, id), isNull(loanFees.deletedAt)))
        .limit(1);

      if (!existing) {
        throw httpError(404, "[LOAN_FEE_NOT_FOUND] Loan fee not found");
      }

      // Check for duplicate name if name is being updated
      if (body.name && body.name.trim() !== existing.name) {
        const [duplicate] = await db
          .select({ id: loanFees.id })
          .from(loanFees)
          .where(and(eq(loanFees.name, body.name.trim()), isNull(loanFees.deletedAt)))
          .limit(1);

        if (duplicate) {
          throw httpError(409, "[DUPLICATE_NAME] Loan fee name already exists");
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) {
        updateData.name = body.name.trim();
      }
      if (body.calculationMethod !== undefined) {
        updateData.calculationMethod = body.calculationMethod as any;
      }
      if (body.rate !== undefined) {
        updateData.rate = body.rate as any;
      }
      if (body.collectionRule !== undefined) {
        updateData.collectionRule = body.collectionRule as any;
      }
      if (body.allocationMethod !== undefined) {
        updateData.allocationMethod = body.allocationMethod;
      }
      if (body.calculationBasis !== undefined) {
        updateData.calculationBasis = body.calculationBasis as any;
      }

      const [row] = await db
        .update(loanFees)
        .set(updateData)
        .where(eq(loanFees.id, id))
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error updating loan fee:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_LOAN_FEE_ERROR] Failed to update loan fee");
    }
  }

  /**
   * Delete loan fee (soft delete if not linked, archive if linked)
   */
  static async delete(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const [existing] = await db
        .select({ id: loanFees.id })
        .from(loanFees)
        .where(and(eq(loanFees.id, id), isNull(loanFees.deletedAt)))
        .limit(1);

      if (!existing) {
        throw httpError(404, "[LOAN_FEE_NOT_FOUND] Loan fee not found");
      }

      // Check if fee is linked to any loan products
      const [linkCount] = await db
        .select({ count: count() })
        .from(loanProductsLoanFees)
        .where(eq(loanProductsLoanFees.loanFeeId, id));

      if (linkCount.count > 0) {
        // Archive instead of delete
        await db
          .update(loanFees)
          .set({ isArchived: true, updatedAt: new Date() })
          .where(eq(loanFees.id, id));

        return {
          success: true,
          message: `Loan fee archived successfully (linked to ${linkCount.count} loan product(s))`,
        };
      }
      // Soft delete
      await db
        .update(loanFees)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(loanFees.id, id));

      return { success: true, message: "Loan fee deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting loan fee:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_LOAN_FEE_ERROR] Failed to delete loan fee");
    }
  }

  /**
   * Unarchive loan fee
   */
  static async unarchive(id: string): Promise<LoanFeesModel.LoanFeeItem> {
    try {
      const [existing] = await db
        .select({ id: loanFees.id, isArchived: loanFees.isArchived })
        .from(loanFees)
        .where(and(eq(loanFees.id, id), isNull(loanFees.deletedAt)))
        .limit(1);

      if (!existing) {
        throw httpError(404, "[LOAN_FEE_NOT_FOUND] Loan fee not found");
      }

      if (!existing.isArchived) {
        throw httpError(400, "[NOT_ARCHIVED] Loan fee is not archived");
      }

      const [row] = await db
        .update(loanFees)
        .set({ isArchived: false, updatedAt: new Date() })
        .where(eq(loanFees.id, id))
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error unarchiving loan fee:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UNARCHIVE_LOAN_FEE_ERROR] Failed to unarchive loan fee");
    }
  }
}
