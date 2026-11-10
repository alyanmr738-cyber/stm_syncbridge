import { AdminShell, Panel } from "@/components/admin/shell";
import { listRecentEvents } from "@/services/events/inbox";

export default async function ActivityPage() {
  const events = await listRecentEvents(80);
  return (
    <AdminShell title="Sync activity" subtitle="Durable Jobber and GHL events.">
      <Panel>
        {events.length === 0 ? (
          <p className="text-sm text-[#657683]">No events stored yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#657683]">
                <th className="py-2">Kind</th>
                <th>Source</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[#eef1f3]">
                  <td className="py-2 font-medium">{e.eventKind}</td>
                  <td>{e.source}</td>
                  <td>{e.status}</td>
                  <td>{e.receivedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminShell>
  );
}
