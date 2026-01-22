import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { businessProfiles, loanProducts, users } from "../../db/schema";
import { toNumber } from "./loan-applications.mapper";
import type { LoanApplicationsModel } from "./loan-applications.model";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

/**
 * Validate user exists by clerkId
 */
export async function validateUser(clerkId: string) {
  if (!clerkId) {
    throw httpError(401, "[UNAUTHORIZED] Missing user context");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    throw httpError(404, "[USER_NOT_FOUND] User not found");
  }

  return user;
}

/**
 * Validate loan product exists and is active
 */
export async function validateLoanProduct(loanProductId: string) {
  const [loanProduct] = await db
    .select()
    .from(loanProducts)
    .where(
      and(
        eq(loanProducts.id, loanProductId),
        isNull(loanProducts.deletedAt),
        eq(loanProducts.status, "active")
      )
    )
    .limit(1);

  if (!loanProduct) {
    throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found or not active");
  }

  return loanProduct;
}

/**
 * Validate business exists
 */
export async function validateBusiness(businessId: string) {
  const business = await db.query.businessProfiles.findFirst({
    where: and(eq(businessProfiles.id, businessId), isNull(businessProfiles.deletedAt)),
  });

  if (!business) {
    throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");
  }

  if (!business.userId) {
    throw httpError(400, "[INVALID_BUSINESS] Business profile is missing user ID");
  }

  return business as typeof business & { userId: string };
}

/**
 * Validate entrepreneur exists and is associated with the business
 */
export async function validateEntrepreneur(entrepreneurId: string, businessUserId: string) {
  const entrepreneur = await db.query.users.findFirst({
    where: and(eq(users.id, entrepreneurId), isNull(users.deletedAt)),
  });

  if (!entrepreneur) {
    throw httpError(404, "[ENTREPRENEUR_NOT_FOUND] Entrepreneur not found");
  }

  // Verify entrepreneur is the business owner
  if (businessUserId !== entrepreneurId) {
    throw httpError(400, "[INVALID_ENTREPRENEUR] Entrepreneur must be the owner of the business");
  }

  return entrepreneur;
}

/**
 * Validate funding amount against loan product constraints
 */
export function validateFundingAmount(
  fundingAmount: number,
  loanProduct: typeof loanProducts.$inferSelect
) {
  const minAmount = toNumber(loanProduct.minAmount) ?? 0;
  const maxAmount = toNumber(loanProduct.maxAmount) ?? 0;

  if (fundingAmount < minAmount || fundingAmount > maxAmount) {
    throw httpError(
      400,
      `[INVALID_AMOUNT] Funding amount must be between ${minAmount} and ${maxAmount} ${loanProduct.currency}`
    );
  }
}

/**
 * Validate repayment period against loan product constraints
 *
 * Note: repaymentPeriod should be provided in the same unit as the loan product's termUnit
 * (e.g., if product termUnit is "days", repaymentPeriod should be in days)
 */
export function validateRepaymentPeriod(
  repaymentPeriod: number,
  loanProduct: typeof loanProducts.$inferSelect
) {
  // No conversion needed - repaymentPeriod is already in the product's termUnit
  if (repaymentPeriod < loanProduct.minTerm || repaymentPeriod > loanProduct.maxTerm) {
    throw httpError(
      400,
      `[INVALID_TERM] Repayment period must be between ${loanProduct.minTerm} and ${loanProduct.maxTerm} ${loanProduct.termUnit}. You provided ${repaymentPeriod} ${loanProduct.termUnit}.`
    );
  }
}

/**
 * Validate currency matches loan product
 */
export function validateCurrency(
  fundingCurrency: string,
  loanProduct: typeof loanProducts.$inferSelect
) {
  if (fundingCurrency !== loanProduct.currency) {
    throw httpError(
      400,
      `[INVALID_CURRENCY] Currency must match loan product currency: ${loanProduct.currency}`
    );
  }
}

/**
 * Validate all loan application creation data
 * 
 * Note: This function is called AFTER the service has:
 * - Auto-set businessId and entrepreneurId for entrepreneurs
 * - Validated that businessId and entrepreneurId are provided for admins
 * So these fields are guaranteed to be set at this point, but we check defensively.
 */
export async function validateLoanApplicationCreation(
  clerkId: string,
  body: LoanApplicationsModel.CreateLoanApplicationBody
) {
  const user = await validateUser(clerkId);
  
  // Defensive check: businessId should already be set by the service (auto-set for entrepreneurs, validated for admins)
  if (!body.businessId) {
    throw httpError(400, "[MISSING_BUSINESS_ID] Business ID is required");
  }
  
  const loanProduct = await validateLoanProduct(body.loanProductId);
  const business = await validateBusiness(body.businessId);
  
  if (!business.userId) {
    throw httpError(400, "[INVALID_BUSINESS] Business profile is missing user ID");
  }
  
  // Defensive check: entrepreneurId should already be set by the service (auto-set for entrepreneurs, validated for admins)
  if (!body.entrepreneurId) {
    throw httpError(400, "[MISSING_ENTREPRENEUR_ID] Entrepreneur ID is required");
  }
  
  // fundingCurrency is required in the interface, but check defensively
  if (!body.fundingCurrency) {
    throw httpError(400, "[MISSING_FUNDING_CURRENCY] Funding currency is required");
  }
  
  await validateEntrepreneur(body.entrepreneurId, business.userId);
  validateFundingAmount(body.fundingAmount, loanProduct);
  validateRepaymentPeriod(body.repaymentPeriod, loanProduct);
  validateCurrency(body.fundingCurrency, loanProduct);

  return { user, loanProduct, business };
}
