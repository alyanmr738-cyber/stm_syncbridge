import { AdminShell, Panel } from "@/components/admin/shell";

export default function ConflictsPage() {
  return (
    <AdminShell title="Conflicts">
      <Panel>
        <p className="text-sm text-[#657683]">
          GHL-only edits that Jobber rejects appear here. Jobber values are
          re-synced to GHL without loops.
        </p>
      </Panel>
    </AdminShell>
  );
}
