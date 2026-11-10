/**
 * GHL-only customer edit reconciliation (decision §9).
 * Jobber remains source of truth; no sync loops.
 */
export type CustomerEditOutcome =
  | { status: "applied"; jobberClientId: string }
  | { status: "retry"; reason: string }
  | { status: "conflict"; reason: string };

export async function reconcileGhlCustomerEdit(_input: {
  ghlContactId: string;
  proposedFields: Record<string, string>;
  writesEnabled: boolean;
}): Promise<CustomerEditOutcome> {
  if (!_input.writesEnabled) {
    return { status: "retry", reason: "production_writes gate disabled — queued" };
  }
  return { status: "conflict", reason: "Live Jobber adapter not connected" };
}
