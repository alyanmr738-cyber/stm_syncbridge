import {
  displayName,
  formatJobStatus,
  ghlSyncLabel,
  maskEmail,
  maskPhone,
  namesDiffer,
  parseRevisionBlob,
} from "@/lib/display/format";
import {
  hydrateLabels,
  labelOf,
  type LabelKey,
} from "@/lib/display/entity-labels";
import {
  classifyProcessOutcome,
  formatAdminTimestamp,
  outcomeLabel,
  providerWriteOccurred,
  type ProcessOutcome,
} from "@/lib/display/process-outcome";
import { isOperationalJobStatus } from "@/lib/sync/job-opp-candidates";

export type CustomerRowView = {
  id: string;
  jobberClientId: string | null;
  ghlContactId: string | null;
  verified: boolean;
  matchMethod: string;
  relationshipStatus: "verified" | "pending" | "rejected" | "conflicted";
  jobberName: string;
  ghlName: string;
  namesDiffer: boolean;
  maskedEmail: string | null;
  maskedPhone: string | null;
  lastSyncedAt: string | null;
  lastSyncedLabel: string;
  jobCount: number;
  lastProviderWrite: string;
  lastAttempt: string;
  blocker: string | null;
};

export type JobRowView = {
  id: string;
  jobberJobId: string | null;
  ghlOpportunityId: string | null;
  customerLinkId: string | null;
  jobberClientId: string | null;
  jobberTitle: string;
  jobNumber: string | null;
  jobberCustomerName: string;
  jobberCustomerSource: "jobber_job" | "verified_link" | "unresolved";
  customerLinkStatus: "verified" | "unverified" | "none";
  opportunityTitle: string;
  opportunityLinkStatus: "linked" | "none";
  statusLabel: string;
  missingOpportunity: boolean;
  lastJobStatus: string | null;
  active: boolean;
  lastSyncedAt: string | null;
  blocker: string | null;
  nextAction: string;
};

export type FinanceRowView = {
  id: string;
  providerId: string | null;
  title: string;
  customerName: string;
  customerLinkId: string | null;
  customerResolution:
    | "verified_link"
    | "jobber_customer"
    | "not_available_locally"
    | "lookup_failed"
    | "jobber_unresolved";
  statusLabel: string;
  ghlSync: string;
};

function keysForCustomers(
  rows: {
    jobber_client_id?: string | null;
    ghl_contact_id?: string | null;
  }[]
): LabelKey[] {
  const keys: LabelKey[] = [];
  for (const r of rows) {
    if (r.jobber_client_id) {
      keys.push({ provider: "jobber", entity_type: "client", entity_id: r.jobber_client_id });
    }
    if (r.ghl_contact_id) {
      keys.push({ provider: "ghl", entity_type: "contact", entity_id: r.ghl_contact_id });
    }
  }
  return keys;
}

export async function enrichCustomers(
  rows: {
    id: string;
    jobber_client_id?: string | null;
    ghl_contact_id?: string | null;
    verified?: boolean;
    match_method?: string;
    last_jobber_revision?: string | null;
    last_ghl_revision?: string | null;
    last_synced_at?: string | null;
  }[],
  extras?: {
    jobCounts?: Map<string, number>;
    conflictedIds?: Set<string>;
    lastAttempts?: Map<string, string>;
  }
): Promise<CustomerRowView[]> {
  const labels = await hydrateLabels(keysForCustomers(rows));
  return rows.map((r) => {
    const jobberLbl = labelOf(labels, "jobber", "client", r.jobber_client_id);
    const ghlLbl = labelOf(labels, "ghl", "contact", r.ghl_contact_id);
    const fromJobberRev = parseRevisionBlob(r.last_jobber_revision);
    const fromGhlRev = parseRevisionBlob(r.last_ghl_revision);
    const jobberName = displayName(
      [jobberLbl?.title || fromJobberRev.name],
      r.jobber_client_id ? "Jobber name not available locally" : "No Jobber customer"
    );
    const ghlName = displayName(
      [ghlLbl?.title || fromGhlRev.name],
      r.ghl_contact_id ? "GHL name not available locally" : "No GHL contact"
    );
    const email =
      (jobberLbl?.extra.email as string | undefined) ||
      (ghlLbl?.extra.email as string | undefined) ||
      fromJobberRev.email ||
      fromGhlRev.email;
    const phone =
      (jobberLbl?.extra.phone as string | undefined) ||
      (ghlLbl?.extra.phone as string | undefined) ||
      fromJobberRev.phone ||
      fromGhlRev.phone;
    const rejected = /reject/i.test(r.match_method ?? "");
    const conflicted = extras?.conflictedIds?.has(r.id) === true;
    const relationshipStatus: CustomerRowView["relationshipStatus"] = conflicted
      ? "conflicted"
      : rejected
        ? "rejected"
        : r.verified
          ? "verified"
          : "pending";
    const lastAttempt = extras?.lastAttempts?.get(r.jobber_client_id ?? "") ??
      extras?.lastAttempts?.get(r.ghl_contact_id ?? "") ??
      r.last_synced_at ??
      null;
    return {
      id: r.id,
      jobberClientId: r.jobber_client_id ?? null,
      ghlContactId: r.ghl_contact_id ?? null,
      verified: r.verified === true,
      matchMethod: r.match_method ?? "pending",
      relationshipStatus,
      jobberName,
      ghlName,
      namesDiffer: namesDiffer(jobberName, ghlName),
      maskedEmail: maskEmail(email),
      maskedPhone: maskPhone(phone),
      lastSyncedAt: r.last_synced_at ?? null,
      lastSyncedLabel: r.last_synced_at
        ? `Last local link update ${formatAdminTimestamp(r.last_synced_at)} (not proof of a provider write)`
        : "No local link update recorded",
      jobCount: extras?.jobCounts?.get(r.id) ?? 0,
      lastProviderWrite: "Write outcome not recorded unless a later event says so",
      lastAttempt: lastAttempt ? formatAdminTimestamp(lastAttempt) : "—",
      blocker:
        relationshipStatus === "pending"
          ? "Unverified identity — GHL writes are blocked"
          : relationshipStatus === "conflicted"
            ? "Open identity conflict"
            : null,
    };
  });
}

export async function enrichJobs(
  rows: {
    id: string;
    jobber_job_id?: string | null;
    ghl_opportunity_id?: string | null;
    customer_link_id?: string | null;
    last_job_status?: string | null;
    last_synced_at?: string | null;
  }[],
  customers: CustomerRowView[]
): Promise<JobRowView[]> {
  const keys: LabelKey[] = [];
  for (const r of rows) {
    if (r.jobber_job_id) keys.push({ provider: "jobber", entity_type: "job", entity_id: r.jobber_job_id });
    if (r.ghl_opportunity_id) {
      keys.push({ provider: "ghl", entity_type: "opportunity", entity_id: r.ghl_opportunity_id });
    }
  }
  const labels = await hydrateLabels(keys);
  const nestedClientIds = [
    ...new Set(
      [...labels.values()]
        .map((l) => String(l.extra.clientId ?? ""))
        .filter((id) => id.startsWith("Z2lkOi8v"))
    ),
  ];
  const clientLabels = await hydrateLabels(
    nestedClientIds.map((entity_id) => ({
      provider: "jobber" as const,
      entity_type: "client" as const,
      entity_id,
    }))
  );
  for (const [k, v] of clientLabels) labels.set(k, v);

  const byLink = new Map(customers.map((c) => [c.id, c]));
  const byJobberClient = new Map(customers.map((c) => [c.jobberClientId, c]));
  return rows.map((r) => {
    const job = labelOf(labels, "jobber", "job", r.jobber_job_id);
    const opp = labelOf(labels, "ghl", "opportunity", r.ghl_opportunity_id);
    const jobberClientId = (job?.extra.clientId as string | undefined) ?? null;
    const linked = r.customer_link_id ? byLink.get(r.customer_link_id) : undefined;
    const mapped = jobberClientId ? byJobberClient.get(jobberClientId) : undefined;
    const verifiedLink = linked?.verified ? linked : mapped?.verified ? mapped : undefined;
    const clientNameFromJob =
      (job?.extra.clientName as string | undefined) ||
      labelOf(labels, "jobber", "client", jobberClientId)?.title ||
      "";
    let jobberCustomerName = "Jobber customer unresolved";
    let jobberCustomerSource: JobRowView["jobberCustomerSource"] = "unresolved";
    if (clientNameFromJob) {
      jobberCustomerName = clientNameFromJob;
      jobberCustomerSource = "jobber_job";
    } else if (verifiedLink?.jobberName) {
      jobberCustomerName = verifiedLink.jobberName;
      jobberCustomerSource = "verified_link";
    } else if (job?.lookup_ok === false) {
      jobberCustomerName = "Provider lookup failed";
    }
    const customerLinkStatus: JobRowView["customerLinkStatus"] = verifiedLink
      ? "verified"
      : mapped || linked
        ? "unverified"
        : "none";
    const jobNumber = (job?.extra.jobNumber as string | undefined) ?? null;
    const jobberTitle = displayName(
      [job?.title, jobNumber ? `Job ${jobNumber}` : null],
      "Job title not available locally"
    );
    let blocker: string | null = null;
    let nextAction = "No action required for display";
    if (customerLinkStatus !== "verified") {
      blocker = "No verified SyncBridge customer mapping";
      nextAction = "Review matching; do not auto-link";
    } else if (!r.ghl_opportunity_id) {
      blocker = "Verified customer exists, but this job has no GHL opportunity link";
      nextAction = "Wait for approved job-link batch — do not auto-create opportunities";
    }
    return {
      id: r.id,
      jobberJobId: r.jobber_job_id ?? null,
      ghlOpportunityId: r.ghl_opportunity_id ?? null,
      customerLinkId: verifiedLink?.id ?? r.customer_link_id ?? null,
      jobberClientId,
      jobberTitle,
      jobNumber,
      jobberCustomerName,
      jobberCustomerSource,
      customerLinkStatus,
      opportunityTitle: r.ghl_opportunity_id
        ? displayName([opp?.title], "Opportunity title not available locally")
        : "No linked GHL opportunity",
      opportunityLinkStatus: r.ghl_opportunity_id ? "linked" : "none",
      statusLabel: formatJobStatus(r.last_job_status),
      missingOpportunity: !r.ghl_opportunity_id,
      lastJobStatus: r.last_job_status ?? null,
      active: isOperationalJobStatus(r.last_job_status),
      lastSyncedAt: r.last_synced_at ?? null,
      blocker,
      nextAction,
    };
  });
}

export async function enrichFinance(
  rows: {
    id: string;
    jobber_quote_id?: string;
    jobber_invoice_id?: string;
    customer_link_id?: string | null;
    last_status?: string | null;
    ghl_reference?: string | null;
  }[],
  kind: "quote" | "invoice",
  customers: CustomerRowView[]
): Promise<FinanceRowView[]> {
  const keys: LabelKey[] = rows
    .map((r) => (kind === "quote" ? r.jobber_quote_id : r.jobber_invoice_id))
    .filter(Boolean)
    .map((id) => ({
      provider: "jobber" as const,
      entity_type: kind,
      entity_id: String(id),
    }));
  const labels = await hydrateLabels(keys);
  const nested = [
    ...new Set(
      [...labels.values()]
        .map((l) => String(l.extra.clientId ?? ""))
        .filter((id) => id.startsWith("Z2lkOi8v"))
    ),
  ];
  const clients = await hydrateLabels(
    nested.map((entity_id) => ({
      provider: "jobber" as const,
      entity_type: "client" as const,
      entity_id,
    }))
  );
  const byLink = new Map(customers.map((c) => [c.id, c]));
  const byJobber = new Map(customers.map((c) => [c.jobberClientId, c]));
  return rows.map((r) => {
    const id = kind === "quote" ? r.jobber_quote_id : r.jobber_invoice_id;
    const lbl = labelOf(labels, "jobber", kind, id);
    const clientId = lbl?.extra.clientId as string | undefined;
    const linked =
      (r.customer_link_id ? byLink.get(r.customer_link_id) : undefined) ??
      (clientId ? byJobber.get(clientId) : undefined);
    const jobberName =
      (lbl?.extra.clientName as string | undefined) ||
      (clientId ? labelOf(clients, "jobber", "client", clientId)?.title : "") ||
      "";
    let customerResolution: FinanceRowView["customerResolution"] = "not_available_locally";
    let customerName = "Not available locally";
    if (lbl?.lookup_ok === false) {
      customerResolution = "lookup_failed";
      customerName = "Provider lookup failed";
    } else if (linked?.verified) {
      customerResolution = "verified_link";
      customerName = linked.jobberName;
    } else if (jobberName) {
      customerResolution = "jobber_customer";
      customerName = jobberName;
    } else if (lbl && !clientId) {
      customerResolution = "jobber_unresolved";
      customerName = "Jobber customer unresolved";
    }
    return {
      id: r.id,
      providerId: id ?? null,
      title: displayName(
        [lbl?.title],
        kind === "quote" ? "Quote number not available locally" : "Invoice number not available locally"
      ),
      customerName,
      customerLinkId: linked?.id ?? r.customer_link_id ?? null,
      customerResolution,
      statusLabel: formatJobStatus(
        (lbl?.extra.quoteStatus as string) ||
          (lbl?.extra.invoiceStatus as string) ||
          r.last_status
      ),
      ghlSync: ghlSyncLabel(r.ghl_reference),
    };
  });
}

export async function enrichEvents(
  events: {
    id: string;
    source: string;
    eventKind: string;
    status: string;
    error: string | null;
    receivedAt: string;
    processedAt?: string | null;
    providerEntityId?: string | null;
    processOutcome?: string | null;
  }[],
  customers: CustomerRowView[],
  jobs: JobRowView[]
) {
  const byJobber = new Map(customers.map((c) => [c.jobberClientId, c]));
  const byGhl = new Map(customers.map((c) => [c.ghlContactId, c]));
  const byJob = new Map(jobs.map((j) => [j.jobberJobId, j]));
  return events.map((e) => {
    const id = e.providerEntityId ?? null;
    const customer = (id && byJobber.get(id)) || (id && byGhl.get(id)) || null;
    const job = (id && byJob.get(id)) || null;
    const outcome = classifyProcessOutcome({
      status: e.status,
      error: e.error,
      recordedOutcome: e.processOutcome,
    });
    const write = providerWriteOccurred(outcome);
    const subject =
      customer?.jobberName || job?.jobberCustomerName || job?.jobberTitle || job?.jobNumber || null;
    return {
      ...e,
      subject,
      customerLinkId: customer?.id ?? job?.customerLinkId ?? null,
      outcome,
      outcomeLabel: outcomeLabel(outcome),
      providerWrite: write,
      receivedLabel: formatAdminTimestamp(e.receivedAt),
      processedLabel: formatAdminTimestamp(e.processedAt ?? null),
    };
  });
}

export function jobCountByCustomer(jobs: JobRowView[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const j of jobs) {
    if (!j.customerLinkId) continue;
    m.set(j.customerLinkId, (m.get(j.customerLinkId) ?? 0) + 1);
  }
  return m;
}
