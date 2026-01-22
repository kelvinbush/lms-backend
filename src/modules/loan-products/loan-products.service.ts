import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, ne, or } from "drizzle-orm";
import { db } from "../../db";
import {
  loanFees,
  loanProducts,
  loanProductsLoanFees,
  loanProductsUserGroups,
  organizations,
  userGroups,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import type { LoanProductsModel } from "./loan-products.model";

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

type LoanProductRow = typeof loanProducts.$inferSelect;

// Helper function to map a single row with pre-fetched relationships
function mapRow(
  r: LoanProductRow,
  userGroupIdsMap: Map<string, string[]>,
  feesMap: Map<string, LoanProductsModel.LoanFeeConfiguration[]>,
  loansCount?: number
): LoanProductsModel.LoanProductItem {
  const userGroupIds = userGroupIdsMap.get(r.id) || [];
  const fees = feesMap.get(r.id) || [];

  return {
    id: r.id,
    name: r.name,
    slug: r.slug ?? null,
    summary: r.summary ?? null,
    description: r.description ?? null,
    organizationId: r.organizationId,
    userGroupIds: userGroupIds.length > 0 ? userGroupIds : undefined,
    currency: r.currency,
    minAmount: toNumber(r.minAmount) ?? 0,
    maxAmount: toNumber(r.maxAmount) ?? 0,
    minTerm: r.minTerm,
    maxTerm: r.maxTerm,
    termUnit: r.termUnit,
    availabilityStartDate: r.availabilityStartDate?.toISOString()?.split("T")[0] ?? null,
    availabilityEndDate: r.availabilityEndDate?.toISOString()?.split("T")[0] ?? null,
    repaymentFrequency: r.repaymentFrequency,
    maxGracePeriod: r.maxGracePeriod ?? null,
    maxGraceUnit: r.maxGraceUnit ?? null,
    interestRate: toNumber(r.interestRate) ?? 0,
    ratePeriod: r.ratePeriod,
    amortizationMethod: r.amortizationMethod,
    interestCollectionMethod: r.interestCollectionMethod,
    interestRecognitionCriteria: r.interestRecognitionCriteria,
    fees: fees.length > 0 ? fees : undefined,
    // Versioning fields
    version: r.version ?? 1,
    status: r.status ?? "draft",
    changeReason: r.changeReason ?? null,
    approvedBy: r.approvedBy ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    isActive: r.status === "active", // Computed from status for backward compatibility
    createdAt: r.createdAt?.toISOString() ?? null,
    updatedAt: r.updatedAt?.toISOString() ?? null,
    loansCount: loansCount ?? 0,
  };
}

// Batch fetch relationships for multiple products (efficient)
async function fetchRelationshipsForProducts(productIds: string[]): Promise<{
  userGroupIdsMap: Map<string, string[]>;
  feesMap: Map<string, LoanProductsModel.LoanFeeConfiguration[]>;
}> {
  if (productIds.length === 0) {
    return {
      userGroupIdsMap: new Map(),
      feesMap: new Map(),
    };
  }

  // Batch fetch all user groups in one query
  const userGroupRows = await db
    .select({
      loanProductId: loanProductsUserGroups.loanProductId,
      userGroupId: loanProductsUserGroups.userGroupId,
    })
    .from(loanProductsUserGroups)
    .where(inArray(loanProductsUserGroups.loanProductId, productIds));

  // Batch fetch all fees in one query
  const feeRows = await db
    .select({
      loanProductId: loanProductsLoanFees.loanProductId,
      loanFeeId: loanProductsLoanFees.loanFeeId,
      fee: loanFees,
    })
    .from(loanProductsLoanFees)
    .innerJoin(loanFees, eq(loanProductsLoanFees.loanFeeId, loanFees.id))
    .where(inArray(loanProductsLoanFees.loanProductId, productIds));

  // Build maps for O(1) lookup
  const userGroupIdsMap = new Map<string, string[]>();
  for (const row of userGroupRows) {
    const existing = userGroupIdsMap.get(row.loanProductId) || [];
    existing.push(row.userGroupId);
    userGroupIdsMap.set(row.loanProductId, existing);
  }

  const feesMap = new Map<string, LoanProductsModel.LoanFeeConfiguration[]>();
  for (const row of feeRows) {
    const existing = feesMap.get(row.loanProductId) || [];
    existing.push({
      loanFeeId: row.loanFeeId,
      feeName: row.fee.name,
      calculationMethod: row.fee.calculationMethod,
      rate: toNumber(row.fee.rate) ?? 0,
      collectionRule: row.fee.collectionRule,
      allocationMethod: row.fee.allocationMethod,
      calculationBasis: row.fee.calculationBasis,
    });
    feesMap.set(row.loanProductId, existing);
  }

  return { userGroupIdsMap, feesMap };
}

export abstract class LoanProductsService {
  /**
   * Create a new loan product
   *
   * @description Creates a new loan product with draft status by default.
   * Products must be approved and activated before they can be used for applications.
   *
   * @param clerkId - The ID of the user creating the product
   * @param body - Product creation data
   * @returns Created product with draft status
   *
   * @throws {400} If product data is invalid
   * @throws {401} If user is not authorized
   * @throws {409} If product name already exists
   * @throws {500} If creation fails
   */
  static async create(
    clerkId: string,
    body: LoanProductsModel.CreateLoanProductBody
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Basic guards beyond JSON Schema
      if (body.minAmount > body.maxAmount) {
        throw httpError(400, "[INVALID_AMOUNT_RANGE] minAmount cannot exceed maxAmount");
      }
      if (body.minTerm > body.maxTerm) {
        throw httpError(400, "[INVALID_TERM_RANGE] minTerm cannot exceed maxTerm");
      }
      if (body.availabilityStartDate && body.availabilityEndDate) {
        const startDate = new Date(body.availabilityStartDate);
        const endDate = new Date(body.availabilityEndDate);
        if (endDate < startDate) {
          throw httpError(
            400,
            "[INVALID_DATE_RANGE] availabilityEndDate cannot be before availabilityStartDate"
          );
        }
      }

      // Validate organization exists
      const [org] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.id, body.organizationId), isNull(organizations.deletedAt)))
        .limit(1);
      if (!org) {
        throw httpError(400, "[INVALID_ORGANIZATION] Organization not found");
      }

      // Validate user groups exist
      if (body.userGroupIds && body.userGroupIds.length > 0) {
        const foundGroups = await db
          .select({ id: userGroups.id })
          .from(userGroups)
          .where(and(inArray(userGroups.id, body.userGroupIds), isNull(userGroups.deletedAt)));
        if (foundGroups.length !== body.userGroupIds.length) {
          throw httpError(400, "[INVALID_USER_GROUPS] One or more user groups not found");
        }
      }

      // Parse availability dates
      const availabilityStartDate = body.availabilityStartDate
        ? new Date(`${body.availabilityStartDate}T00:00:00Z`)
        : null;
      const availabilityEndDate = body.availabilityEndDate
        ? new Date(`${body.availabilityEndDate}T23:59:59Z`)
        : null;

      // Create loan product and relationships in a transaction
      const result = await db.transaction(async (tx) => {
        const values = {
          name: body.name,
          slug: body.slug ?? null,
          summary: body.summary ?? null,
          description: body.description ?? null,
          organizationId: body.organizationId,
          availabilityStartDate: availabilityStartDate,
          availabilityEndDate: availabilityEndDate,
          currency: body.currency,
          minAmount: body.minAmount as any,
          maxAmount: body.maxAmount as any,
          minTerm: body.minTerm,
          maxTerm: body.maxTerm,
          termUnit: body.termUnit as any,
          interestRate: body.interestRate as any,
          ratePeriod: body.ratePeriod as any,
          amortizationMethod: body.amortizationMethod as any,
          repaymentFrequency: body.repaymentFrequency,
          interestCollectionMethod: body.interestCollectionMethod as any,
          interestRecognitionCriteria: body.interestRecognitionCriteria as any,
          maxGracePeriod: body.maxGracePeriod ?? null,
          maxGraceUnit: (body.maxGraceUnit as any) ?? null,
          version: 1,
          status: (body.status ?? "draft") as any,
        };

        const [row] = await tx.insert(loanProducts).values(values).returning();

        // Create user group associations
        if (body.userGroupIds && body.userGroupIds.length > 0) {
          await tx.insert(loanProductsUserGroups).values(
            body.userGroupIds.map((userGroupId) => ({
              loanProductId: row.id,
              userGroupId,
            }))
          );
        }

        // Handle fees - create new fees if needed, then link them
        if (body.fees && body.fees.length > 0) {
          const feeLinks: Array<{ loanProductId: string; loanFeeId: string }> = [];

          for (const feeConfig of body.fees) {
            let feeId: string;

            if (feeConfig.loanFeeId) {
              // Use existing fee
              feeId = feeConfig.loanFeeId;
            } else if (feeConfig.feeName) {
              // Create new fee inline
              const [newFee] = await tx
                .insert(loanFees)
                .values({
                  name: feeConfig.feeName,
                  calculationMethod: feeConfig.calculationMethod as any,
                  rate: feeConfig.rate as any,
                  collectionRule: feeConfig.collectionRule as any,
                  allocationMethod: feeConfig.allocationMethod,
                  calculationBasis: feeConfig.calculationBasis as any,
                  isArchived: false,
                })
                .returning();
              feeId = newFee.id;
            } else {
              throw httpError(400, "[INVALID_FEE] Fee must have either loanFeeId or feeName");
            }

            feeLinks.push({ loanProductId: row.id, loanFeeId: feeId });
          }

          if (feeLinks.length > 0) {
            await tx.insert(loanProductsLoanFees).values(feeLinks);
          }
        }

        return row;
      });

      // Fetch relationships for the created product
      const { userGroupIdsMap, feesMap } = await fetchRelationshipsForProducts([result.id]);
      // New products have 0 loan applications
      return mapRow(result, userGroupIdsMap, feesMap, 0);
    } catch (error: any) {
      logger.error("Error creating loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_LOAN_PRODUCT_ERROR] Failed to create loan product");
    }
  }

  /**
   * List loan products with comprehensive filtering and pagination
   *
   * @description Retrieves loan products with advanced filtering, sorting, and pagination.
   * Supports filtering by status, currency, amount ranges, terms, and search functionality.
   *
   * Product Status Rules:
   * - draft: Being configured, not available for applications
   * - active: Available for new loan applications
   * - archived: Historical record only, no new applications
   *
   * @param clerkId - The ID of the user requesting the list
   * @param query - Comprehensive filtering and pagination parameters
   * @param query.page - Page number (default: 1)
   * @param query.limit - Items per page (default: 20, max: 100)
   * @param query.status - Filter by product status
   * @param query.includeArchived - Include archived products (default: false)
   * @param query.currency - Filter by currency
   * @param query.minAmount - Filter by minimum amount
   * @param query.maxAmount - Filter by maximum amount
   * @param query.minTerm - Filter by minimum term
   * @param query.maxTerm - Filter by maximum term
   * @param query.termUnit - Filter by term unit
   * @param query.interestType - Filter by interest type
   * @param query.ratePeriod - Filter by rate period
   * @param query.amortizationMethod - Filter by amortization method
   * @param query.repaymentFrequency - Filter by repayment frequency
   * @param query.isActive - Filter by active status
   * @param query.search - Search in name and description
   * @param query.sortBy - Sort field (default: createdAt)
   * @param query.sortOrder - Sort order (default: desc)
   * @returns Paginated list of products matching the criteria
   *
   * @throws {401} If user is not authorized
   * @throws {500} If listing fails
   */
  static async list(
    clerkId: string,
    query: LoanProductsModel.ListLoanProductsQuery = {}
  ): Promise<LoanProductsModel.ListLoanProductsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Parse pagination parameters
      const page = query.page ? Number.parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? Number.parseInt(query.limit) : 20, 100); // Max 100 items per page
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [isNull(loanProducts.deletedAt)];

      // Status filtering
      if (query.status) {
        // If status is explicitly provided, use that filter
        whereConditions.push(eq(loanProducts.status, query.status));
      } else if (query.includeArchived === "false") {
        // Only exclude archived if explicitly requested to exclude them
        whereConditions.push(ne(loanProducts.status, "archived"));
      }
      // If no status filter and includeArchived is not "false", show all products (including archived)

      // Currency filtering
      if (query.currency) {
        whereConditions.push(eq(loanProducts.currency, query.currency));
      }

      // Amount range filtering
      if (query.minAmount) {
        whereConditions.push(gte(loanProducts.minAmount, query.minAmount));
      }
      if (query.maxAmount) {
        whereConditions.push(lte(loanProducts.maxAmount, query.maxAmount));
      }

      // Term range filtering
      if (query.minTerm) {
        whereConditions.push(gte(loanProducts.minTerm, Number.parseInt(query.minTerm)));
      }
      if (query.maxTerm) {
        whereConditions.push(lte(loanProducts.maxTerm, Number.parseInt(query.maxTerm)));
      }

      // Term unit filtering
      if (query.termUnit) {
        whereConditions.push(eq(loanProducts.termUnit, query.termUnit));
      }

      // Rate period filtering
      if (query.ratePeriod) {
        whereConditions.push(eq(loanProducts.ratePeriod, query.ratePeriod));
      }

      // Amortization method filtering
      if (query.amortizationMethod) {
        whereConditions.push(eq(loanProducts.amortizationMethod, query.amortizationMethod));
      }

      // Repayment frequency filtering
      if (query.repaymentFrequency) {
        whereConditions.push(eq(loanProducts.repaymentFrequency, query.repaymentFrequency));
      }

      // isActive filter is deprecated - use status filter instead
      // If isActive is provided, map it to status filter for backward compatibility
      if (query.isActive !== undefined) {
        const isActive = query.isActive === "true";
        if (isActive) {
          whereConditions.push(eq(loanProducts.status, "active"));
        } else {
          whereConditions.push(ne(loanProducts.status, "active"));
        }
      }

      // Search functionality
      if (query.search) {
        const searchTerm = `%${query.search}%`;
        const searchCondition = or(
          like(loanProducts.name, searchTerm),
          like(loanProducts.description, searchTerm),
          like(loanProducts.summary, searchTerm)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      // Get total count for pagination
      const [{ total }] = await db
        .select({ total: count() })
        .from(loanProducts)
        .where(and(...whereConditions));

      // Build sorting
      const sortBy = query.sortBy || "createdAt";
      const sortOrder = query.sortOrder || "desc";

      let orderByClause;
      switch (sortBy) {
        case "name":
          orderByClause = sortOrder === "asc" ? asc(loanProducts.name) : desc(loanProducts.name);
          break;
        case "interestRate":
          orderByClause =
            sortOrder === "asc" ? asc(loanProducts.interestRate) : desc(loanProducts.interestRate);
          break;
        case "minAmount":
          orderByClause =
            sortOrder === "asc" ? asc(loanProducts.minAmount) : desc(loanProducts.minAmount);
          break;
        case "maxAmount":
          orderByClause =
            sortOrder === "asc" ? asc(loanProducts.maxAmount) : desc(loanProducts.maxAmount);
          break;
        case "updatedAt":
          orderByClause =
            sortOrder === "asc" ? asc(loanProducts.updatedAt) : desc(loanProducts.updatedAt);
          break;
        default: // createdAt
          orderByClause =
            sortOrder === "asc" ? asc(loanProducts.createdAt) : desc(loanProducts.createdAt);
      }

      // Get paginated results with loan application counts (optimized single query)
      const rows = await db
        .select({
          id: loanProducts.id,
          name: loanProducts.name,
          slug: loanProducts.slug,
          summary: loanProducts.summary,
          description: loanProducts.description,
          organizationId: loanProducts.organizationId,
          currency: loanProducts.currency,
          minAmount: loanProducts.minAmount,
          maxAmount: loanProducts.maxAmount,
          minTerm: loanProducts.minTerm,
          maxTerm: loanProducts.maxTerm,
          termUnit: loanProducts.termUnit,
          availabilityStartDate: loanProducts.availabilityStartDate,
          availabilityEndDate: loanProducts.availabilityEndDate,
          repaymentFrequency: loanProducts.repaymentFrequency,
          maxGracePeriod: loanProducts.maxGracePeriod,
          maxGraceUnit: loanProducts.maxGraceUnit,
          interestRate: loanProducts.interestRate,
          ratePeriod: loanProducts.ratePeriod,
          amortizationMethod: loanProducts.amortizationMethod,
          interestCollectionMethod: loanProducts.interestCollectionMethod,
          interestRecognitionCriteria: loanProducts.interestRecognitionCriteria,
          version: loanProducts.version,
          status: loanProducts.status,
          changeReason: loanProducts.changeReason,
          approvedBy: loanProducts.approvedBy,
          approvedAt: loanProducts.approvedAt,
          createdAt: loanProducts.createdAt,
          updatedAt: loanProducts.updatedAt,
          deletedAt: loanProducts.deletedAt,
          // TODO: Re-add loansCount when loan applications are re-implemented
          // loansCount: count(loanApplications.id),
        })
        .from(loanProducts)
        // TODO: Re-add loanApplications leftJoin when loan applications are re-implemented
        // .leftJoin(
        //   loanApplications,
        //   and(
        //     eq(loanApplications.loanProductId, loanProducts.id),
        //     isNull(loanApplications.deletedAt)
        //   )
        // )
        .where(and(...whereConditions))
        // TODO: Re-add groupBy when loansCount is re-added
        // .groupBy(loanProducts.id)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      // Batch fetch relationships for all products (efficient - only 2 queries total)
      const productIds = rows.map((row) => row.id);
      const { userGroupIdsMap, feesMap } = await fetchRelationshipsForProducts(productIds);

      // Map rows synchronously using pre-fetched data
      // TODO: Re-add loansCount parameter when loan applications are re-implemented
      const mappedRows = rows.map((row) =>
        mapRow(
          row as LoanProductRow,
          userGroupIdsMap,
          feesMap,
          0 /* loansCount: TODO - re-add when loan applications are re-implemented */
        )
      );

      return {
        success: true,
        message: "Loan products retrieved successfully",
        data: mappedRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing loan products:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_LOAN_PRODUCTS_ERROR] Failed to list loan products");
    }
  }

  /**
   * Get a loan product by ID
   *
   * @description Retrieves a specific loan product by its ID.
   * Returns the product regardless of status (including archived).
   *
   * @param clerkId - The ID of the user requesting the product
   * @param id - The product ID
   * @returns The requested product
   *
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {500} If retrieval fails
   */
  static async getById(clerkId: string, id: string): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Get product with loan application count
      const [result] = await db
        .select({
          id: loanProducts.id,
          name: loanProducts.name,
          slug: loanProducts.slug,
          summary: loanProducts.summary,
          description: loanProducts.description,
          organizationId: loanProducts.organizationId,
          currency: loanProducts.currency,
          minAmount: loanProducts.minAmount,
          maxAmount: loanProducts.maxAmount,
          minTerm: loanProducts.minTerm,
          maxTerm: loanProducts.maxTerm,
          termUnit: loanProducts.termUnit,
          availabilityStartDate: loanProducts.availabilityStartDate,
          availabilityEndDate: loanProducts.availabilityEndDate,
          repaymentFrequency: loanProducts.repaymentFrequency,
          maxGracePeriod: loanProducts.maxGracePeriod,
          maxGraceUnit: loanProducts.maxGraceUnit,
          interestRate: loanProducts.interestRate,
          ratePeriod: loanProducts.ratePeriod,
          amortizationMethod: loanProducts.amortizationMethod,
          interestCollectionMethod: loanProducts.interestCollectionMethod,
          interestRecognitionCriteria: loanProducts.interestRecognitionCriteria,
          version: loanProducts.version,
          status: loanProducts.status,
          changeReason: loanProducts.changeReason,
          approvedBy: loanProducts.approvedBy,
          approvedAt: loanProducts.approvedAt,
          createdAt: loanProducts.createdAt,
          updatedAt: loanProducts.updatedAt,
          deletedAt: loanProducts.deletedAt,
          // TODO: Re-add loansCount when loan applications are re-implemented
          // loansCount: count(loanApplications.id),
        })
        .from(loanProducts)
        // TODO: Re-add loanApplications leftJoin when loan applications are re-implemented
        // .leftJoin(
        //   loanApplications,
        //   and(
        //     eq(loanApplications.loanProductId, loanProducts.id),
        //     isNull(loanApplications.deletedAt)
        //   )
        // )
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)))
        // TODO: Re-add groupBy when loansCount is re-added
        // .groupBy(loanProducts.id)
        .limit(1);

      if (!result) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Fetch relationships for this single product
      const { userGroupIdsMap, feesMap } = await fetchRelationshipsForProducts([result.id]);
      // TODO: Re-add loansCount parameter when loan applications are re-implemented
      return mapRow(
        result as LoanProductRow,
        userGroupIdsMap,
        feesMap,
        0 /* loansCount: TODO - re-add when loan applications are re-implemented */
      );
    } catch (error: any) {
      logger.error("Error getting loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_PRODUCT_ERROR] Failed to get loan product");
    }
  }

  /**
   * Update a loan product
   *
   * @description Updates an existing loan product. The ability to edit depends on the product's status:
   *
   * Edit Rules by Status:
   * - draft: ✅ Can edit all fields (name, rates, terms, etc.)
   * - active: ✅ Can edit all fields with automatic versioning for critical changes
   * - archived: ❌ Cannot edit - read-only historical record
   *
   * For active products, critical field changes (rates, terms) automatically increment version.
   * Existing applications are protected by immutable snapshots, so changes are safe.
   *
   * @param clerkId - The ID of the user updating the product
   * @param id - The product ID
   * @param body - Updated product data
   * @returns Updated product
   *
   * @throws {400} If update data is invalid or violates edit rules
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {409} If product name already exists
   * @throws {500} If update fails
   */
  static async update(
    clerkId: string,
    id: string,
    body: LoanProductsModel.EditLoanProductBody
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      if (
        body.minAmount !== undefined &&
        body.maxAmount !== undefined &&
        body.minAmount > body.maxAmount
      ) {
        throw httpError(400, "[INVALID_AMOUNT_RANGE] minAmount cannot exceed maxAmount");
      }
      if (body.minTerm !== undefined && body.maxTerm !== undefined && body.minTerm > body.maxTerm) {
        throw httpError(400, "[INVALID_TERM_RANGE] minTerm cannot exceed maxTerm");
      }

      const [existing] = await db
        .select({
          id: loanProducts.id,
          status: loanProducts.status,
          name: loanProducts.name,
        })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Validate edit permissions based on status
      if (existing.status === "archived") {
        throw httpError(
          400,
          "[PRODUCT_ARCHIVED] Cannot edit archived products - they are read-only historical records"
        );
      }

      // Check for critical field changes on active products (for versioning)
      let shouldIncrementVersion = false;
      if (existing.status === "active") {
        const criticalFields = [
          "minAmount",
          "maxAmount",
          "minTerm",
          "maxTerm",
          "interestRate",
          "ratePeriod",
          "amortizationMethod",
          "repaymentFrequency",
          "interestCollectionMethod",
          "interestRecognitionCriteria",
        ];
        shouldIncrementVersion = criticalFields.some(
          (field) => body[field as keyof typeof body] !== undefined
        );

        if (shouldIncrementVersion) {
          logger.info(
            `[PRODUCT_VERSION_INCREMENT] Critical field change detected for product ${id} (${existing.name}). Version will be incremented.`
          );
        }
      }

      // Validate organization if being updated
      if (body.organizationId) {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(and(eq(organizations.id, body.organizationId), isNull(organizations.deletedAt)))
          .limit(1);
        if (!org) {
          throw httpError(400, "[INVALID_ORGANIZATION] Organization not found");
        }
      }

      // Validate user groups if being updated
      if (body.userGroupIds && body.userGroupIds.length > 0) {
        const foundGroups = await db
          .select({ id: userGroups.id })
          .from(userGroups)
          .where(and(inArray(userGroups.id, body.userGroupIds), isNull(userGroups.deletedAt)));
        if (foundGroups.length !== body.userGroupIds.length) {
          throw httpError(400, "[INVALID_USER_GROUPS] One or more user groups not found");
        }
      }

      // Parse availability dates if provided
      const availabilityStartDate = body.availabilityStartDate
        ? new Date(`${body.availabilityStartDate}T00:00:00Z`)
        : undefined;
      const availabilityEndDate = body.availabilityEndDate
        ? new Date(`${body.availabilityEndDate}T23:59:59Z`)
        : undefined;

      // Get current version for incrementing
      const [currentProduct] = await db
        .select({ version: loanProducts.version })
        .from(loanProducts)
        .where(eq(loanProducts.id, id));

      // Update in transaction to handle relationships
      const result = await db.transaction(async (tx) => {
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.slug !== undefined) updateData.slug = body.slug ?? null;
        if (body.summary !== undefined) updateData.summary = body.summary ?? null;
        if (body.description !== undefined) updateData.description = body.description ?? null;
        if (body.organizationId !== undefined) updateData.organizationId = body.organizationId;
        if (body.availabilityStartDate !== undefined)
          updateData.availabilityStartDate = availabilityStartDate ?? null;
        if (body.availabilityEndDate !== undefined)
          updateData.availabilityEndDate = availabilityEndDate ?? null;
        if (body.currency !== undefined) updateData.currency = body.currency;
        if (body.minAmount !== undefined) updateData.minAmount = body.minAmount as any;
        if (body.maxAmount !== undefined) updateData.maxAmount = body.maxAmount as any;
        if (body.minTerm !== undefined) updateData.minTerm = body.minTerm;
        if (body.maxTerm !== undefined) updateData.maxTerm = body.maxTerm;
        if (body.termUnit !== undefined) updateData.termUnit = body.termUnit as any;
        if (body.repaymentFrequency !== undefined)
          updateData.repaymentFrequency = body.repaymentFrequency as any;
        if (body.maxGracePeriod !== undefined)
          updateData.maxGracePeriod = body.maxGracePeriod ?? null;
        if (body.maxGraceUnit !== undefined)
          updateData.maxGraceUnit = (body.maxGraceUnit as any) ?? null;
        if (body.interestRate !== undefined) updateData.interestRate = body.interestRate as any;
        if (body.ratePeriod !== undefined) updateData.ratePeriod = body.ratePeriod as any;
        if (body.amortizationMethod !== undefined)
          updateData.amortizationMethod = body.amortizationMethod as any;
        if (body.interestCollectionMethod !== undefined)
          updateData.interestCollectionMethod = body.interestCollectionMethod as any;
        if (body.interestRecognitionCriteria !== undefined)
          updateData.interestRecognitionCriteria = body.interestRecognitionCriteria as any;
        if (shouldIncrementVersion) updateData.version = (currentProduct?.version ?? 1) + 1;
        // isActive is deprecated - use status field instead
        // If isActive is provided in body, ignore it (status should be used)

        const [row] = await tx
          .update(loanProducts)
          .set(updateData)
          .where(eq(loanProducts.id, id))
          .returning();

        // Update user group associations if provided
        if (body.userGroupIds !== undefined) {
          // Delete existing associations
          await tx
            .delete(loanProductsUserGroups)
            .where(eq(loanProductsUserGroups.loanProductId, id));
          // Insert new associations
          if (body.userGroupIds.length > 0) {
            await tx.insert(loanProductsUserGroups).values(
              body.userGroupIds.map((userGroupId) => ({
                loanProductId: id,
                userGroupId,
              }))
            );
          }
        }

        // Update fee associations if provided
        if (body.fees !== undefined) {
          // Delete existing associations
          await tx.delete(loanProductsLoanFees).where(eq(loanProductsLoanFees.loanProductId, id));
          // Create new fees if needed and link them
          if (body.fees.length > 0) {
            const feeLinks: Array<{ loanProductId: string; loanFeeId: string }> = [];

            for (const feeConfig of body.fees) {
              let feeId: string;

              if (feeConfig.loanFeeId) {
                feeId = feeConfig.loanFeeId;
              } else if (feeConfig.feeName) {
                const [newFee] = await tx
                  .insert(loanFees)
                  .values({
                    name: feeConfig.feeName,
                    calculationMethod: feeConfig.calculationMethod as any,
                    rate: feeConfig.rate as any,
                    collectionRule: feeConfig.collectionRule as any,
                    allocationMethod: feeConfig.allocationMethod,
                    calculationBasis: feeConfig.calculationBasis as any,
                    isArchived: false,
                  })
                  .returning();
                feeId = newFee.id;
              } else {
                throw httpError(400, "[INVALID_FEE] Fee must have either loanFeeId or feeName");
              }

              feeLinks.push({ loanProductId: id, loanFeeId: feeId });
            }

            if (feeLinks.length > 0) {
              await tx.insert(loanProductsLoanFees).values(feeLinks);
            }
          }
        }

        return row;
      });

      // TODO: Re-add loan application count when loan applications are re-implemented
      // Get loan application count for the updated product
      // const [{ loansCount }] = await db
      //   .select({ loansCount: count(loanApplications.id) })
      //   .from(loanApplications)
      //   .where(
      //     and(
      //       eq(loanApplications.loanProductId, result.id),
      //       isNull(loanApplications.deletedAt)
      //     )
      //   );

      // Fetch relationships for the updated product
      const { userGroupIdsMap, feesMap } = await fetchRelationshipsForProducts([result.id]);
      return mapRow(
        result,
        userGroupIdsMap,
        feesMap,
        0 /* loansCount: TODO - re-add when loan applications are re-implemented */
      );
    } catch (error: any) {
      logger.error("Error updating loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_LOAN_PRODUCT_ERROR] Failed to update loan product");
    }
  }

  /**
   * Soft delete a loan product
   *
   * @description Soft deletes a loan product by setting deletedAt timestamp.
   * The product becomes unavailable for new applications but existing applications continue to work.
   *
   * Deletion Rules by Status:
   * - draft: ✅ Can delete (no applications exist)
   * - active: ⚠️ Can delete but check for existing applications first
   * - archived: ✅ Can delete (already archived)
   *
   * @param clerkId - The ID of the user deleting the product
   * @param id - The product ID
   * @returns Success message
   *
   * @throws {400} If product has active applications
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {500} If deletion fails
   */
  static async remove(clerkId: string, id: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({
          id: loanProducts.id,
          status: loanProducts.status,
        })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // TODO: Re-add loan application checks when loan applications are re-implemented
      // Check for existing applications (only for active products)
      // if (existing.status === "active") {
      //   const [applicationCount] = await db
      //     .select({ count: count() })
      //     .from(loanApplications)
      //     .where(and(
      //       eq(loanApplications.loanProductId, id),
      //       or(
      //         eq(loanApplications.status, "submitted"),
      //         eq(loanApplications.status, "under_review"),
      //         eq(loanApplications.status, "approved"),
      //         eq(loanApplications.status, "offer_letter_sent"),
      //         eq(loanApplications.status, "offer_letter_signed"),
      //         eq(loanApplications.status, "disbursed")
      //       )
      //     ));
      //
      //   if (applicationCount.count > 0) {
      //     throw httpError(400, `[PRODUCT_HAS_APPLICATIONS] Cannot delete product with ${applicationCount.count} active applications. Archive the product instead.`);
      //   }
      // }

      await db
        .update(loanProducts)
        .set({
          deletedAt: new Date(),
          status: "archived" as any,
          updatedAt: new Date(),
        })
        .where(eq(loanProducts.id, id));

      return { success: true, message: "Loan product deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_LOAN_PRODUCT_ERROR] Failed to delete loan product");
    }
  }

  /**
   * Update product status
   *
   * @description Changes the status of a loan product. This is the primary way to manage product lifecycle.
   *
   * Note: Reactivation of archived products is safe due to immutable snapshots. Each application
   * maintains its own snapshot of the product state at the time of application, ensuring data integrity.
   *
   * Status Transition Rules:
   * - draft → active: ✅ Product becomes available for applications (requires approval)
   * - active → archived: ✅ Product becomes read-only historical record
   * - archived → active: ✅ Can reactivate with proper approval and audit logging
   * - Any status → draft: ❌ Cannot revert to draft once approved
   *
   * @param clerkId - The ID of the user changing the status
   * @param id - The product ID
   * @param newStatus - The new status to set
   * @param changeReason - Required reason for the status change
   * @param approvedBy - The ID of the user approving the change
   * @returns Updated product
   *
   * @throws {400} If status transition is invalid
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {500} If status update fails
   */
  static async updateStatus(
    clerkId: string,
    id: string,
    newStatus: LoanProductsModel.ProductStatus,
    changeReason: string,
    approvedBy: string
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");
      if (!changeReason)
        throw httpError(400, "[MISSING_REASON] Change reason is required for status updates");
      if (!approvedBy)
        throw httpError(400, "[MISSING_APPROVER] Approver ID is required for status updates");

      const [existing] = await db
        .select({
          id: loanProducts.id,
          status: loanProducts.status,
          name: loanProducts.name,
          version: loanProducts.version,
        })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Validate status transition
      const currentStatus = existing.status;
      const validTransitions: Record<string, string[]> = {
        draft: ["active"],
        active: ["archived"],
        archived: ["active"], // Can reactivate with proper approval
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw httpError(
          400,
          `[INVALID_TRANSITION] Cannot change status from ${currentStatus} to ${newStatus}. Valid transitions: ${validTransitions[currentStatus]?.join(", ") || "none"}`
        );
      }

      // TODO: Re-add loan application validation when loan applications are re-implemented
      // Special validation for archiving
      // if (newStatus === "archived") {
      //   const [applicationCount] = await db
      //     .select({ count: count() })
      //     .from(loanApplications)
      //     .where(and(
      //       eq(loanApplications.loanProductId, id),
      //       or(
      //         eq(loanApplications.status, "submitted"),
      //         eq(loanApplications.status, "under_review"),
      //         eq(loanApplications.status, "approved"),
      //         eq(loanApplications.status, "offer_letter_sent"),
      //         eq(loanApplications.status, "offer_letter_signed"),
      //         eq(loanApplications.status, "disbursed")
      //       )
      //     ));
      //
      //   if (applicationCount.count > 0) {
      //     throw httpError(400, `[PRODUCT_HAS_APPLICATIONS] Cannot archive product with ${applicationCount.count} active applications. Wait for applications to complete.`);
      //   }
      // }

      // TODO: Re-add loan application validation when loan applications are re-implemented
      // Special validation for reactivation (archived → active)
      // if (newStatus === "active" && currentStatus === "archived") {
      //   // Check for any applications that might be affected by reactivation
      //   // Since we have snapshots, this is mainly for business logic validation
      //   const [applicationCount] = await db
      //     .select({ count: count() })
      //     .from(loanApplications)
      //     .where(and(
      //       eq(loanApplications.loanProductId, id),
      //       or(
      //         eq(loanApplications.status, "submitted"),
      //         eq(loanApplications.status, "under_review"),
      //         eq(loanApplications.status, "approved"),
      //         eq(loanApplications.status, "offer_letter_sent"),
      //         eq(loanApplications.status, "offer_letter_signed"),
      //         eq(loanApplications.status, "disbursed")
      //       )
      //     ));
      //
      //   // Log reactivation for audit trail
      //   logger.info(`[PRODUCT_REACTIVATION] Product ${id} (${existing.name}) reactivated by ${approvedBy}. Reason: ${changeReason}. Active applications: ${applicationCount.count}`);
      //
      //   // Note: We allow reactivation even with active applications because:
      //   // 1. Each application has its own immutable snapshot
      //   // 2. New applications will use the current product state
      //   // 3. Existing applications remain unaffected
      // }

      const [row] = await db
        .update(loanProducts)
        .set({
          status: newStatus as any,
          changeReason,
          approvedBy,
          approvedAt: new Date(),
          version:
            newStatus === "active" && currentStatus === "draft"
              ? (existing.version ?? 1) + 1
              : (existing.version ?? 1), // Increment version on activation
          updatedAt: new Date(),
        })
        .where(eq(loanProducts.id, id))
        .returning();

      // TODO: Re-add loan application count when loan applications are re-implemented
      // Get loan application count for the updated product
      // const [{ loansCount }] = await db
      //   .select({ loansCount: count(loanApplications.id) })
      //   .from(loanApplications)
      //   .where(
      //     and(
      //       eq(loanApplications.loanProductId, id),
      //       isNull(loanApplications.deletedAt)
      //     )
      //   );

      // Fetch relationships for the updated product
      const { userGroupIdsMap, feesMap } = await fetchRelationshipsForProducts([row.id]);
      return mapRow(
        row,
        userGroupIdsMap,
        feesMap,
        0 /* loansCount: TODO - re-add when loan applications are re-implemented */
      );
    } catch (error: any) {
      logger.error("Error updating product status:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_PRODUCT_STATUS_ERROR] Failed to update product status");
    }
  }

  /**
   * Get products available for applications
   *
   * @description Returns only products that are available for new loan applications.
   * This excludes draft, archived, and deleted products.
   *
   * @param clerkId - The ID of the user requesting available products
   * @returns List of products available for applications
   *
   * @throws {401} If user is not authorized
   * @throws {500} If retrieval fails
   */
  static async getAvailableForApplications(
    clerkId: string
  ): Promise<LoanProductsModel.ListLoanProductsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Get products with loan application counts (optimized single query)
      const rows = await db
        .select({
          id: loanProducts.id,
          name: loanProducts.name,
          slug: loanProducts.slug,
          summary: loanProducts.summary,
          description: loanProducts.description,
          organizationId: loanProducts.organizationId,
          currency: loanProducts.currency,
          minAmount: loanProducts.minAmount,
          maxAmount: loanProducts.maxAmount,
          minTerm: loanProducts.minTerm,
          maxTerm: loanProducts.maxTerm,
          termUnit: loanProducts.termUnit,
          availabilityStartDate: loanProducts.availabilityStartDate,
          availabilityEndDate: loanProducts.availabilityEndDate,
          repaymentFrequency: loanProducts.repaymentFrequency,
          maxGracePeriod: loanProducts.maxGracePeriod,
          maxGraceUnit: loanProducts.maxGraceUnit,
          interestRate: loanProducts.interestRate,
          ratePeriod: loanProducts.ratePeriod,
          amortizationMethod: loanProducts.amortizationMethod,
          interestCollectionMethod: loanProducts.interestCollectionMethod,
          interestRecognitionCriteria: loanProducts.interestRecognitionCriteria,
          version: loanProducts.version,
          status: loanProducts.status,
          changeReason: loanProducts.changeReason,
          approvedBy: loanProducts.approvedBy,
          approvedAt: loanProducts.approvedAt,
          createdAt: loanProducts.createdAt,
          updatedAt: loanProducts.updatedAt,
          deletedAt: loanProducts.deletedAt,
          // TODO: Re-add loansCount when loan applications are re-implemented
          // loansCount: count(loanApplications.id),
        })
        .from(loanProducts)
        // TODO: Re-add loanApplications leftJoin when loan applications are re-implemented
        // .leftJoin(
        //   loanApplications,
        //   and(
        //     eq(loanApplications.loanProductId, loanProducts.id),
        //     isNull(loanApplications.deletedAt)
        //   )
        // )
        .where(and(isNull(loanProducts.deletedAt), eq(loanProducts.status, "active")))
        // TODO: Re-add groupBy when loansCount is re-added
        // .groupBy(loanProducts.id)
        .orderBy(desc(loanProducts.createdAt));

      // Batch fetch relationships for all products (efficient - only 2 queries total)
      const productIds = rows.map((row) => row.id);
      const { userGroupIdsMap, feesMap } = await fetchRelationshipsForProducts(productIds);

      // Map rows synchronously using pre-fetched data
      // TODO: Re-add loansCount parameter when loan applications are re-implemented
      const mappedRows = rows.map((row) =>
        mapRow(
          row as LoanProductRow,
          userGroupIdsMap,
          feesMap,
          0 /* loansCount: TODO - re-add when loan applications are re-implemented */
        )
      );

      return {
        success: true,
        message: "Available loan products retrieved successfully",
        data: mappedRows,
      };
    } catch (error: any) {
      logger.error("Error getting available products:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_AVAILABLE_PRODUCTS_ERROR] Failed to get available products");
    }
  }
}
