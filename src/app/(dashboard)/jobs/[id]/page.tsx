import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell, Panel } from "@/components/admin/shell";
import { IdDetails } from "@/components/admin/id-details";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { listLinks } from "@/lib/db/admin-lists";
import { enrichCustomers, enrichEvents, enrichJobs } from "@/lib/display/enrich";
import { getGhlPipelineStageMap } from "@/lib/ghl/pipeline-stages";
import { listRecentEvents } from "@/services/events/inbox";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) notFound();
  const { data: row } = await supabase
    .from("job_links")
    .select(
      "id, jobber_job_id, ghl_opportunity_id, last_job_status, last_synced_at, customer_link_id"
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const { customers } = await listLinks();
  const stageNames = await getGhlPipelineStageMap();
  const customerViews = await enrichCustomers(customers);
  const [job] = await enrichJobs([row], customerViews, { stageNames });
  if (!job) notFound();
  const { data: visits } = await supabase
    .from("appointment_links")
    .select("id, ghl_appointment_id, jobber_visit_id, booking_state, requested_start_at")
    .eq("job_link_id", id)
    .limit(50);
  const events = await listRecentEvents(80);
  const history = (await enrichEvents(events, customerViews, [job])).filter(
    (e) => e.providerEntityId === job.jobberJobId || e.providerEntityId === job.ghlOpportunityId
  );

  return (
    <AdminShell title={job.jobberTitle} subtitle={job.statusLabel}>
      <p className="mb-4 text-sm">
        <Link href="/links" className="underline">
          Back to jobs
        </Link>
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel heading="Customer">
          <p className="text-sm">{job.jobberCustomerName}</p>
          <p className="mt-1 text-xs text-[#657683]">
            {job.customerLinkStatus === "verified"
              ? "Verified SyncBridge customer mapping"
              : job.jobberCustomerSource === "jobber_job"
                ? "Customer known in Jobber, but no verified GHL customer mapping"
                : "Jobber customer unresolved"}
          </p>
          {job.customerLinkId ? (
            <Link href={`/customers/${job.customerLinkId}`} className="text-xs underline">
              Open customer
            </Link>
          ) : null}
          <IdDetails label="Jobber client ID" value={job.jobberClientId} />
        </Panel>
        <Panel heading="Jobber job">
          <p className="text-sm">
            {job.jobNumber ? `Job #${job.jobNumber} · ` : ""}
            {job.jobberTitle}
          </p>
          <p className="text-xs text-[#657683]">{job.statusLabel}</p>
          <IdDetails label="Jobber job ID" value={job.jobberJobId} />
        </Panel>
        <Panel heading="GHL opportunity">
          <p className="text-sm">{job.opportunityTitle}</p>
          <p className="text-xs text-[#657683]">
            {job.opportunityLinkStatus === "linked"
              ? `Linked · stage ${job.opportunityStageName}`
              : "No linked opportunity"}
          </p>
          <IdDetails label="GHL opportunity ID" value={job.ghlOpportunityId} />
        </Panel>
        <Panel heading="Visits">
          {(visits ?? []).length === 0 ? (
            <p className="text-sm text-[#657683]">No appointment rows.</p>
          ) : (
            <ul className="text-xs">
              {(visits ?? []).map((v) => (
                <li key={v.id}>
                  {v.booking_state} · {v.requested_start_at ?? "no requested time"}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel heading="Why relationships may be missing">
          <p className="text-sm">{job.blocker ?? "No blocker recorded."}</p>
          <p className="mt-2 text-xs text-[#657683]">{job.nextAction}</p>
        </Panel>
        <Panel heading="Synchronization history">
          {history.length === 0 ? (
            <p className="text-sm text-[#657683]">No recent events for this job.</p>
          ) : (
            <ul className="text-xs">
              {history.map((e) => (
                <li key={e.id}>
                  {e.eventKind} · {e.outcomeLabel} · {e.receivedLabel}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
