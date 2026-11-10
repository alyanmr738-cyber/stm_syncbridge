import { AdminShell, Panel } from "@/components/admin/shell";
import { getLastMockBookingResolution } from "@/services/workflows/booking";

export default function BookingsPage() {
  const last = getLastMockBookingResolution();
  return (
    <AdminShell title="Booking monitor">
      <Panel heading="Latest mock resolution">
        <pre className="overflow-x-auto rounded-lg bg-[#f6f8fa] p-3 text-xs">
          {last ? JSON.stringify(last, null, 2) : "No booking events processed yet."}
        </pre>
      </Panel>
    </AdminShell>
  );
}
