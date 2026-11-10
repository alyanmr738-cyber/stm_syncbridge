import { AdminShell, Panel } from "@/components/admin/shell";
import { listConflicts } from "@/lib/db/admin-lists";

export default async function ConflictsPage() {
  const rows = await listConflicts();
  return (
    <AdminShell
      title="Conflicts"
      subtitle="Ambiguous identity, Jobber rejections, pending bookings."
    >
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[#657683]">No open conflicts.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#657683]">
                <th className="py-2">Entity</th>
                <th>Reason</th>
                <th>State</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#eef1f3]">
                  <td className="py-2">{r.entity_type}</td>
                  <td>{r.reason}</td>
                  <td>{r.state}</td>
                  <td>{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminShell>
  );
}
