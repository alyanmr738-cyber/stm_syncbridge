import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  classifyProcessOutcome,
  formatAdminTimestamp,
  outcomeLabel,
  type ProcessOutcome,
} from "@/lib/display/process-outcome";
import type { JobRowView } from "@/lib/display/enrich";

export type CustomerSyncEvidence = {
  lastAttemptLabel: string;
  lastProviderWriteLabel: string;
  lastOutcomeLabel: string;
  latestBlocker: string | null;
};

export type CustomerLinkRow = {
  id: string;
  jobber_client_id?: string | null;
  ghl_contact_id?: string | null;
};

export type ConflictRow = {
  state?: string | null;
  entity_type?: string | null;
  source_entity_id?: string | null;
  reason?: string | null;
};

export function normalizeProviderEntityId(id?: string | null): string {
  return String(id ?? "").trim();
}

/** Open identity conflicts keyed by customer_links.id (not raw provider ids). */
export function customerLinksWithOpenConflicts(
  conflicts: ConflictRow[],
  customers: CustomerLinkRow[]
): Set<string> {
  const byJobber = new Map<string, string>();
  const byGhl = new Map<string, string>();
  for (const c of customers) {
    const jb = normalizeProviderEntityId(c.jobber_client_id);
    const gh = normalizeProviderEntityId(c.ghl_contact_id);
    if (jb) byJobber.set(jb, c.id);
    if (gh) byGhl.set(gh, c.id);
  }
  const linkIds = new Set<string>();
  for (const row of conflicts) {
    const state = String(row.state ?? "open").toLowerCase();
    if (state !== "open") continue;
    const entityType = String(row.entity_type ?? "").toLowerCase();
    if (entityType && entityType !== "customer") continue;
    const sid = normalizeProviderEntityId(row.source_entity_id);
    if (!sid) continue;
    const fromJobber = byJobber.get(sid);
    const fromGhl = byGhl.get(sid);
    if (fromJobber && fromGhl && fromJobber !== fromGhl) continue;
    if (fromJobber) linkIds.add(fromJobber);
    else if (fromGhl) linkIds.add(fromGhl);
  }
  return linkIds;
}

/** Count jobs per customer link via Jobber client on the job (not job_links.customer_link_id). */
export function jobCountByCustomerLink(
  customers: CustomerLinkRow[],
  jobs: Pick<JobRowView, "jobberClientId" | "jobberJobId">[]
): Map<string, number> {
  const clientToLink = new Map<string, string>();
  for (const c of customers) {
    const jb = normalizeProviderEntityId(c.jobber_client_id);
    if (jb) clientToLink.set(jb, c.id);
  }
  const counts = new Map<string, number>();
  const seenJobs = new Set<string>();
  for (const j of jobs) {
    const clientId = normalizeProviderEntityId(j.jobberClientId);
    if (!clientId) continue;
    const linkId = clientToLink.get(clientId);
    if (!linkId) continue;
    const jobKey = j.jobberJobId ?? `${linkId}:${clientId}:${counts.get(linkId) ?? 0}`;
    if (seenJobs.has(jobKey)) continue;
    seenJobs.add(jobKey);
    counts.set(linkId, (counts.get(linkId) ?? 0) + 1);
  }
  return counts;
}

type RawEvent = {
  provider_entity_id: string | null;
  status: string;
  last_error_redacted: string | null;
  received_at: string;
  processed_at: string | null;
  process_outcome: string | null;
};

export async function loadCustomerSyncEvidence(
  customers: CustomerLinkRow[],
  limitPerQuery = 400
): Promise<Map<string, CustomerSyncEvidence>> {
  const supabase = getSupabaseAdmin();
  const out = new Map<string, CustomerSyncEvidence>();
  if (!supabase || customers.length === 0) return out;

  const jobberToLink = new Map<string, string>();
  const ghlToLink = new Map<string, string>();
  const providerIds: string[] = [];
  for (const c of customers) {
    const jb = normalizeProviderEntityId(c.jobber_client_id);
    const gh = normalizeProviderEntityId(c.ghl_contact_id);
    if (jb) {
      jobberToLink.set(jb, c.id);
      providerIds.push(jb);
    }
    if (gh) {
      ghlToLink.set(gh, c.id);
      providerIds.push(gh);
    }
  }
  const uniqueIds = [...new Set(providerIds)];
  if (uniqueIds.length === 0) return out;

  const events: RawEvent[] = [];
  for (let i = 0; i < uniqueIds.length; i += 40) {
    const chunk = uniqueIds.slice(i, i + 40);
    const res = await supabase
      .from("sync_events")
      .select(
        "provider_entity_id, status, last_error_redacted, received_at, processed_at, process_outcome"
      )
      .in("provider_entity_id", chunk)
      .order("received_at", { ascending: false })
      .limit(limitPerQuery);
    if (res.error && /process_outcome/i.test(res.error.message)) {
      const fallback = await supabase
        .from("sync_events")
        .select(
          "provider_entity_id, status, last_error_redacted, received_at, processed_at"
        )
        .in("provider_entity_id", chunk)
        .order("received_at", { ascending: false })
        .limit(limitPerQuery);
      for (const row of fallback.data ?? []) {
        events.push({
          ...(row as RawEvent),
          process_outcome: null,
        });
      }
    } else {
      for (const row of res.data ?? []) {
        events.push(row as RawEvent);
      }
    }
  }

  type Acc = {
    lastAttempt: string;
    lastWrite: string | null;
    lastOutcome: ProcessOutcome;
    latestBlocker: string | null;
  };
  const acc = new Map<string, Acc>();

  for (const e of events) {
    const pid = normalizeProviderEntityId(e.provider_entity_id);
    const linkId = jobberToLink.get(pid) ?? ghlToLink.get(pid);
    if (!linkId) continue;
    const when = e.processed_at ?? e.received_at;
    const existing = acc.get(linkId);
    const outcome = classifyProcessOutcome({
      status: e.status,
      error: e.last_error_redacted,
      recordedOutcome: e.process_outcome,
    });
    if (!existing) {
      acc.set(linkId, {
        lastAttempt: when,
        lastWrite: outcome === "provider_write" ? when : null,
        lastOutcome: outcome,
        latestBlocker:
          e.last_error_redacted ||
          (outcome === "blocked_unverified" || outcome === "dead_letter" || outcome === "failed"
            ? outcomeLabel(outcome)
            : null),
      });
      continue;
    }
    if (when > existing.lastAttempt) {
      existing.lastAttempt = when;
      existing.lastOutcome = outcome;
      if (
        e.last_error_redacted ||
        outcome === "blocked_unverified" ||
        outcome === "dead_letter" ||
        outcome === "failed" ||
        outcome === "retrying"
      ) {
        existing.latestBlocker = e.last_error_redacted || outcomeLabel(outcome);
      }
    }
    if (outcome === "provider_write" && (!existing.lastWrite || when > existing.lastWrite)) {
      existing.lastWrite = when;
    }
  }

  for (const [linkId, row] of acc) {
    out.set(linkId, {
      lastAttemptLabel: formatAdminTimestamp(row.lastAttempt),
      lastProviderWriteLabel: row.lastWrite
        ? formatAdminTimestamp(row.lastWrite)
        : "Write outcome not recorded",
      lastOutcomeLabel: outcomeLabel(row.lastOutcome),
      latestBlocker: row.latestBlocker,
    });
  }
  return out;
}