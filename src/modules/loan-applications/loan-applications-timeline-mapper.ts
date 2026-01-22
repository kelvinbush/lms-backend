/**
 * Timeline Event Mapping Utility for Loan Applications
 *
 * Masks internal workflow events from SME/entrepreneur-facing timeline endpoints
 * by filtering out internal events and mapping others to generic public events.
 */

import type { LoanApplicationAuditEventType } from "../../db/schema";

/**
 * Public timeline event types exposed to entrepreneurs
 */
export type PublicTimelineEventType =
  | "submitted"
  | "cancelled"
  | "review_in_progress"  // Generic "under review" - masks specific workflow stages
  | "rejected"
  | "approved"
  | "awaiting_disbursement"
  | "disbursed";

/**
 * Internal event types that should be hidden from entrepreneurs
 * These are internal workflow completion events that reveal too much detail
 */
const HIDDEN_EVENT_TYPES: LoanApplicationAuditEventType[] = [
  "document_verified_approved",
  "document_verified_rejected",
  "kyc_kyb_completed",
  "eligibility_assessment_completed",
  "credit_assessment_completed",
  "head_of_credit_review_completed",
  "internal_approval_ceo_completed",
  "counter_offer_proposed",
  "status_changed", // Generic status changes (too vague, use specific events instead)
];

/**
 * Event types that should be mapped to "review_in_progress" for entrepreneurs
 * These are internal workflow events that should appear as generic "under review"
 */
const REVIEW_IN_PROGRESS_EVENT_TYPES: LoanApplicationAuditEventType[] = [
  "kyc_kyb_completed",
  "eligibility_assessment_completed",
  "credit_assessment_completed",
  "head_of_credit_review_completed",
  "internal_approval_ceo_completed",
];

/**
 * Check if an event type should be hidden from entrepreneurs
 *
 * @param eventType - The audit event type
 * @returns true if the event should be hidden, false otherwise
 */
export function shouldHideEventFromEntrepreneur(
  eventType: LoanApplicationAuditEventType
): boolean {
  return HIDDEN_EVENT_TYPES.includes(eventType);
}

/**
 * Map internal audit event type to public timeline event type for entrepreneurs
 *
 * @param eventType - The internal audit event type
 * @returns Public timeline event type, or null if event should be hidden
 */
export function mapEventTypeForEntrepreneur(
  eventType: LoanApplicationAuditEventType
): PublicTimelineEventType | null {
  // Hide internal workflow events
  if (shouldHideEventFromEntrepreneur(eventType)) {
    return null; // Event should be filtered out
  }

  // Map internal workflow completion events to generic "review_in_progress"
  if (REVIEW_IN_PROGRESS_EVENT_TYPES.includes(eventType)) {
    return "review_in_progress";
  }

  // Public event types that are exposed as-is
  const publicEventTypes: PublicTimelineEventType[] = [
    "submitted",
    "cancelled",
    "review_in_progress",
    "rejected",
    "approved",
    "awaiting_disbursement",
    "disbursed",
  ];

  if (publicEventTypes.includes(eventType as PublicTimelineEventType)) {
    return eventType as PublicTimelineEventType;
  }

  // Contract events: map to appropriate public event types
  // Contract events are important milestones but should be shown generically
  if (eventType === "contract_fully_signed") {
    // When contract is fully signed, it moves to awaiting_disbursement
    return "awaiting_disbursement";
  }
  if (
    eventType === "contract_uploaded" ||
    eventType === "contract_sent_for_signing" ||
    eventType === "contract_signer_opened" ||
    eventType === "contract_signed_by_signer"
  ) {
    // Contract signing in progress - show as review_in_progress
    return "review_in_progress";
  }
  if (eventType === "contract_voided" || eventType === "contract_expired") {
    // Contract issues - show as review_in_progress (or could be cancelled, but review_in_progress is safer)
    return "review_in_progress";
  }

  // Default: hide unknown event types
  return null;
}

/**
 * Map event title for entrepreneurs
 * Provides generic titles that don't reveal internal workflow details
 *
 * @param eventType - The public event type
 * @param originalTitle - The original event title (for reference)
 * @returns Generic title suitable for entrepreneurs
 */
export function mapEventTitleForEntrepreneur(
  eventType: PublicTimelineEventType,
  originalTitle?: string
): string {
  const titleMap: Record<PublicTimelineEventType, string> = {
    submitted: "Loan application submitted",
    cancelled: "Loan application cancelled",
    review_in_progress: "Application under review",
    rejected: "Loan application rejected",
    approved: "Loan application approved",
    awaiting_disbursement: "Awaiting disbursement",
    disbursed: "Loan disbursed",
  };

  return titleMap[eventType] || originalTitle || "Status updated";
}
