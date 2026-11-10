import { AdminShell, Panel, SettingsSubnav } from "@/components/admin/shell";
import { CapabilityAuditView } from "@/components/admin/capability-audit-view";
import { runCapabilityAudit } from "@/services/audit/capability-audit";

export default async function AuditSettingsPage() {
  const initial = await runCapabilityAudit();
  return (
    <AdminShell title="Capability audit" subtitle="Verified APIs, fallbacks, and remaining business approvals.">
      <SettingsSubnav />
      <Panel>
        <p className="mb-4 text-sm text-[#657683]">
          Feeds docs/API_CAPABILITY_REPORT.md. Re-run after Jobber OAuth or GHL
          PIT is configured.
        </p>
        <CapabilityAuditView initial={initial} />
      </Panel>
    </AdminShell>
  );
}
