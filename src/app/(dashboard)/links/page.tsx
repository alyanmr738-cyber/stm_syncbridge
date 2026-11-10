import { AdminShell, Panel } from "@/components/admin/shell";

export default function LinksPage() {
  return (
    <AdminShell title="Customer & job links">
      <Panel>
        <p className="text-sm text-[#657683]">
          Identity matcher and link tables will populate after Phase 2 inventory.
          Ambiguous matches route here for admin review — no auto-merge.
        </p>
      </Panel>
    </AdminShell>
  );
}
