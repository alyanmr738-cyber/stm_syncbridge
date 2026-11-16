import { AdminShell, Panel } from "@/components/admin/shell";
import { ActivityBoard } from "@/components/admin/activity-board";
import { listLinks } from "@/lib/db/admin-lists";
import { enrichCustomers, enrichEvents, enrichJobs } from "@/lib/display/enrich";
import { listRecentEvents } from "@/services/events/inbox";

export default async function ActivityPage() {
  const events = await listRecentEvents(80);
  const { customers, jobs } = await listLinks();
  const customerViews = await enrichCustomers(customers);
  const jobViews = await enrichJobs(jobs, customerViews);
  const rows = await enrichEvents(events, customerViews, jobViews);
  return (
    <AdminShell
      title="Sync activity"
      subtitle="Durable Jobber and GHL events, labeled with people and jobs when known."
    >
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[#657683]">No events stored yet.</p>
        ) : (
          <ActivityBoard rows={rows} />
        )}
      </Panel>
    </AdminShell>
  );
}
