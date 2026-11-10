import {
  AdminShell,
  FlagRow,
  Panel,
  StatTile,
} from "@/components/admin/shell";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { featureFlagsSnapshot, gateStatus } from "@/lib/config/feature-flags";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { runCapabilityAudit } from "@/services/audit/capability-audit";

export default async function OverviewPage() {
  const flags = featureFlagsSnapshot();
  const gates = gateStatus();
  const scheduling = getSchedulingPolicy();
  const audit = await runCapabilityAudit();
  const gatesOn = Object.values(gates).filter(Boolean).length;
  const jobberTz = audit.businessTimezone.jobber ?? "pending";
  const ghlTz = audit.businessTimezone.ghl ?? "pending";

  return (
    <AdminShell
      title="Integration overview"
      subtitle="Monitor the Jobber ↔ HighLevel connection. Production writes and customer messaging stay off until separately approved."
    >
      <section className="grid gap-[15px] sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Connections"
          value={audit.mode === "mock" ? "0 / 2" : "—"}
          caption="Connect Jobber OAuth + GHL PIT"
        />
        <StatTile
          label="Audit mode"
          value={audit.mode}
          caption={`${audit.unsupportedOrUnverified.length} APIs unverified`}
        />
        <StatTile
          label="Approval gates"
          value={`${gatesOn}/3`}
          caption="Writes · backfill · messaging"
        />
        <StatTile
          label="Timezone"
          value={
            audit.businessTimezone.match === true
              ? "Match"
              : audit.businessTimezone.match === false
                ? "Check"
                : "—"
          }
          caption={`Jobber ${jobberTz} · GHL ${ghlTz}`}
        />
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ActivityFeed />
        <Panel heading="Sync controls" aside="Proposed defaults">
          <FlagRow label="Read-only connection checks" enabled={true} variant="available" />
          <FlagRow label="Jobber booking writes" enabled={gates.production_writes && flags.bookingSync} />
          <FlagRow label="Historical import" enabled={gates.historical_backfill} />
          <FlagRow label="Review workflow dispatch" enabled={gates.customer_messaging && flags.reviewTrigger} />
          <FlagRow label="AI notes sync" enabled={flags.aiSummarySync} />
          <div className="mt-4 rounded-[10px] border border-[#f6e2b0] bg-[#fff8e9] p-3 text-xs leading-relaxed text-[#685020]">
            Auto scheduling is{" "}
            <strong>{scheduling.autoSchedulingEnabled ? "on" : "off"}</strong>
            {scheduling.autoSchedulingEnabled
              ? "."
              : " until lead time and visit buffers are set. Bookings use pending Jobber confirmation when availability is unproven."}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel heading="Approval gates" aside="Independent">
          <FlagRow label="Gate A — production writes" enabled={gates.production_writes} />
          <FlagRow label="Gate B — historical backfill" enabled={gates.historical_backfill} />
          <FlagRow label="Gate C — customer messaging" enabled={gates.customer_messaging} />
          <FlagRow label="Master sync" enabled={flags.syncEnabled} />
        </Panel>
        <Panel heading="Scheduling policy" aside="Awaiting business input">
          <ul className="space-y-2 text-[13px] text-[#657683]">
            <li>
              Min booking lead:{" "}
              <strong className="text-[#192b36]">
                {scheduling.minBookingLeadTimeMinutes ?? "unset"}
              </strong>{" "}
              min
            </li>
            <li>
              Buffer between visits:{" "}
              <strong className="text-[#192b36]">
                {scheduling.visitBufferMinutes ?? "unset"}
              </strong>{" "}
              min
            </li>
            <li>
              Travel allowance:{" "}
              <strong className="text-[#192b36]">
                {scheduling.travelTimeAllowanceMinutes ?? "unset"}
              </strong>{" "}
              min
            </li>
            <li>
              Emergency auto-book:{" "}
              <strong className="text-[#192b36]">
                {scheduling.emergencyAutoBookEnabled ? "enabled" : "disabled"}
              </strong>
            </li>
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
