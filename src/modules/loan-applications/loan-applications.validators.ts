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
        eq(loanProducts.isActive, true),
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

  return business;
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
 */
export function validateRepaymentPeriod(
  repaymentPeriod: number,
  loanProduct: typeof loanProducts.$inferSelect
) {
  // Convert repayment period to match product's term unit if needed
  // API specifies repaymentPeriod in months, but product might use different unit
  let repaymentPeriodInProductUnit = repaymentPeriod;
  if (loanProduct.termUnit === "days") {
    repaymentPeriodInProductUnit = repaymentPeriod * 30; // Approximate
  } else if (loanProduct.termUnit === "weeks") {
    repaymentPeriodInProductUnit = repaymentPeriod * 4; // Approximate
  } else if (loanProduct.termUnit === "quarters") {
    repaymentPeriodInProductUnit = repaymentPeriod / 3;
  } else if (loanProduct.termUnit === "years") {
    repaymentPeriodInProductUnit = repaymentPeriod / 12;
  }

  if (
    repaymentPeriodInProductUnit < loanProduct.minTerm ||
    repaymentPeriodInProductUnit > loanProduct.maxTerm
  ) {
    throw httpError(
      400,
      `[INVALID_TERM] Repayment period must be between ${loanProduct.minTerm} and ${loanProduct.maxTerm} ${loanProduct.termUnit}`
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
 */
export async function validateLoanApplicationCreation(
  clerkId: string,
  body: LoanApplicationsModel.CreateLoanApplicationBody
) {
  const user = await validateUser(clerkId);
  const loanProduct = await validateLoanProduct(body.loanProductId);
  const business = await validateBusiness(body.businessId);
  await validateEntrepreneur(body.entrepreneurId, business.userId);
  validateFundingAmount(body.fundingAmount, loanProduct);
  validateRepaymentPeriod(body.repaymentPeriod, loanProduct);
  validateCurrency(body.fundingCurrency, loanProduct);

  return { user, loanProduct, business };
}
