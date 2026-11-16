import { classifyCustomerPair, type CandidateBucket } from "@/lib/sync/candidate-matcher";
import { getGhlContact } from "@/lib/ghl/rest";
import { fetchJobberClient } from "@/lib/jobber/ops";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export type ProposalDraft = {
  kind: "customer";
  jobber_id: string;
  ghl_id: string;
  bucket: CandidateBucket;
  reason: string;
  evidence: Record<string, unknown>;
  status: "suggested";
};

export async function buildLiveCustomerProposalDrafts(): Promise<{
  drafts: ProposalDraft[];
  skippedVerified: number;
  missingProvider: number;
  pendingLinks: number;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { drafts: [], skippedVerified: 0, missingProvider: 0, pendingLinks: 0 };
  }
  const { data: links } = await supabase
    .from("customer_links")
    .select("id, jobber_client_id, ghl_contact_id, verified, match_method")
    .limit(500);
  const rows = links ?? [];
  const verifiedPairs = new Set(
    rows
      .filter((r) => r.verified)
      .map((r) => `${r.jobber_client_id}|${r.ghl_contact_id}`)
  );
  const pending = rows.filter((r) => !r.verified);
  const drafts: ProposalDraft[] = [];
  let missingProvider = 0;
  for (const row of pending) {
    const jobberId = String(row.jobber_client_id ?? "");
    const ghlId = String(row.ghl_contact_id ?? "");
    if (!jobberId || !ghlId) continue;
    if (verifiedPairs.has(`${jobberId}|${ghlId}`)) continue;
    const [jobber, ghl] = await Promise.all([
      fetchJobberClient(jobberId),
      getGhlContact(ghlId),
    ]);
    if (!jobber || !ghl) {
      missingProvider += 1;
      drafts.push({
        kind: "customer",
        jobber_id: jobberId,
        ghl_id: ghlId,
        bucket: "ambiguous",
        reason: "deleted_or_unreadable_provider_record",
        evidence: { jobberPresent: Boolean(jobber), ghlPresent: Boolean(ghl), match_method: row.match_method },
        status: "suggested",
      });
      continue;
    }
    const classified = classifyCustomerPair({
      jobber: {
        id: jobber.id,
        emails: (jobber.emails ?? []).map((e) => e.address).filter(Boolean) as string[],
        phones: (jobber.phones ?? []).map((p) => p.number).filter(Boolean) as string[],
        name: `${jobber.firstName ?? ""} ${jobber.lastName ?? jobber.name ?? ""}`.trim(),
      },
      ghl: {
        id: ghl.id,
        emails: ghl.email ? [ghl.email] : [],
        phones: ghl.phone ? [ghl.phone] : [],
        name: `${ghl.firstName ?? ""} ${ghl.lastName ?? ""}`.trim(),
      },
      emailUnique: true,
      phoneUnique: true,
    });
    drafts.push({
      kind: "customer",
      jobber_id: jobberId,
      ghl_id: ghlId,
      bucket: classified.bucket,
      reason: classified.reason,
      evidence: {
        live: true,
        match_method: row.match_method,
        canAutoVerify: classified.canAutoVerify,
      },
      status: "suggested",
    });
  }
  return {
    drafts,
    skippedVerified: rows.filter((r) => r.verified).length,
    missingProvider,
    pendingLinks: pending.length,
  };
}

export async function upsertSuggestedProposals(drafts: ProposalDraft[]): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase || drafts.length === 0) return 0;
  let n = 0;
  for (const d of drafts) {
    const { error } = await supabase.from("match_proposals").upsert(
      {
        kind: d.kind,
        jobber_id: d.jobber_id,
        ghl_id: d.ghl_id,
        bucket: d.bucket,
        reason: d.reason,
        evidence: d.evidence,
        status: "suggested",
      },
      { onConflict: "kind,jobber_id,ghl_id" }
    );
    if (!error) n += 1;
  }
  return n;
}
