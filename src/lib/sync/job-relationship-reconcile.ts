import { STM_GHL } from "@/lib/config/stm-mapping";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getGhlOpportunity, searchGhlOpportunities } from "@/lib/ghl/rest";
import { fetchJobberJob } from "@/lib/jobber/ops";
import {
  classifyOpportunityStage,
  isOperationalJobStatus,
} from "@/lib/sync/job-opp-candidates";

export type JobRelationshipProposal = {
  proposal_type: "customer_link_backfill" | "opportunity_link" | "noop" | "blocked";
  target_customer_link_id: string | null;
  target_ghl_opportunity_id: string | null;
  reason: string;
  evidence: Record<string, unknown>;
  rollback_sql: string | null;
};

export type JobRelationshipAuditRow = {
  job_link_id: string;
  jobber_job_id: string;
  jobber_client_id: string | null;
  stored_customer_link_id: string | null;
  stored_ghl_opportunity_id: string | null;
  verified_customer_link_id: string | null;
  unverified_customer_link_id: string | null;
  ghl_contact_id: string | null;
  jobber_status: string | null;
  issues: string[];
  proposals: JobRelationshipProposal[];
};

export function analyzeJobRelationship(input: {
  jobLinkId: string;
  jobberJobId: string;
  jobberClientId: string | null;
  storedCustomerLinkId: string | null;
  storedOpportunityId: string | null;
  jobberStatus: string | null;
  verifiedCustomer: { id: string; ghl_contact_id: string | null } | null;
  unverifiedCustomer: { id: string } | null;
  usedOpportunityIds: Set<string>;
  opportunityUsageCount: number;
  candidateOpportunities: { id: string; pipelineStageId?: string | null }[];
}): JobRelationshipAuditRow {
  const issues: string[] = [];
  const proposals: JobRelationshipProposal[] = [];

  if (!input.jobberClientId) {
    issues.push("jobber_client_unresolved");
    proposals.push({
      proposal_type: "blocked",
      target_customer_link_id: null,
      target_ghl_opportunity_id: null,
      reason: "jobber_client_unresolved",
      evidence: {},
      rollback_sql: null,
    });
    return {
      job_link_id: input.jobLinkId,
      jobber_job_id: input.jobberJobId,
      jobber_client_id: null,
      stored_customer_link_id: input.storedCustomerLinkId,
      stored_ghl_opportunity_id: input.storedOpportunityId,
      verified_customer_link_id: null,
      unverified_customer_link_id: input.unverifiedCustomer?.id ?? null,
      ghl_contact_id: null,
      jobber_status: input.jobberStatus,
      issues,
      proposals,
    };
  }

  if (input.unverifiedCustomer && !input.verifiedCustomer) {
    issues.push("unverified_syncbridge_customer_mapping");
  }
  if (!input.verifiedCustomer) {
    if (!input.unverifiedCustomer) {
      issues.push("no_customer_links_row_for_jobber_client");
    }
  } else if (
    input.storedCustomerLinkId &&
    input.storedCustomerLinkId !== input.verifiedCustomer.id
  ) {
    issues.push("stored_customer_link_id_contradicts_verified_mapping");
  }

  if (!input.storedCustomerLinkId && input.verifiedCustomer) {
    proposals.push({
      proposal_type: "customer_link_backfill",
      target_customer_link_id: input.verifiedCustomer.id,
      target_ghl_opportunity_id: null,
      reason: "verified_customer_link_exists_for_jobber_client",
      evidence: {
        jobber_client_id: input.jobberClientId,
        verified_customer_link_id: input.verifiedCustomer.id,
      },
      rollback_sql: `update job_links set customer_link_id = null where id = '${input.jobLinkId}';`,
    });
  }

  if (input.storedOpportunityId) {
    if (input.opportunityUsageCount > 1) issues.push("duplicate_ghl_opportunity_across_jobs");
  } else if (input.verifiedCustomer?.ghl_contact_id) {
    const operational = input.candidateOpportunities.filter(
      (o) => classifyOpportunityStage(o.pipelineStageId) === "operational"
    );
    const unused = operational.filter(
      (o) => o.id && !input.usedOpportunityIds.has(o.id)
    );
    if (isOperationalJobStatus(input.jobberStatus)) {
      if (unused.length === 1) {
        proposals.push({
          proposal_type: "opportunity_link",
          target_customer_link_id: input.verifiedCustomer.id,
          target_ghl_opportunity_id: unused[0]!.id,
          reason: "unique_operational_pipeline_opportunity",
          evidence: {
            ghl_contact_id: input.verifiedCustomer.ghl_contact_id,
            opportunity_id: unused[0]!.id,
          },
          rollback_sql: `update job_links set ghl_opportunity_id = null where id = '${input.jobLinkId}';`,
        });
      } else if (unused.length === 0) {
        issues.push("no_unique_operational_opportunity");
        proposals.push({
          proposal_type: "blocked",
          target_customer_link_id: null,
          target_ghl_opportunity_id: null,
          reason: "no_unique_operational_opportunity",
          evidence: {},
          rollback_sql: null,
        });
      } else {
        issues.push("ambiguous_operational_opportunities");
        proposals.push({
          proposal_type: "blocked",
          target_customer_link_id: null,
          target_ghl_opportunity_id: null,
          reason: "ambiguous_operational_opportunities",
          evidence: { candidate_ids: unused.map((u) => u.id) },
          rollback_sql: null,
        });
      }
    } else {
      issues.push(`non_operational_job_status:${input.jobberStatus ?? "unknown"}`);
    }
  } else if (!input.verifiedCustomer) {
    proposals.push({
      proposal_type: "blocked",
      target_customer_link_id: null,
      target_ghl_opportunity_id: null,
      reason: "unverified_or_missing_customer_link",
      evidence: {},
      rollback_sql: null,
    });
  }

  if (proposals.length === 0) {
    proposals.push({
      proposal_type: "noop",
      target_customer_link_id: null,
      target_ghl_opportunity_id: null,
      reason: "relationships_complete_or_awaiting_approval",
      evidence: {},
      rollback_sql: null,
    });
  }

  return {
    job_link_id: input.jobLinkId,
    jobber_job_id: input.jobberJobId,
    jobber_client_id: input.jobberClientId,
    stored_customer_link_id: input.storedCustomerLinkId,
    stored_ghl_opportunity_id: input.storedOpportunityId,
    verified_customer_link_id: input.verifiedCustomer?.id ?? null,
    unverified_customer_link_id: input.unverifiedCustomer?.id ?? null,
    ghl_contact_id: input.verifiedCustomer?.ghl_contact_id ?? null,
    jobber_status: input.jobberStatus,
    issues,
    proposals,
  };
}

export async function buildJobRelationshipAudit(opts?: {
  liveOpportunityScan?: boolean;
}): Promise<{
  rows: JobRelationshipAuditRow[];
  counts: Record<string, number>;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { rows: [], counts: {} };

  const { data: jobs } = await supabase
    .from("job_links")
    .select(
      "id, jobber_job_id, ghl_opportunity_id, last_job_status, customer_link_id"
    )
    .limit(200);
  const { data: customers } = await supabase
    .from("customer_links")
    .select("id, jobber_client_id, ghl_contact_id, verified")
    .limit(500);
  const jobIds = (jobs ?? []).map((j) => j.jobber_job_id).filter(Boolean) as string[];
  const { data: labels } = jobIds.length
    ? await supabase
        .from("entity_labels")
        .select("entity_id, extra, lookup_ok")
        .eq("provider", "jobber")
        .eq("entity_type", "job")
        .in("entity_id", jobIds)
    : { data: [] };

  const labelByJob = new Map(
    (labels ?? []).map((l) => [String(l.entity_id), l.extra as Record<string, unknown>])
  );

  const verifiedByClient = new Map<
    string,
    { id: string; ghl_contact_id: string | null }
  >();
  const unverifiedByClient = new Map<string, { id: string }>();
  for (const c of customers ?? []) {
    const jb = String(c.jobber_client_id ?? "");
    if (!jb) continue;
    if (c.verified) verifiedByClient.set(jb, { id: c.id as string, ghl_contact_id: c.ghl_contact_id as string | null });
    else unverifiedByClient.set(jb, { id: c.id as string });
  }

  const usedOpps = new Set(
    (jobs ?? []).map((j) => j.ghl_opportunity_id).filter(Boolean) as string[]
  );
  const oppUsage = new Map<string, number>();
  for (const j of jobs ?? []) {
    const o = j.ghl_opportunity_id as string | null;
    if (o) oppUsage.set(o, (oppUsage.get(o) ?? 0) + 1);
  }

  const oppCache = new Map<string, { id: string; pipelineStageId?: string | null }[]>();
  const scan = opts?.liveOpportunityScan === true;

  const rows: JobRelationshipAuditRow[] = [];
  for (const row of jobs ?? []) {
    const jobId = String(row.jobber_job_id ?? "");
    if (!jobId) continue;
    let clientId = String(labelByJob.get(jobId)?.clientId ?? "");
    let status = String(labelByJob.get(jobId)?.jobStatus ?? row.last_job_status ?? "");
    if (!clientId) {
      const live = await fetchJobberJob(jobId);
      if (live?.client?.id) clientId = live.client.id;
      if (live?.jobStatus) status = live.jobStatus;
    }
    const verified = clientId ? verifiedByClient.get(clientId) ?? null : null;
    const unverified = clientId ? unverifiedByClient.get(clientId) ?? null : null;

    let candidateOpps: { id: string; pipelineStageId?: string | null }[] = [];
    if (scan && verified?.ghl_contact_id && !row.ghl_opportunity_id) {
      const ghlId = verified.ghl_contact_id;
      if (!oppCache.has(ghlId)) {
        const opps = await searchGhlOpportunities(ghlId);
        const filtered = opps
          .filter((o) => o.pipelineId === STM_GHL.salesPipelineId)
          .map((o) => ({ id: o.id, pipelineStageId: o.pipelineStageId }));
        for (const o of filtered) {
          await getGhlOpportunity(o.id);
        }
        oppCache.set(ghlId, filtered);
      }
      candidateOpps = oppCache.get(ghlId) ?? [];
    }

    rows.push(
      analyzeJobRelationship({
        jobLinkId: row.id as string,
        jobberJobId: jobId,
        jobberClientId: clientId || null,
        storedCustomerLinkId: (row.customer_link_id as string | null) ?? null,
        storedOpportunityId: (row.ghl_opportunity_id as string | null) ?? null,
        jobberStatus: status || null,
        verifiedCustomer: verified,
        unverifiedCustomer: unverified,
        usedOpportunityIds: usedOpps,
        opportunityUsageCount: row.ghl_opportunity_id
          ? oppUsage.get(String(row.ghl_opportunity_id)) ?? 0
          : 0,
        candidateOpportunities: candidateOpps,
      })
    );
  }

  const counts = {
    jobs: rows.length,
    customer_backfill: rows.filter((r) =>
      r.proposals.some((p) => p.proposal_type === "customer_link_backfill")
    ).length,
    opportunity_link: rows.filter((r) =>
      r.proposals.some((p) => p.proposal_type === "opportunity_link")
    ).length,
    blocked: rows.filter((r) => r.proposals.some((p) => p.proposal_type === "blocked")).length,
    with_verified_customer: rows.filter((r) => r.verified_customer_link_id).length,
    with_unverified_only: rows.filter(
      (r) => r.unverified_customer_link_id && !r.verified_customer_link_id
    ).length,
    unresolved_client: rows.filter((r) => !r.jobber_client_id).length,
  };

  return { rows, counts };
}

export async function persistJobRelationshipProposals(
  rows: JobRelationshipAuditRow[]
): Promise<{ upserted: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { upserted: 0 };
  let upserted = 0;
  for (const row of rows) {
    for (const p of row.proposals.filter((x) => x.proposal_type !== "noop")) {
      await supabase
        .from("job_relationship_proposals")
        .delete()
        .eq("job_link_id", row.job_link_id)
        .eq("proposal_type", p.proposal_type)
        .eq("status", "suggested");
      const { error } = await supabase.from("job_relationship_proposals").insert({
        job_link_id: row.job_link_id,
        jobber_job_id: row.jobber_job_id,
        proposal_type: p.proposal_type,
        target_customer_link_id: p.target_customer_link_id,
        target_ghl_opportunity_id: p.target_ghl_opportunity_id,
        reason: p.reason,
        evidence: p.evidence,
        rollback_sql: p.rollback_sql,
        status: "suggested",
      });
      if (!error) upserted += 1;
    }
  }
  return { upserted };
}