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

/**
 * Map a loan application row with related data to detailed response format
 */
export function mapLoanApplicationDetail(
  row: LoanApplicationRow,
  related: {
    business: {
      id: string;
      name: string;
      description?: string | null;
      sector?: string | null;
      country?: string | null;
      city?: string | null;
      entityType?: string | null;
    };
    entrepreneur: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      phoneNumber?: string | null;
      imageUrl?: string | null;
    };
    loanProduct: {
      id: string;
      name: string;
      currency: string;
      minAmount: unknown;
      maxAmount: unknown;
    };
    creator: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    };
    lastUpdatedByUser?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    } | null;
    organizationName: string;
    activeVersion?: any | null;
  }
): LoanApplicationsModel.LoanApplicationDetail {
  // Build applicant name
  const applicantName = related.entrepreneur
    ? [related.entrepreneur.firstName, related.entrepreneur.lastName].filter(Boolean).join(" ") ||
      "N/A"
    : "N/A";

  // Build creator name
  const creatorName = related.creator
    ? [related.creator.firstName, related.creator.lastName].filter(Boolean).join(" ") || "N/A"
    : "N/A";

  // Use active version data if available, otherwise use base application data
  const version = related.activeVersion;

  return {
    id: row.id,
    loanId: row.loanId,
    businessId: row.businessId,
    entrepreneurId: row.entrepreneurId,
    loanProductId: row.loanProductId,
    fundingAmount: version ? (toNumber(version.fundingAmount) ?? 0) : (toNumber(row.fundingAmount) ?? 0),
    fundingCurrency: row.fundingCurrency,
    convertedAmount: row.convertedAmount ? (toNumber(row.convertedAmount) ?? undefined) : undefined,
    convertedCurrency: row.convertedCurrency ?? undefined,
    exchangeRate: row.exchangeRate ? (toNumber(row.exchangeRate) ?? undefined) : undefined,
    repaymentPeriod: version ? version.repaymentPeriod : row.repaymentPeriod,
    intendedUseOfFunds: row.intendedUseOfFunds,
    interestRate: version ? (toNumber(version.interestRate) ?? 0) : (toNumber(row.interestRate) ?? 0),
    loanSource: row.loanSource || "Unknown",
    status: row.status,
    submittedAt: row.submittedAt?.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
    rejectedAt: row.rejectedAt?.toISOString(),
    disbursedAt: row.disbursedAt?.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString(),
    rejectionReason: row.rejectionReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt?.toISOString(),
    createdBy: row.createdBy,
    lastUpdatedBy: row.lastUpdatedBy ?? undefined,
    // Convenience fields
    businessName: related.business.name,
    sector: related.business.sector ?? undefined,
    applicantName,
    organizationName: related.organizationName,
    creatorName,
    business: {
      id: related.business.id,
      name: related.business.name,
      description: related.business.description ?? undefined,
      sector: related.business.sector ?? undefined,
      country: related.business.country ?? undefined,
      city: related.business.city ?? undefined,
      entityType: related.business.entityType ?? undefined,
    },
    entrepreneur: {
      id: related.entrepreneur.id,
      firstName: related.entrepreneur.firstName ?? undefined,
      lastName: related.entrepreneur.lastName ?? undefined,
      email: related.entrepreneur.email,
      phoneNumber: related.entrepreneur.phoneNumber ?? undefined,
      imageUrl: related.entrepreneur.imageUrl ?? undefined,
    },
    loanProduct: {
      id: related.loanProduct.id,
      name: related.loanProduct.name,
      currency: related.loanProduct.currency,
      minAmount: toNumber(related.loanProduct.minAmount) ?? 0,
      maxAmount: toNumber(related.loanProduct.maxAmount) ?? 0,
    },
    creator: {
      id: related.creator.id,
      firstName: related.creator.firstName ?? undefined,
      lastName: related.creator.lastName ?? undefined,
      email: related.creator.email,
    },
    lastUpdatedByUser: related.lastUpdatedByUser
      ? {
          id: related.lastUpdatedByUser.id,
          firstName: related.lastUpdatedByUser.firstName ?? undefined,
          lastName: related.lastUpdatedByUser.lastName ?? undefined,
          email: related.lastUpdatedByUser.email,
        }
      : undefined,
    activeVersion: version
      ? {
          id: version.id,
          status: version.status,
          fundingAmount: toNumber(version.fundingAmount) ?? 0,
          repaymentPeriod: version.repaymentPeriod,
          returnType: version.returnType,
          interestRate: toNumber(version.interestRate) ?? 0,
          repaymentStructure: version.repaymentStructure,
          repaymentCycle: version.repaymentCycle,
          gracePeriod: version.gracePeriod ?? undefined,
          firstPaymentDate: version.firstPaymentDate?.toISOString(),
          customFees: version.customFees,
        }
      : undefined,
  };
}
