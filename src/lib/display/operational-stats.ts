import type { CustomerRowView, FinanceRowView, JobRowView } from "@/lib/display/enrich";
import type { ProcessOutcome } from "@/lib/display/process-outcome";

export function operationalStats(input: {
  customers: CustomerRowView[];
  jobs: JobRowView[];
  quotes: FinanceRowView[];
  invoices: FinanceRowView[];
  events: { outcome: ProcessOutcome }[];
  openConflicts: number;
  quarantined: number;
  windowLabel: string;
}) {
  const verified = input.customers.filter((c) => c.relationshipStatus === "verified").length;
  const unverified = input.customers.length - verified;
  const withOpp = input.jobs.filter((j) => j.opportunityLinkStatus === "linked").length;
  const withoutOpp = input.jobs.length - withOpp;
  const missingCustomerLink = input.jobs.filter((j) => j.customerLinkStatus !== "verified").length;
  const active = input.jobs.filter((j) => j.active).length;
  const writes = input.events.filter((e) => e.outcome === "provider_write").length;
  const noops = input.events.filter(
    (e) => e.outcome === "no_change" || e.outcome === "local_state_only"
  ).length;
  const suppressed = input.events.filter((e) => e.outcome === "suppressed_feature").length;
  const failures = input.events.filter(
    (e) => e.outcome === "failed" || e.outcome === "dead_letter" || e.outcome === "retrying"
  ).length;
  const financeResolved = [...input.quotes, ...input.invoices].filter(
    (r) => r.customerResolution === "verified_link" || r.customerResolution === "jobber_customer"
  ).length;
  return {
    windowLabel: input.windowLabel,
    verified,
    unverified,
    jobs: input.jobs.length,
    withOpp,
    withoutOpp,
    missingCustomerLink,
    active,
    archived: input.jobs.length - active,
    writes,
    noops,
    suppressed,
    failures,
    openConflicts: input.openConflicts,
    quarantined: input.quarantined,
    financeResolved,
    quotes: input.quotes.length,
    invoices: input.invoices.length,
  };
}
