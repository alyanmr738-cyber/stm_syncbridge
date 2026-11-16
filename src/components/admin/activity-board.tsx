"use client";

import { RetryButton } from "@/components/admin/retry-button";
import { IdDetails } from "@/components/admin/id-details";
import { SearchableTable } from "@/components/admin/searchable-table";

export type ActivityRow = {
  id: string;
  eventKind: string;
  source: string;
  status: string;
  error: string | null;
  receivedAt: string;
  providerEntityId?: string | null;
  subject?: string | null;
};

export function ActivityBoard({ rows }: { rows: ActivityRow[] }) {
  return (
    <SearchableTable
      placeholder="Search activity by customer, job, kind, or ID"
      rows={rows.map((e) => ({
        id: e.id,
        haystack: `${e.eventKind} ${e.source} ${e.status} ${e.subject ?? ""} ${e.providerEntityId ?? ""} ${e.error ?? ""}`,
        node: (
          <tr key={e.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-2 font-medium">
              {e.eventKind}
              {e.subject ? (
                <div className="text-[11px] font-normal text-[#1d4654]">{e.subject}</div>
              ) : null}
              <IdDetails
                label="Event / entity IDs"
                value={`${e.id}${e.providerEntityId ? ` · ${e.providerEntityId}` : ""}`}
              />
            </td>
            <td>{e.source}</td>
            <td>{e.status}</td>
            <td className="max-w-[220px] truncate text-[#657683]">{e.error ?? "—"}</td>
            <td>{e.receivedAt}</td>
            <td>
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
              <th>Status</th>
              <th>Why / error</th>
              <th>Received</th>
              <th></th>
            </tr>
          </thead>
          <tbody>{filtered.map((r) => r.node)}</tbody>
        </table>
      )}
    />
  );
}
