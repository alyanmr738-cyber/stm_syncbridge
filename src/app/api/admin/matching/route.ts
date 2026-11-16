import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { canAcceptVerifiedLink } from "@/lib/sync/candidate-matcher";

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
      "id, jobber_client_id, ghl_contact_id, verified, match_method, last_synced_at, created_at"
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
  const verified = rows.filter((r) => r.verified);
  const pending = rows.filter((r) => !r.verified);
  const proposalRows = proposals ?? [];

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
    },
    verified: verified.slice(0, 120),
    pending,
    proposals: proposalRows,
    conflicts: conflicts ?? [],
  });
}
