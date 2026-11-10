import { AdminShell, Panel } from "@/components/admin/shell";

export default function ReviewsPage() {
  return (
    <AdminShell title="Review ledger">
      <Panel>
        <p className="text-sm text-[#657683]">
          One review authorization per completed Jobber job (repeat customers
          allowed per job). Customer messaging gate must be ON before dispatch —
          currently disabled.
        </p>
      </Panel>
    </AdminShell>
  );
}
