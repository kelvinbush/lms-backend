import type { loanApplications } from "../../db/schema";
import type { LoanApplicationsModel } from "./loan-applications.model";

type LoanApplicationRow = typeof loanApplications.$inferSelect;

/**
 * Convert database numeric value to number
 */
export function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Generate a unique loan ID in the format "LN-XXXXX"
 * Format: LN- followed by 5 digits
 */
export function generateLoanId(): string {
  // Generate a random 5-digit number
  const randomNum = Math.floor(Math.random() * 90000) + 10000; // 10000-99999
  return `LN-${randomNum}`;
}

/**
 * Map a loan application database row to the API response format
 */
export function mapLoanApplicationRow(
  row: LoanApplicationRow,
  related?: {
    business?: {
      name: string;
    } | null;
    entrepreneur?: {
      firstName: string | null;
      lastName: string | null;
      email: string;
      phoneNumber: string | null;
      imageUrl: string | null;
    } | null;
    loanProduct?: {
      name: string;
    } | null;
    creator?: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  }
): LoanApplicationsModel.LoanApplication {
  const entrepreneur = related?.entrepreneur;
  const business = related?.business;
  const loanProduct = related?.loanProduct;
  const creator = related?.creator;

  // Build applicant name
  const applicantName = entrepreneur
    ? [entrepreneur.firstName, entrepreneur.lastName].filter(Boolean).join(" ") || "N/A"
    : "N/A";

  // Build creator name
  const creatorName = creator
    ? [creator.firstName, creator.lastName].filter(Boolean).join(" ") || "N/A"
    : "N/A";

  return {
    id: row.id,
    loanId: row.loanId,
    loanSource: row.loanSource || "Unknown",
    businessName: business?.name || "Unknown Business",
    entrepreneurId: row.entrepreneurId,
    businessId: row.businessId,
    applicant: {
      name: applicantName,
      email: entrepreneur?.email || "N/A",
      phone: entrepreneur?.phoneNumber || "N/A",
      avatar: entrepreneur?.imageUrl || undefined,
    },
    loanProduct: loanProduct?.name || "Unknown Product",
    loanProductId: row.loanProductId,
    loanRequested: toNumber(row.fundingAmount) ?? 0,
    loanCurrency: row.fundingCurrency,
    loanTenure: row.repaymentPeriod,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    createdBy: creatorName,
    lastUpdated: row.lastUpdatedAt?.toISOString() || row.updatedAt.toISOString(),
  };
}

/**
 * Map a loan application row to create response format
 */
export function mapCreateLoanApplicationResponse(
  row: LoanApplicationRow
): LoanApplicationsModel.CreateLoanApplicationResponse {
  return {
    id: row.id,
    loanId: row.loanId,
    businessId: row.businessId,
    entrepreneurId: row.entrepreneurId,
    loanProductId: row.loanProductId,
    fundingAmount: toNumber(row.fundingAmount) ?? 0,
    fundingCurrency: row.fundingCurrency,
    convertedAmount: row.convertedAmount ? (toNumber(row.convertedAmount) ?? undefined) : undefined,
    convertedCurrency: row.convertedCurrency ?? undefined,
    exchangeRate: row.exchangeRate ? (toNumber(row.exchangeRate) ?? undefined) : undefined,
    repaymentPeriod: row.repaymentPeriod,
    intendedUseOfFunds: row.intendedUseOfFunds,
    interestRate: toNumber(row.interestRate) ?? 0,
    loanSource: row.loanSource || "Unknown",
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}
