export type FinanceReadinessRow = {
  id: string;
  kind: "quote" | "invoice";
  jobberId: string;
  status: string | null;
  customerResolvable: boolean;
  ghlSyncEnabled: boolean;
  ghlReference: string | null;
  issues: string[];
};

export function assessFinanceReadiness(input: {
  id: string;
  kind: "quote" | "invoice";
  jobberId: string;
  status?: string | null;
  clientId?: string | null;
  ghlSyncEnabled: boolean;
  ghlReference?: string | null;
}): FinanceReadinessRow {
  const issues: string[] = [];
  if (!input.clientId) issues.push("jobber_customer_unresolved");
  if (input.kind === "invoice" && input.status && /paid/i.test(input.status)) {
    issues.push("distinguish_paid_from_invoiced_required");
  }
  if (input.ghlSyncEnabled) issues.push("ghl_write_flag_on_requires_gate");
  return {
    id: input.id,
    kind: input.kind,
    jobberId: input.jobberId,
    status: input.status ?? null,
    customerResolvable: Boolean(input.clientId),
    ghlSyncEnabled: input.ghlSyncEnabled,
    ghlReference: input.ghlReference ?? null,
    issues,
  };
}