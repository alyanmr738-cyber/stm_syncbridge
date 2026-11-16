export type ReviewEligibility = "eligible" | "suppressed" | "duplicate";

export function reviewEligibilityForJob(opts: {
  gateMessagingOn: boolean;
  existingLedgerStatus?: string | null;
  jobClosed: boolean;
}): { status: ReviewEligibility; reason: string } {
  if (!opts.jobClosed) {
    return { status: "suppressed", reason: "job_not_authoritatively_closed" };
  }
  if (!opts.gateMessagingOn) {
    return { status: "suppressed", reason: "gate_c_off" };
  }
  if (opts.existingLedgerStatus === "eligible" || opts.existingLedgerStatus === "delivered") {
    return { status: "duplicate", reason: "ledger_already_has_entry" };
  }
  return { status: "eligible", reason: "ready_when_gate_c_on" };
}