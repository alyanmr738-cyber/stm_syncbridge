import { AdminShell, Panel, SettingsSubnav } from "@/components/admin/shell";
import { gateStatus } from "@/lib/config/feature-flags";

export default function ImportPage() {
  const gates = gateStatus();
  return (
    <AdminShell
      title="Historical import"
      subtitle="Dry-run matching only. Gate B is off — no backfill, no customer messages."
    >
      <SettingsSubnav />
      <Panel heading="Gate B">
        <p className="text-sm text-[#657683]">
          Historical import execute is{" "}
          <strong>{gates.historical_backfill ? "ENABLED" : "OFF"}</strong>. Open{" "}
          <a className="underline" href="/api/admin/import/dry-run">
            sample dry-run JSON
          </a>{" "}
          (admin session) for 50 Jobber × 100 GHL records.
        </p>
      </Panel>
    </AdminShell>
  );
}
