import { AdminShell, Panel } from "@/components/admin/shell";
import { listRecentEvents } from "@/services/events/inbox";

export default function ActivityPage() {
  const events = listRecentEvents(30);
  return (
    <AdminShell title="Sync activity">
      <Panel>
        {events.length === 0 ? (
          <p className="text-sm text-[#657683]">
            No events yet. Webhooks will appear here after ingestion (mock DB in
            dev).
          </p>
        ) : (
          <ul className="divide-y divide-[#eef1f3]">
            {events.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <span className="font-medium">{e.eventKind}</span>
                <span className="text-[#657683]"> · {e.source}</span>
                <div className="text-xs text-[#71808b]">Status: {e.status}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}
