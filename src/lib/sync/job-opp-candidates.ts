import { STM_GHL } from "@/lib/config/stm-mapping";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getGhlOpportunity, searchGhlOpportunities } from "@/lib/ghl/rest";
import { fetchJobberJob } from "@/lib/jobber/ops";

const OPERATIONAL_STAGES = new Set<string>([
  STM_GHL.jobScheduledStageId,
  STM_GHL.jobCompletedStageId,
]);

export function isOperationalJobStatus(status?: string | null): boolean {
  const s = String(status ?? "").toLowerCase();
  if (!s) return false;
  if (/archiv|cancel|deleted|inactive/.test(s)) return false;
  return true;
}

export function classifyOpportunityStage(stageId?: string | null): "operational" | "historical" | "unknown" {
  if (!stageId) return "unknown";
  if (OPERATIONAL_STAGES.has(stageId)) return "operational";
  return "historical";
}

export async function buildJobOpportunityCandidates(): Promise<{
  proposedLinks: {
    job_link_id: string;
    jobber_job_id: string;
    ghl_opportunity_id: string;
    reason: string;
  }[];
  excluded: { jobber_job_id: string; reason: string }[];
  counts: Record<string, number>;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { proposedLinks: [], excluded: [], counts: { jobLinks: 0 } };
  }
  const { data: jobs } = await supabase
    .from("job_links")
    .select("id, jobber_job_id, ghl_opportunity_id, last_job_status, customer_link_id")
    .limit(100);
  const { data: customers } = await supabase
    .from("customer_links")
    .select("id, jobber_client_id, ghl_contact_id, verified")
    .eq("verified", true)
    .limit(200);
  const byLink = new Map((customers ?? []).map((c) => [c.id as string, c]));
  const byJobberClient = new Map(
    (customers ?? []).map((c) => [c.jobber_client_id as string, c])
  );
  const usedOpps = new Set(
    (jobs ?? []).map((j) => j.ghl_opportunity_id).filter(Boolean) as string[]
  );

  const proposedLinks: {
    job_link_id: string;
    jobber_job_id: string;
    ghl_opportunity_id: string;
    reason: string;
  }[] = [];
  const excluded: { jobber_job_id: string; reason: string }[] = [];

  for (const row of jobs ?? []) {
    const jobId = String(row.jobber_job_id ?? "");
    if (!jobId) continue;
    if (row.ghl_opportunity_id) {
      excluded.push({ jobber_job_id: jobId, reason: "already_has_opportunity" });
      continue;
    }
    const live = await fetchJobberJob(jobId);
    if (!live) {
      excluded.push({ jobber_job_id: jobId, reason: "jobber_job_unreadable" });
      continue;
    }
    if (!isOperationalJobStatus(live.jobStatus)) {
      excluded.push({
        jobber_job_id: jobId,
        reason: `historical_or_archived_status:${live.jobStatus ?? "unknown"}`,
      });
      continue;
    }
    const customer =
      (row.customer_link_id ? byLink.get(row.customer_link_id as string) : null) ??
      (live.client?.id ? byJobberClient.get(live.client.id) : null);
    if (!customer?.verified || !customer.ghl_contact_id) {
      excluded.push({ jobber_job_id: jobId, reason: "unverified_or_missing_customer_link" });
      continue;
    }
    const opps = await searchGhlOpportunities(String(customer.ghl_contact_id));
    const pipelineOpps = opps.filter((o) => o.pipelineId === STM_GHL.salesPipelineId);
    const operational = pipelineOpps.filter(
      (o) => classifyOpportunityStage(o.pipelineStageId) === "operational"
    );
    const unused = operational.filter((o) => o.id && !usedOpps.has(o.id));
    if (unused.length !== 1) {
      excluded.push({
        jobber_job_id: jobId,
        reason:
          unused.length === 0
            ? "no_unique_operational_opportunity"
            : "ambiguous_operational_opportunities",
      });
      continue;
    }
    const opp = unused[0]!;
    const liveOpp = await getGhlOpportunity(opp.id);
    if (!liveOpp) {
      excluded.push({ jobber_job_id: jobId, reason: "opportunity_deleted" });
      continue;
    }
    usedOpps.add(opp.id);
    proposedLinks.push({
      job_link_id: row.id as string,
      jobber_job_id: jobId,
      ghl_opportunity_id: opp.id,
      reason: "unique_operational_pipeline_opportunity",
    });
  }

  return {
    proposedLinks,
    excluded,
    counts: {
      jobLinks: (jobs ?? []).length,
      proposed: proposedLinks.length,
      excluded: excluded.length,
      alreadyLinked: excluded.filter((e) => e.reason === "already_has_opportunity").length,
    },
  };
}
