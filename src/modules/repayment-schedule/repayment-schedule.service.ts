import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { loanApplications, loanApplicationVersions } from "../../db/schema";
import { logger } from "../../utils/logger";
import type { RepaymentScheduleModel } from "./repayment-schedule.model";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

/**
 * Helper to convert numeric database values to numbers
 */
function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Round to 2 decimal places
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Add months to a date, handling month-end edge cases
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  
  // Handle month-end edge cases (e.g., Jan 31 + 1 month = Feb 28/29)
  if (result.getDate() !== originalDay) {
    result.setDate(0); // Set to last day of previous month
  }
  
  return result;
}

/**
 * Calculate months between payments based on repayment cycle
 */
function getMonthsPerCycle(repaymentCycle: string): number {
  const monthsPerCycle: Record<string, number> = {
    daily: 1 / 30, // ~0.033 months
    weekly: 7 / 30, // ~0.233 months
    bi_weekly: 14 / 30, // ~0.467 months
    monthly: 1, // 1 month
    quarterly: 3, // 3 months
  };
  
  return monthsPerCycle[repaymentCycle] || 1;
}

/**
 * Calculate facility fee from custom fees
 */
function calculateFacilityFee(
  loanAmount: number,
  customFees: Array<{ name: string; amount: number; type: "flat" | "percentage" }> | null | undefined
): number {
  if (!customFees || customFees.length === 0) return 0;
  
  let facilityFee = 0;
  for (const fee of customFees) {
    if (fee.type === "flat") {
      facilityFee += fee.amount;
    } else if (fee.type === "percentage") {
      facilityFee += (loanAmount * fee.amount) / 100;
    }
  }
  
  return roundTo2Decimals(facilityFee);
}

/**
 * Repayment Schedule Service
 * Calculates repayment schedules for loan applications
 */
export abstract class RepaymentScheduleService {
  /**
   * Get repayment schedule for a loan application
   * Uses active version data if available, otherwise uses base loan application data
   */
  static async getRepaymentSchedule(
    loanApplicationId: string
  ): Promise<RepaymentScheduleModel.RepaymentScheduleResponse> {
    try {
      // Get loan application
      const application = await db.query.loanApplications.findFirst({
        where: and(eq(loanApplications.id, loanApplicationId), isNull(loanApplications.deletedAt)),
        columns: {
          id: true,
          fundingAmount: true,
          fundingCurrency: true,
          repaymentPeriod: true,
          interestRate: true,
          activeVersionId: true,
        },
      });

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Get active version if it exists
      let activeVersionData = null;
      if (application.activeVersionId) {
        activeVersionData = await db.query.loanApplicationVersions.findFirst({
          where: eq(loanApplicationVersions.id, application.activeVersionId),
        });
      }

      // Determine which data to use (active version or base)
      const loanAmount = activeVersionData
        ? toNumber(activeVersionData.fundingAmount) ?? 0
        : toNumber(application.fundingAmount) ?? 0;
      
      const interestRate = activeVersionData
        ? toNumber(activeVersionData.interestRate) ?? 0
        : toNumber(application.interestRate) ?? 0;
      
      const repaymentPeriod = activeVersionData
        ? activeVersionData.repaymentPeriod
        : application.repaymentPeriod;
      
      const returnType = activeVersionData?.returnType || "interest_based";
      const repaymentStructure = activeVersionData?.repaymentStructure || "principal_and_interest";
      const repaymentCycle = activeVersionData?.repaymentCycle || "monthly";
      // Grace period: check if it's stored in days or months
      // If gracePeriod > 100, assume it's in days and convert to months
      // Otherwise, assume it's already in months
      const gracePeriodRaw = activeVersionData?.gracePeriod ?? 0;
      let gracePeriod = gracePeriodRaw;
      
      // Convert days to months if needed (spec says grace period is in days in API)
      // If value > 100, likely in days (e.g., 60, 90, 270 days)
      // If value <= 12, likely already in months (e.g., 0, 1, 2, 3 months)
      if (gracePeriodRaw > 12) {
        // Convert days to months: divide by 30 and round
        gracePeriod = Math.round(gracePeriodRaw / 30);
      }
      
      const firstPaymentDate = activeVersionData?.firstPaymentDate
        ? new Date(activeVersionData.firstPaymentDate)
        : new Date(); // Default to today if not set
      
      const customFees = (activeVersionData?.customFees as any) || [];

      // Validate inputs
      if (loanAmount <= 0) {
        throw httpError(400, "[INVALID_LOAN_AMOUNT] Loan amount must be greater than 0");
      }
      if (repaymentPeriod <= 0) {
        throw httpError(400, "[INVALID_REPAYMENT_PERIOD] Repayment period must be greater than 0");
      }
      // Grace period validation (only applies to interest-based loans)
      // Revenue sharing loans don't use grace periods, so we allow any value (typically 0)
      if (returnType === "interest_based") {
        // Grace period must be less than repayment period (can be 0 to repaymentPeriod - 1)
        // For example, if repaymentPeriod is 9, gracePeriod can be 0-8
        if (gracePeriod < 0) {
          throw httpError(400, "[INVALID_GRACE_PERIOD] Grace period cannot be negative");
        }
        if (gracePeriod >= repaymentPeriod) {
          throw httpError(
            400,
            `[INVALID_GRACE_PERIOD] Grace period (${gracePeriod} months from ${gracePeriodRaw} ${gracePeriodRaw > 12 ? 'days' : 'months'}) must be less than repayment period (${repaymentPeriod} months). Maximum allowed: ${repaymentPeriod - 1} months.`
          );
        }
      } else {
        // For revenue sharing, grace period should typically be 0, but we'll allow any value
        // and just use 0 in calculations
        if (gracePeriod < 0) {
          throw httpError(400, "[INVALID_GRACE_PERIOD] Grace period cannot be negative");
        }
        // Reset to 0 for revenue sharing as it's not used
        if (gracePeriod > 0) {
          logger.warn(`[RepaymentSchedule] Grace period (${gracePeriod}) is not used for revenue sharing loans, ignoring`);
          gracePeriod = 0;
        }
      }

      // Calculate schedule
      const schedule = this.calculateSchedule({
        loanAmount,
        interestRate,
        repaymentPeriod,
        repaymentStructure,
        repaymentCycle,
        firstPaymentDate,
        gracePeriod,
        returnType,
      });

      // Calculate summary
      const totalPaymentDue = schedule.reduce((sum, row) => sum + row.paymentDue, 0);
      const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
      const totalPrincipal = schedule.reduce((sum, row) => sum + row.principal, 0);
      const facilityFee = calculateFacilityFee(loanAmount, customFees);

      // Calculate monthly payment
      const monthlyPayment = this.getMonthlyPayment(schedule, returnType, gracePeriod);

      const summary: RepaymentScheduleModel.RepaymentScheduleSummary = {
        totalPaymentDue: roundTo2Decimals(totalPaymentDue),
        totalInterest: roundTo2Decimals(totalInterest),
        totalPrincipal: roundTo2Decimals(totalPrincipal),
        monthlyPayment: roundTo2Decimals(monthlyPayment),
        facilityFee,
      };

      const loanSummary: RepaymentScheduleModel.LoanSummary = {
        loanAmount: roundTo2Decimals(loanAmount),
        currency: application.fundingCurrency,
        repaymentPeriod,
        interestRate,
        repaymentStructure,
        repaymentCycle,
        gracePeriod,
        firstPaymentDate: activeVersionData?.firstPaymentDate?.toISOString() || null,
        returnType,
      };

      return {
        schedule,
        summary,
        loanSummary,
      };
    } catch (error: any) {
      logger.error("Error calculating repayment schedule:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CALCULATE_REPAYMENT_SCHEDULE_ERROR] Failed to calculate repayment schedule");
    }
  }

  /**
   * Calculate the repayment schedule
   */
  private static calculateSchedule(params: {
    loanAmount: number;
    interestRate: number;
    repaymentPeriod: number;
    repaymentStructure: string;
    repaymentCycle: string;
    firstPaymentDate: Date;
    gracePeriod: number;
    returnType: string;
  }): RepaymentScheduleModel.PaymentScheduleRow[] {
    const {
      loanAmount,
      interestRate,
      repaymentPeriod,
      repaymentStructure,
      repaymentCycle,
      firstPaymentDate,
      gracePeriod,
      returnType,
    } = params;

    const schedule: RepaymentScheduleModel.PaymentScheduleRow[] = [];
    const cycleMonths = getMonthsPerCycle(repaymentCycle);

    if (returnType === "revenue_sharing") {
      // Revenue Sharing Model
      const totalRevenueShare = loanAmount * (interestRate / 100);
      const monthlyRevenueShare = totalRevenueShare / repaymentPeriod;

      for (let i = 1; i <= repaymentPeriod; i++) {
        const isLastPayment = i === repaymentPeriod;
        const dueDate = addMonths(firstPaymentDate, (i - 1) * cycleMonths);
        
        const capitalRedemption = isLastPayment ? loanAmount : 0;
        const paymentDue = roundTo2Decimals(monthlyRevenueShare + capitalRedemption);
        const outstandingBalance = isLastPayment ? 0 : loanAmount;

        schedule.push({
          paymentNo: i,
          dueDate: dueDate.toISOString(),
          paymentDue,
          interest: roundTo2Decimals(monthlyRevenueShare),
          principal: roundTo2Decimals(capitalRedemption),
          outstandingBalance: roundTo2Decimals(outstandingBalance),
        });
      }
    } else {
      // Interest-Based Model
      const monthlyInterestRate = interestRate / 100 / 12;
      const gracePeriodPayments = gracePeriod;
      const amortizationPayments = repaymentPeriod - gracePeriodPayments;

      // Calculate amortized payment if applicable
      let amortizedPayment = 0;
      if (
        amortizationPayments > 0 &&
        repaymentStructure === "principal_and_interest"
      ) {
        const numerator =
          monthlyInterestRate * Math.pow(1 + monthlyInterestRate, amortizationPayments);
        const denominator = Math.pow(1 + monthlyInterestRate, amortizationPayments) - 1;
        amortizedPayment = loanAmount * (numerator / denominator);
      }

      let outstandingBalance = loanAmount;

      for (let i = 1; i <= repaymentPeriod; i++) {
        const isGracePeriodPayment = i <= gracePeriodPayments;
        const isLastPayment = i === repaymentPeriod;
        const dueDate = addMonths(firstPaymentDate, (i - 1) * cycleMonths);

        let interestPayment = 0;
        let principalPayment = 0;
        let paymentDue = 0;

        if (isGracePeriodPayment) {
          // Grace period: Interest-only
          interestPayment = outstandingBalance * monthlyInterestRate;
          principalPayment = 0;
          paymentDue = interestPayment;
          // Balance remains unchanged
        } else if (repaymentStructure === "principal_and_interest") {
          // Amortized repayment
          interestPayment = outstandingBalance * monthlyInterestRate;
          principalPayment = amortizedPayment - interestPayment;
          paymentDue = amortizedPayment;
          outstandingBalance -= principalPayment;

          // Handle rounding on last payment
          if (isLastPayment) {
            outstandingBalance = 0;
            // Adjust payment to ensure balance is 0
            paymentDue = interestPayment + (loanAmount - schedule.reduce((sum, r) => sum + r.principal, 0));
          }
        } else {
          // Bullet repayment
          interestPayment = outstandingBalance * monthlyInterestRate;
          principalPayment = isLastPayment ? loanAmount : 0;
          paymentDue = isLastPayment ? loanAmount + interestPayment : interestPayment;

          if (isLastPayment) {
            outstandingBalance = 0;
          }
        }

        schedule.push({
          paymentNo: i,
          dueDate: dueDate.toISOString(),
          paymentDue: roundTo2Decimals(paymentDue),
          interest: roundTo2Decimals(interestPayment),
          principal: roundTo2Decimals(principalPayment),
          outstandingBalance: roundTo2Decimals(outstandingBalance),
        });
      }

      // Final adjustment for amortized loans to ensure balance is exactly 0
      if (repaymentStructure === "principal_and_interest" && schedule.length > 0) {
        const lastRow = schedule[schedule.length - 1];
        const totalPrincipalPaid = schedule.slice(0, -1).reduce((sum, r) => sum + r.principal, 0);
        const remainingPrincipal = loanAmount - totalPrincipalPaid;
        
        if (Math.abs(remainingPrincipal - lastRow.principal) > 0.01) {
          lastRow.principal = roundTo2Decimals(remainingPrincipal);
          lastRow.paymentDue = roundTo2Decimals(lastRow.interest + lastRow.principal);
          lastRow.outstandingBalance = 0;
        }
      }
    }

    return schedule;
  }

  /**
   * Get monthly payment amount
   */
  private static getMonthlyPayment(
    schedule: RepaymentScheduleModel.PaymentScheduleRow[],
    returnType: string,
    gracePeriod: number
  ): number {
    if (schedule.length === 0) return 0;

    if (returnType === "revenue_sharing") {
      // Revenue sharing: monthly payment is the revenue share
      return schedule[0].interest;
    } else {
      // Interest-based: find first non-grace period payment
      const firstAmortizedPayment = schedule.find((_row, index) => index >= gracePeriod);
      return firstAmortizedPayment ? firstAmortizedPayment.paymentDue : schedule[0].paymentDue;
    }
  }
}
