import {
  AdminShell,
  FlagRow,
  Panel,
  StatTile,
} from "@/components/admin/shell";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { connectionCounts, queueHealth } from "@/lib/db/admin-lists";
import { featureFlagsSnapshot, gateStatus } from "@/lib/config/feature-flags";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { runCapabilityAudit } from "@/services/audit/capability-audit";

export default async function OverviewPage() {
  const flags = featureFlagsSnapshot();
  const gates = gateStatus();
  const scheduling = getSchedulingPolicy();
  const [audit, counts, queue] = await Promise.all([
    runCapabilityAudit(),
    connectionCounts(),
    queueHealth(),
  ]);
  const gatesOn = Object.values(gates).filter(Boolean).length;

  return (
    <AdminShell
      title="Integration overview"
      subtitle="Jobber ↔ HighLevel. Production writes, backfill, and customer messaging stay off until separately approved."
    >
      <section className="grid gap-[15px] sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Connections"
          value={`${counts.connected} / ${counts.total}`}
          caption={
            counts.jobber.accountName
              ? `${counts.jobber.accountName} · GHL ${counts.ghl.ok ? "ok" : "down"}`
              : "Connect remaining providers"
          }
        />
        <StatTile
          label="Audit mode"
          value={audit.mode}
          caption={`${audit.unsupportedOrUnverified.length} APIs still unverified`}
        />
        <StatTile
          label="Queue"
          value={String(queue.pending)}
          caption={`leased ${queue.leased} · dead ${queue.deadLetter}`}
        />
        <StatTile
          label="Approval gates"
          value={`${gatesOn}/3`}
          caption="Writes · backfill · messaging"
        />
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ActivityFeed />
        <Panel heading="Sync controls" aside="Gates remain OFF">
          <FlagRow label="Read-only connection checks" enabled={true} variant="available" />
          <FlagRow label="Jobber booking writes" enabled={gates.production_writes && flags.bookingSync} />
          <FlagRow label="Historical import" enabled={gates.historical_backfill} />
          <FlagRow label="Review workflow dispatch" enabled={gates.customer_messaging && flags.reviewTrigger} />
          <FlagRow label="AI notes sync" enabled={flags.aiSummarySync} />
          <div className="mt-4 rounded-[10px] border border-[#f6e2b0] bg-[#fff8e9] p-3 text-xs leading-relaxed text-[#685020]">
            Auto scheduling is{" "}
            <strong>{scheduling.autoSchedulingEnabled ? "on" : "off"}</strong>
            . Bookings use pending Jobber confirmation until availability is
            proven and buffers are set.
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
