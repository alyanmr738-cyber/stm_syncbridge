import { AdminShell, Panel } from "@/components/admin/shell";
import { ActivityBoard } from "@/components/admin/activity-board";
import { listLinks } from "@/lib/db/admin-lists";
import { enrichCustomers, enrichEvents, enrichJobs } from "@/lib/display/enrich";
import { getGhlPipelineStageMap } from "@/lib/ghl/pipeline-stages";
import { listRecentEvents } from "@/services/events/inbox";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const events = await listRecentEvents(80);
  const { customers, jobs } = await listLinks();
  const stageNames = await getGhlPipelineStageMap();
  const customerViews = await enrichCustomers(customers);
  const jobViews = await enrichJobs(jobs, customerViews, { stageNames });
  const rows = await enrichEvents(events, customerViews, jobViews);
  return (
    <AdminShell
      title="Sync activity"
      subtitle="Queue status is not a provider write. Historical succeeded events without process_outcome show Write outcome not recorded."
    >
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[#657683]">No events stored yet.</p>
        ) : (
          <ActivityBoard rows={rows} initialFilter={filter} />
        )}
      </Panel>
    </AdminShell>
  );
}