/** GHL lead → SyncBridge booking states (no production Jobber write until approved). */
export type BookingWorkflowState =
  | "received"
  | "matched_existing_jobber_customer"
  | "unmatched_needs_review"
  | "duplicate_conflict"
  | "pending_jobber_confirmation"
  | "admin_approved_local_only"
  | "admin_rejected"
  | "cancelled_local"
  | "confirm_blocked_gate";

export function transitionBookingState(
  current: BookingWorkflowState,
  event:
    | "lead_received"
    | "customer_matched"
    | "customer_ambiguous"
    | "admin_confirm"
    | "admin_confirm_visit"
    | "admin_decline"
): BookingWorkflowState {
  if (event === "admin_confirm_visit") return "confirm_blocked_gate";
  if (event === "admin_decline") return "admin_rejected";
  if (event === "lead_received") return "received";
  if (event === "customer_matched" && current === "received") {
    return "matched_existing_jobber_customer";
  }
  if (event === "customer_ambiguous") return "duplicate_conflict";
  if (event === "admin_confirm") {
    if (current === "matched_existing_jobber_customer" || current === "received") {
      return "pending_jobber_confirmation";
    }
  }
  return current;
}

export const BOOKING_CONFIRM_403_REASON =
  "confirmVisit and live Jobber appointment reservation require explicit production booking authorization and a proven Jobber availability API.";