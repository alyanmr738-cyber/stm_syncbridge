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

export type CustomerRowView = {
  id: string;
  jobberClientId: string | null;
  ghlContactId: string | null;
  verified: boolean;
  matchMethod: string;
  jobberName: string;
  ghlName: string;
  namesDiffer: boolean;
  maskedEmail: string | null;
  maskedPhone: string | null;
  lastSyncedAt: string | null;
};

export type JobRowView = {
  id: string;
  jobberJobId: string | null;
  ghlOpportunityId: string | null;
  customerLinkId: string | null;
  jobberTitle: string;
  jobNumber: string | null;
  customerName: string;
  opportunityTitle: string;
  statusLabel: string;
  missingOpportunity: boolean;
  lastJobStatus: string | null;
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
  }[]
): Promise<CustomerRowView[]> {
  const labels = await hydrateLabels(keysForCustomers(rows));
  return rows.map((r) => {
    const jobberLbl = labelOf(labels, "jobber", "client", r.jobber_client_id);
    const ghlLbl = labelOf(labels, "ghl", "contact", r.ghl_contact_id);
    const fromJobberRev = parseRevisionBlob(r.last_jobber_revision);
    const fromGhlRev = parseRevisionBlob(r.last_ghl_revision);
    const jobberName = displayName(
      [jobberLbl?.title, fromJobberRev.name],
      r.jobber_client_id ? "Jobber customer (name unavailable)" : "No Jobber customer"
    );
    const ghlName = displayName(
      [ghlLbl?.title, fromGhlRev.name],
      r.ghl_contact_id ? "GHL contact (name unavailable)" : "No GHL contact"
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
    return {
      id: r.id,
      jobberClientId: r.jobber_client_id ?? null,
      ghlContactId: r.ghl_contact_id ?? null,
      verified: r.verified === true,
      matchMethod: r.match_method ?? "pending",
      jobberName,
      ghlName,
      namesDiffer: namesDiffer(jobberName, ghlName),
      maskedEmail: maskEmail(email),
      maskedPhone: maskPhone(phone),
      lastSyncedAt: r.last_synced_at ?? null,
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
  const byLink = new Map(customers.map((c) => [c.id, c]));
  return rows.map((r) => {
    const job = labelOf(labels, "jobber", "job", r.jobber_job_id);
    const opp = labelOf(labels, "ghl", "opportunity", r.ghl_opportunity_id);
    const customer = r.customer_link_id ? byLink.get(r.customer_link_id) : undefined;
    const jobNumber = (job?.extra.jobNumber as string | undefined) ?? null;
    const jobberTitle = displayName(
      [job?.title, jobNumber ? `Job ${jobNumber}` : null],
      "Job (title unavailable)"
    );
    return {
      id: r.id,
      jobberJobId: r.jobber_job_id ?? null,
      ghlOpportunityId: r.ghl_opportunity_id ?? null,
      customerLinkId: r.customer_link_id ?? null,
      jobberTitle,
      jobNumber,
      customerName: customer?.jobberName ?? "Customer unlinked",
      opportunityTitle: r.ghl_opportunity_id
        ? displayName([opp?.title], "Opportunity (title unavailable)")
        : "No linked opportunity",
      statusLabel: formatJobStatus(r.last_job_status),
      missingOpportunity: !r.ghl_opportunity_id,
      lastJobStatus: r.last_job_status ?? null,
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
) {
  const keys: LabelKey[] = rows
    .map((r) => (kind === "quote" ? r.jobber_quote_id : r.jobber_invoice_id))
    .filter(Boolean)
    .map((id) => ({
      provider: "jobber" as const,
      entity_type: kind,
      entity_id: String(id),
    }));
  const labels = await hydrateLabels(keys);
  const byLink = new Map(customers.map((c) => [c.id, c]));
  return rows.map((r) => {
    const id = kind === "quote" ? r.jobber_quote_id : r.jobber_invoice_id;
    const lbl = labelOf(labels, "jobber", kind, id);
    const clientId = lbl?.extra.clientId as string | undefined;
    const customer =
      (r.customer_link_id ? byLink.get(r.customer_link_id) : undefined) ??
      customers.find((c) => c.jobberClientId === clientId);
    return {
      id: r.id,
      providerId: id ?? null,
      title: displayName(
        [lbl?.title],
        kind === "quote" ? "Quote (number unavailable)" : "Invoice (number unavailable)"
      ),
      customerName: customer?.jobberName ?? "Customer unknown",
      customerLinkId: customer?.id ?? r.customer_link_id ?? null,
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
    providerEntityId?: string | null;
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
    const subject = customer?.jobberName || job?.jobberTitle || job?.jobNumber || null;
    return { ...e, subject, customerLinkId: customer?.id ?? job?.customerLinkId ?? null };
  });
}
