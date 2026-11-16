import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { enrichCustomers } from "@/lib/display/enrich";
import { hydrateLabels, labelOf } from "@/lib/display/entity-labels";
import { displayName, maskEmail, maskPhone, namesDiffer } from "@/lib/display/format";
import { canAcceptVerifiedLink, type CandidateBucket } from "@/lib/sync/candidate-matcher";

export async function GET() {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });

  const { data: customers } = await supabase
    .from("customer_links")
    .select(
      "id, jobber_client_id, ghl_contact_id, verified, match_method, last_jobber_revision, last_ghl_revision, last_synced_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: proposals } = await supabase
    .from("match_proposals")
    .select("id, kind, jobber_id, ghl_id, bucket, reason, status, decided_by, decided_at, created_at")
    .eq("kind", "customer")
    .order("created_at", { ascending: false })
    .limit(500);
  const { data: conflicts } = await supabase
    .from("sync_conflicts")
    .select("id, entity_type, reason, state, source_entity_id, created_at")
    .eq("state", "open")
    .eq("entity_type", "customer")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = customers ?? [];
  const views = await enrichCustomers(rows).catch(() =>
    rows.map((r) => ({
      id: r.id as string,
      jobberClientId: (r.jobber_client_id as string) ?? null,
      ghlContactId: (r.ghl_contact_id as string) ?? null,
      verified: r.verified === true,
      matchMethod: String(r.match_method ?? ""),
      jobberName: "Jobber customer (name unavailable)",
      ghlName: "GHL contact (name unavailable)",
      namesDiffer: false,
      maskedEmail: null,
      maskedPhone: null,
      lastSyncedAt: (r.last_synced_at as string) ?? null,
    }))
  );
  const verified = views.filter((r) => r.verified);
  const pending = views.filter((r) => !r.verified);
  const proposalRows = proposals ?? [];
  const labels = await hydrateLabels(
    proposalRows.slice(0, 40).flatMap((p) => {
      const keys = [];
      if (p.jobber_id) keys.push({ provider: "jobber" as const, entity_type: "client" as const, entity_id: String(p.jobber_id) });
      if (p.ghl_id) keys.push({ provider: "ghl" as const, entity_type: "contact" as const, entity_id: String(p.ghl_id) });
      return keys;
    })
  ).catch(() => new Map());
  const proposalsView = proposalRows.map((p) => {
    const j = labelOf(labels, "jobber", "client", p.jobber_id as string);
    const g = labelOf(labels, "ghl", "contact", p.ghl_id as string);
    const jobberName = displayName([j?.title], "Jobber customer (name unavailable)");
    const ghlName = displayName([g?.title], "GHL contact (name unavailable)");
    return {
      ...p,
      jobberName,
      ghlName,
      namesDiffer: namesDiffer(jobberName, ghlName),
      maskedEmail: maskEmail((j?.extra.email as string) || (g?.extra.email as string)),
      maskedPhone: maskPhone((j?.extra.phone as string) || (g?.extra.phone as string)),
      canAccept: canAcceptVerifiedLink(p.bucket as CandidateBucket),
    };
  });

  return Response.json({
    counts: {
      verified: verified.length,
      pending: pending.length,
      suggested: proposalRows.filter((p) => p.status === "suggested").length,
      rejectedProposals: proposalRows.filter((p) => p.status === "rejected").length,
      openCustomerConflicts: (conflicts ?? []).length,
    },
    policy: {
      autoVerifyNever: true,
      acceptVerifiedRequires: "email_and_phone_unique plus explicit admin accept",
      canAcceptVerifiedLinkDemo: canAcceptVerifiedLink("email_and_phone_unique"),
      batchB: "not applied",
      labels: {
        legacyBatchB: "email_only + name_aligned (cannot UI-accept)",
        currentAcceptable: "email_and_phone_unique after explicit confirm",
      },
    },
    verified: verified.slice(0, 120),
    pending,
    proposals: proposalsView,
    conflicts: conflicts ?? [],
  });
}
