/**
 * Status Mapping Utility for Loan Applications
 *
 * Masks internal status values from SME/entrepreneur-facing endpoints
 * by mapping them to generic public statuses.
 */

import type { LoanApplicationStatus } from "../../db/schema";

/**
 * Public status values exposed to entrepreneurs
 */
export type PublicLoanApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disbursed"
  | "cancelled";

/**
 * Maps internal loan application status to public status for SME-facing endpoints
 *
 * Internal statuses that are masked:
 * - kyc_kyb_verification
 * - eligibility_check
 * - credit_analysis
 * - head_of_credit_review
 * - internal_approval_ceo
 * - committee_decision
 * - sme_offer_approval
 * - document_generation
 * - signing_execution
 * - awaiting_disbursement
 *
 * All of the above map to "pending" for entrepreneurs.
 *
 * @param internalStatus - The internal status from the database
 * @returns Public status value that can be safely exposed to entrepreneurs
 */
export function mapStatusForEntrepreneur(
  internalStatus: LoanApplicationStatus | string
): PublicLoanApplicationStatus {
  // All pending/in-progress statuses map to "pending"
  const pendingStatuses: LoanApplicationStatus[] = [
    "kyc_kyb_verification",
    "eligibility_check",
    "credit_analysis",
    "head_of_credit_review",
    "internal_approval_ceo",
    "committee_decision",
    "sme_offer_approval",
    "document_generation",
    "signing_execution",
    "awaiting_disbursement",
  ];

  if (pendingStatuses.includes(internalStatus as LoanApplicationStatus)) {
    return "pending";
  }

  // Terminal states are exposed as-is
  if (internalStatus === "approved") return "approved";
  if (internalStatus === "rejected") return "rejected";
  if (internalStatus === "disbursed") return "disbursed";
  if (internalStatus === "cancelled") return "cancelled";

  // Default fallback to pending for any unknown status
  return "pending";
}

/**
 * Maps public status back to internal statuses for filtering queries
 * Used when entrepreneurs filter by status in list endpoints
 *
 * @param publicStatus - The public status value
 * @returns Array of internal statuses that map to this public status
 */
export function mapPublicStatusToInternalStatuses(
  publicStatus: PublicLoanApplicationStatus
): LoanApplicationStatus[] {
  const statusMap: Record<PublicLoanApplicationStatus, LoanApplicationStatus[]> = {
    pending: [
      "kyc_kyb_verification",
      "eligibility_check",
      "credit_analysis",
      "head_of_credit_review",
      "internal_approval_ceo",
      "committee_decision",
      "sme_offer_approval",
      "document_generation",
      "signing_execution",
      "awaiting_disbursement",
    ],
    approved: ["approved"],
    rejected: ["rejected"],
    disbursed: ["disbursed"],
    cancelled: ["cancelled"],
  };

  return statusMap[publicStatus] || [];
}
