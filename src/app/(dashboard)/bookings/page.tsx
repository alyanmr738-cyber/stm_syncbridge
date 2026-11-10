import { AdminShell, Panel } from "@/components/admin/shell";
import { listBookings } from "@/lib/db/admin-lists";

export default async function BookingsPage() {
  const rows = await listBookings();
  return (
    <AdminShell
      title="Booking monitor"
      subtitle="Requested vs Jobber-confirmed. Unverified slots stay pending."
    >
      <Panel>
        {rows.length === 0 ? (
          <p className="text-sm text-[#657683]">No appointment links yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#657683]">
                <th className="py-2">State</th>
                <th>GHL appointment</th>
                <th>Jobber visit</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#eef1f3]">
                  <td className="py-2 font-medium">{r.booking_state}</td>
                  <td>{r.ghl_appointment_id ?? "—"}</td>
                  <td>{r.jobber_visit_id ?? "—"}</td>
                  <td>{r.requested_start_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminShell>
  );
}
