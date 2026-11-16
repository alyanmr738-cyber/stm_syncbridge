import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { buildJobOpportunityCandidates } from "@/lib/sync/job-opp-candidates";

export async function GET() {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });

  const { data: jobs } = await supabase
    .from("job_links")
    .select(
      "id, jobber_job_id, ghl_opportunity_id, last_job_status, last_synced_at, customer_link_id"
    )
    .order("last_synced_at", { ascending: false })
    .limit(500);

  const rows = jobs ?? [];
  const withOpp = rows.filter((j) => j.ghl_opportunity_id);
  const missingOpp = rows.filter((j) => !j.ghl_opportunity_id);
  const archivedish = rows.filter((j) =>
    /archiv|complete|closed|inactive/i.test(String(j.last_job_status ?? ""))
  );

  return Response.json({
    note: "Read-only. No job_links inserted. Linking existing opportunities requires a reviewed batch approval.",
    pipeline: "UMelQ0AisTqWdPl1XHK6",
    counts: {
      jobLinks: rows.length,
      withOpportunity: withOpp.length,
      missingOpportunity: missingOpp.length,
      archivedOrClosedStatus: archivedish.length,
    },
    missingOpportunitySample: missingOpp.slice(0, 25),
    withOpportunitySample: withOpp.slice(0, 15),
    live: await buildJobOpportunityCandidates(),
  });
}
