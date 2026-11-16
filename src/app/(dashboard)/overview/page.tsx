import Link from "next/link";
import {
  AdminShell,
  FlagRow,
  Panel,
  StatTile,
} from "@/components/admin/shell";
import { ActivityFeed } from "@/components/admin/activity-feed";
import {
  connectionCounts,
  listConflicts,
  listFinance,
  listLinks,
  queueHealth,
} from "@/lib/db/admin-lists";
import { featureFlagsSnapshot, gateStatus } from "@/lib/config/feature-flags";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { runCapabilityAudit } from "@/services/audit/capability-audit";
import {
  enrichCustomers,
  enrichEvents,
  enrichFinance,
  enrichJobs,
} from "@/lib/display/enrich";
import {
  customerLinksWithOpenConflicts,
  loadCustomerSyncEvidence,
} from "@/lib/display/customer-ops";
import { operationalStats } from "@/lib/display/operational-stats";
import { getGhlPipelineStageMap } from "@/lib/ghl/pipeline-stages";
import { listRecentEvents } from "@/services/events/inbox";

export default async function OverviewPage() {
  const flags = featureFlagsSnapshot();
  const gates = gateStatus();
  const scheduling = getSchedulingPolicy();
  const [audit, counts, queue, links, finance, events, conflicts] = await Promise.all([
    runCapabilityAudit(),
    connectionCounts(),
    queueHealth(),
    listLinks(),
    listFinance(),
    listRecentEvents(80),
    listConflicts(),
  ]);
  const gatesOn = Object.values(gates).filter(Boolean).length;
  const stageNames = await getGhlPipelineStageMap();
  const syncEvidence = await loadCustomerSyncEvidence(links.customers);
  const conflictedCustomerLinkIds = customerLinksWithOpenConflicts(conflicts, links.customers);
  const customers = await enrichCustomers(links.customers, {
    conflictedCustomerLinkIds,
    syncEvidence,
  });
  const jobs = await enrichJobs(links.jobs, customers, { stageNames });
  const quotes = await enrichFinance(finance.quotes, "quote", customers);
  const invoices = await enrichFinance(finance.invoices, "invoice", customers);
  const eventViews = await enrichEvents(events, customers, jobs);
  const quarantined = events.filter((e) => /quarantine/i.test(e.error ?? "")).length;
  const stats = operationalStats({
    customers,
    jobs,
    quotes,
    invoices,
    events: eventViews,
    openConflicts: conflicts.filter((c) => c.state !== "resolved").length,
    quarantined,
    windowLabel: "Recent 80 durable events + current link tables",
  });

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
          label="Verified customer links"
          value={String(stats.verified)}
          caption={`${stats.unverified} unverified · ${stats.windowLabel}`}
        />
        <StatTile
          label="Jobs with GHL opportunities"
          value={`${stats.withOpp}/${stats.jobs}`}
          caption={`${stats.withoutOpp} missing opportunity · ${stats.missingCustomerLink} missing verified customer mapping`}
        />
        <StatTile
          label="Active vs archived jobs"
          value={`${stats.active}/${stats.archived}`}
          caption="Active uses last stored Jobber status; empty status is not counted active"
        />
        <StatTile
          label="Provider writes (window)"
          value={String(stats.writes)}
          caption={`${stats.noops} no-op/local · ${stats.suppressed} suppressed · historical succeeded ≠ write`}
        />
        <StatTile
          label="Queue"
          value={String(queue.pending)}
          caption={`leased ${queue.leased} · dead ${queue.deadLetter}`}
        />
        <StatTile
          label="Open conflicts / failures"
          value={`${stats.openConflicts}/${stats.failures}`}
          caption={`${stats.quarantined} quarantined historical events in this window`}
        />
        <StatTile
          label="Approval gates"
          value={`${gatesOn}/3`}
          caption="Writes · backfill · messaging"
        />
      </section>

      <p className="mt-4 flex flex-wrap gap-3 text-xs">
        <Link className="underline" href="/links?filter=needs_attention">
          Needs attention
        </Link>
        <Link className="underline" href="/links?filter=missing_ghl">
          Missing GHL opportunity
        </Link>
        <Link className="underline" href="/links?filter=unverified">
          Unverified customer
        </Link>
        <Link className="underline" href="/activity?filter=errors">
          Sync failures
        </Link>
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ActivityFeed />
        <Panel heading="Sync controls" aside="Gates remain OFF except authorized Gate A">
          <FlagRow label="Read-only connection checks" enabled={true} variant="available" />
          <FlagRow label="Jobber booking writes" enabled={gates.production_writes && flags.bookingSync} />
          <FlagRow label="Historical import" enabled={gates.historical_backfill} />
          <FlagRow label="Review workflow dispatch" enabled={gates.customer_messaging && flags.reviewTrigger} />
          <FlagRow label="AI notes sync" enabled={flags.aiSummarySync} />
          <div className="mt-4 rounded-[10px] border border-[#f6e2b0] bg-[#fff8e9] p-3 text-xs leading-relaxed text-[#685020]">
            Auto scheduling is{" "}
            <strong>{scheduling.autoSchedulingEnabled ? "on" : "off"}</strong>
            . Bookings use pending Jobber confirmation until availability is
            proven and buffers are set. Quotes and invoices remain Jobber/DB-only.
          </div>
          <p className="mt-3 text-[11px] text-[#71808b]">Audit mode: {audit.mode}</p>
        </Panel>
      </div>
    </AdminShell>
  );
}
