import { AdminShell, Panel } from "@/components/admin/shell";
import { listReviews } from "@/lib/db/admin-lists";

export default async function ReviewsPage() {
  const rows = await listReviews();
  return (
    <AdminShell
      title="Review ledger"
      subtitle="One authorization per Jobber job. Messaging gate C is off."
    >
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[#657683]">No review ledger rows yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#657683]">
                <th className="py-2">Jobber job</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#eef1f3]">
                  <td className="py-2">{r.jobber_job_id}</td>
                  <td>{r.status}</td>
                  <td>{r.failure_reason_redacted ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminShell>
  );
}
