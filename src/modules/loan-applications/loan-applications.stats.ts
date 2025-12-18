import { and, count, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "../../db";
import { loanApplications, loanProducts } from "../../db/schema";
import { toNumber } from "./loan-applications.mapper";
import type { LoanApplicationsModel } from "./loan-applications.model";
import {
  buildBaseWhereConditions,
  buildPreviousPeriodDateRange,
} from "./loan-applications.query-builder";

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number | undefined {
  if (previous === 0) {
    return current > 0 ? 100 : undefined; // 100% increase if going from 0 to positive, undefined if both 0
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Build statistics query with optional loan product join
 */
function buildStatsQuery(needsLoanProductJoin: boolean) {
  let statsQuery = db
    .select({
      totalApplications: count(),
      totalAmount: sql<number>`COALESCE(SUM(${loanApplications.fundingAmount}), 0)`,
      averageAmount: sql<number>`COALESCE(AVG(${loanApplications.fundingAmount}), 0)`,
      pendingApproval: sql<number>`COUNT(*) FILTER (WHERE ${loanApplications.status} IN ('kyc_kyb_verification', 'eligibility_check', 'credit_analysis', 'head_of_credit_review', 'internal_approval_ceo', 'committee_decision', 'sme_offer_approval', 'document_generation', 'signing_execution', 'awaiting_disbursement'))`,
      approved: sql<number>`COUNT(*) FILTER (WHERE ${loanApplications.status} = 'approved')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${loanApplications.status} = 'rejected')`,
      disbursed: sql<number>`COUNT(*) FILTER (WHERE ${loanApplications.status} = 'disbursed')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${loanApplications.status} = 'cancelled')`,
    })
    .from(loanApplications);

  if (needsLoanProductJoin) {
    statsQuery = statsQuery.leftJoin(
      loanProducts,
      eq(loanApplications.loanProductId, loanProducts.id)
    ) as any;
  }

  return statsQuery;
}

/**
 * Get current period statistics
 */
export async function getCurrentPeriodStats(
  query: LoanApplicationsModel.LoanApplicationStatsQuery
) {
  const whereConditions = buildBaseWhereConditions(query);
  const needsLoanProductJoin = !!query.loanProduct;

  if (query.loanProduct) {
    whereConditions.push(eq(loanProducts.name, query.loanProduct));
  }

  const statsQuery = buildStatsQuery(needsLoanProductJoin);
  const [stats] = await statsQuery.where(and(...whereConditions));

  return stats;
}

/**
 * Get previous period statistics for comparison
 */
export async function getPreviousPeriodStats(
  query: LoanApplicationsModel.LoanApplicationStatsQuery
) {
  const previousPeriodWhereConditions = [isNull(loanApplications.deletedAt)];
  const { startDate, endDate } = buildPreviousPeriodDateRange(query);

  previousPeriodWhereConditions.push(gte(loanApplications.createdAt, startDate));
  previousPeriodWhereConditions.push(lte(loanApplications.createdAt, endDate));

  // Apply same filters to previous period
  if (query.status) {
    previousPeriodWhereConditions.push(eq(loanApplications.status, query.status));
  }
  if (query.loanSource) {
    previousPeriodWhereConditions.push(eq(loanApplications.loanSource, query.loanSource));
  }

  const needsLoanProductJoin = !!query.loanProduct;
  if (query.loanProduct) {
    previousPeriodWhereConditions.push(eq(loanProducts.name, query.loanProduct));
  }

  const previousStatsQuery = buildStatsQuery(needsLoanProductJoin);
  const [previousStats] = await previousStatsQuery.where(and(...previousPeriodWhereConditions));

  return previousStats;
}

/**
 * Calculate all statistics with percentage changes
 */
export async function calculateStatsWithChanges(
  query: LoanApplicationsModel.LoanApplicationStatsQuery
): Promise<LoanApplicationsModel.LoanApplicationStatsResponse> {
  const [stats, previousStats] = await Promise.all([
    getCurrentPeriodStats(query),
    getPreviousPeriodStats(query),
  ]);

  const currentTotal = Number(stats.totalApplications);
  const previousTotal = Number(previousStats.totalApplications);
  const currentAmount = toNumber(stats.totalAmount) ?? 0;
  const previousAmount = toNumber(previousStats.totalAmount) ?? 0;
  const currentPending = Number(stats.pendingApproval);
  const previousPending = Number(previousStats.pendingApproval);
  const currentApproved = Number(stats.approved);
  const previousApproved = Number(previousStats.approved);
  const currentRejected = Number(stats.rejected);
  const previousRejected = Number(previousStats.rejected);
  const currentDisbursed = Number(stats.disbursed);
  const previousDisbursed = Number(previousStats.disbursed);
  const currentCancelled = Number(stats.cancelled);
  const previousCancelled = Number(previousStats.cancelled);

  return {
    totalApplications: currentTotal,
    totalAmount: currentAmount,
    averageAmount: toNumber(stats.averageAmount) ?? 0,
    pendingApproval: currentPending,
    approved: currentApproved,
    rejected: currentRejected,
    disbursed: currentDisbursed,
    cancelled: currentCancelled,
    totalApplicationsChange: calculatePercentageChange(currentTotal, previousTotal),
    totalAmountChange: calculatePercentageChange(currentAmount, previousAmount),
    pendingApprovalChange: calculatePercentageChange(currentPending, previousPending),
    approvedChange: calculatePercentageChange(currentApproved, previousApproved),
    rejectedChange: calculatePercentageChange(currentRejected, previousRejected),
    disbursedChange: calculatePercentageChange(currentDisbursed, previousDisbursed),
    cancelledChange: calculatePercentageChange(currentCancelled, previousCancelled),
  };
}
