"use client";

import { useEffect, useMemo, useState } from "react";
import { RetryButton } from "@/components/admin/retry-button";
import { IdDetails } from "@/components/admin/id-details";
import { SearchableTable } from "@/components/admin/searchable-table";
import type { ProcessOutcome } from "@/lib/display/process-outcome";

export type ActivityRow = {
  id: string;
  eventKind: string;
  source: string;
  status: string;
  error: string | null;
  receivedAt: string;
  providerEntityId?: string | null;
  subject?: string | null;
  outcome?: ProcessOutcome;
  outcomeLabel?: string;
  providerWrite?: boolean | null;
  receivedLabel?: string;
  processedLabel?: string;
  customerLinkId?: string | null;
};

const FILTERS: { id: string; label: string; match: (r: ActivityRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "writes", label: "Actual writes", match: (r) => r.outcome === "provider_write" },
  {
    id: "noop",
    label: "No-ops",
    match: (r) => r.outcome === "no_change" || r.outcome === "local_state_only",
  },
  { id: "suppressed", label: "Suppressed", match: (r) => r.outcome === "suppressed_feature" },
  {
    id: "errors",
    label: "Errors",
    match: (r) =>
      r.outcome === "failed" || r.outcome === "dead_letter" || r.outcome === "retrying",
  },
  {
    id: "attention",
    label: "Needs attention",
    match: (r) =>
      r.outcome === "blocked_unverified" ||
      r.outcome === "failed" ||
      r.outcome === "dead_letter" ||
      r.outcome === "retrying",
  },
];

const ALLOWED_FILTERS = new Set(FILTERS.map((f) => f.id));

export function ActivityBoard({
  rows,
  initialFilter,
}: {
  rows: ActivityRow[];
  initialFilter?: string;
}) {
  const [filter, setFilter] = useState(() =>
    initialFilter && ALLOWED_FILTERS.has(initialFilter) ? initialFilter : "all"
  );
  useEffect(() => {
    if (initialFilter && ALLOWED_FILTERS.has(initialFilter)) setFilter(initialFilter);
  }, [initialFilter]);
  const visible = useMemo(
    () => rows.filter(FILTERS.find((f) => f.id === filter)?.match ?? (() => true)),
    [rows, filter]
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              filter === f.id
                ? "border-[#1d4654] bg-[#1d4654] text-white"
                : "border-[#e1e8ec] text-[#657683]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <SearchableTable
        placeholder="Search activity by customer, job, kind, or ID"
        rows={visible.map((e) => ({
          id: e.id,
          haystack: `${e.eventKind} ${e.source} ${e.status} ${e.outcomeLabel ?? ""} ${e.subject ?? ""} ${e.providerEntityId ?? ""} ${e.error ?? ""}`,
          node: (
            <tr key={e.id} className="border-b border-[#eef1f3] align-top">
              <td className="py-3 pr-3 font-medium">
                {e.eventKind}
                {e.subject ? (
                  <div className="text-[11px] font-normal text-[#1d4654]">{e.subject}</div>
                ) : null}
                <details className="mt-1 text-[11px] font-normal text-[#657683]">
                  <summary className="cursor-pointer">Evidence</summary>
                  <div className="mt-1 space-y-1">
                    <div>Source → destination: {e.source}</div>
                    <div>Received: {e.receivedLabel ?? e.receivedAt}</div>
                    <div>Processed: {e.processedLabel ?? "—"}</div>
                    <div>
                      Provider write:{" "}
                      {e.providerWrite === true
                        ? "Yes"
                        : e.providerWrite === false
                          ? "No"
                          : "Write outcome not recorded"}
                    </div>
                    <div>Reason: {e.error ?? e.outcomeLabel ?? "—"}</div>
                    <IdDetails
                      label="Correlation / event ID"
                      value={`${e.id}${e.providerEntityId ? ` · ${e.providerEntityId}` : ""}`}
                    />
                  </div>
                </details>
              </td>
              <td className="py-3 pr-3">{e.source}</td>
              <td className="py-3 pr-3">{e.outcomeLabel ?? e.status}</td>
              <td className="max-w-[220px] py-3 pr-3 text-[#657683]">{e.error ?? "—"}</td>
              <td className="py-3 pr-3">{e.receivedLabel ?? e.receivedAt}</td>
              <td className="py-3">
                {(e.status === "dead_letter" || e.status === "retrying") && (
                  <RetryButton eventId={e.id} />
                )}
              </td>
            </tr>
          ),
        }))}
        render={(filtered) => (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#657683]">
                <th className="py-2">Event</th>
                <th>Source</th>
                <th>Outcome</th>
                <th>Why / error</th>
                <th>Received</th>
                <th></th>
              </tr>
            </thead>
            <tbody>{filtered.map((r) => r.node)}</tbody>
          </table>
        )}
      />
    </div>
  );
}
