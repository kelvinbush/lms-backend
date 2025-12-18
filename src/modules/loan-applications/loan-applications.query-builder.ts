import { type SQL, eq, gte, isNull, like, lte, or } from "drizzle-orm";
import { businessProfiles, loanApplications, loanProducts } from "../../db/schema";
import type { LoanApplicationsModel } from "./loan-applications.model";

/**
 * Build date range filters based on applicationDate parameter
 */
export function buildDateRangeFilters(
  applicationDate?: string
): { startDate: Date; endDate: Date } | null {
  if (!applicationDate) return null;

  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (applicationDate) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case "this_week": {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "this_year":
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      break;
    default:
      startDate = new Date(0);
  }

  return { startDate, endDate };
}

/**
 * Build previous period date range for comparison
 */
export function buildPreviousPeriodDateRange(
  query: LoanApplicationsModel.LoanApplicationStatsQuery
): { startDate: Date; endDate: Date } {
  const now = new Date();
  let previousStartDate: Date;
  let previousEndDate: Date;

  if (query.applicationDate) {
    switch (query.applicationDate) {
      case "today":
        // Previous day
        previousStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        previousEndDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          23,
          59,
          59
        );
        break;
      case "this_week": {
        // Previous week
        const dayOfWeek = now.getDay();
        previousEndDate = new Date(now);
        previousEndDate.setDate(now.getDate() - dayOfWeek - 1);
        previousEndDate.setHours(23, 59, 59, 999);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setDate(previousEndDate.getDate() - 6);
        previousStartDate.setHours(0, 0, 0, 0);
        break;
      }
      case "this_month":
        // Previous month
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case "last_month":
        // Month before last month
        previousStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
        break;
      case "this_year":
        // Previous year
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
        previousEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        break;
      default:
        previousStartDate = new Date(0);
        previousEndDate = new Date(0);
    }
  } else if (query.createdAtFrom && query.createdAtTo) {
    // Custom date range - calculate previous equivalent period
    const fromDate = new Date(`${query.createdAtFrom}T00:00:00Z`);
    const toDate = new Date(`${query.createdAtTo}T23:59:59Z`);
    const periodDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    previousEndDate = new Date(fromDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
  } else {
    // Default: compare this month vs last month
    previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  return { startDate: previousStartDate, endDate: previousEndDate };
}

/**
 * Build base where conditions for loan applications queries
 */
export function buildBaseWhereConditions(
  query:
    | LoanApplicationsModel.ListLoanApplicationsQuery
    | LoanApplicationsModel.LoanApplicationStatsQuery
): SQL[] {
  const whereConditions: SQL[] = [isNull(loanApplications.deletedAt)];

  // Status filter
  if (query.status) {
    whereConditions.push(eq(loanApplications.status, query.status));
  }

  // Loan source filter
  if (query.loanSource) {
    whereConditions.push(eq(loanApplications.loanSource, query.loanSource));
  }

  // Date filters
  const dateRange = buildDateRangeFilters(query.applicationDate);
  if (dateRange) {
    whereConditions.push(gte(loanApplications.createdAt, dateRange.startDate));
    whereConditions.push(lte(loanApplications.createdAt, dateRange.endDate));
  }

  // Custom date range
  if (query.createdAtFrom) {
    const fromDate = new Date(`${query.createdAtFrom}T00:00:00Z`);
    whereConditions.push(gte(loanApplications.createdAt, fromDate));
  }
  if (query.createdAtTo) {
    const toDate = new Date(`${query.createdAtTo}T23:59:59Z`);
    whereConditions.push(lte(loanApplications.createdAt, toDate));
  }

  return whereConditions;
}

/**
 * Build search conditions for loan applications
 */
export function buildSearchConditions(
  query: LoanApplicationsModel.ListLoanApplicationsQuery,
  baseConditions: SQL[]
): {
  whereConditions: SQL[];
  needsLoanProductJoin: boolean;
  needsBusinessJoin: boolean;
} {
  const whereConditions = [...baseConditions];
  const needsLoanProductJoin = !!query.loanProduct || !!(query.search && query.search.length > 0);
  const needsBusinessJoin = !!(query.search && query.search.length > 0);

  // Loan product filter
  if (query.loanProduct) {
    whereConditions.push(eq(loanProducts.name, query.loanProduct));
  }

  // Search conditions
  if (query.search) {
    const searchTerm = `%${query.search}%`;
    const searchOrConditions: any[] = [
      like(loanApplications.loanId, searchTerm),
      like(loanApplications.loanSource, searchTerm),
    ];
    if (needsBusinessJoin) {
      searchOrConditions.push(like(businessProfiles.name, searchTerm));
    }
    if (needsLoanProductJoin) {
      searchOrConditions.push(like(loanProducts.name, searchTerm));
    }
    whereConditions.push(or(...searchOrConditions)!);
  }

  return {
    whereConditions,
    needsLoanProductJoin,
    needsBusinessJoin,
  };
}
