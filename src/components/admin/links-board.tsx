"use client";

import Link from "next/link";
import { IdDetails } from "@/components/admin/id-details";
import { SearchableTable } from "@/components/admin/searchable-table";
import type { CustomerRowView, JobRowView } from "@/lib/display/enrich";

export function CustomersBoard({ rows }: { rows: CustomerRowView[] }) {
  return (
    <SearchableTable
      placeholder="Search customers by name, email mask, or ID"
      rows={rows.map((c) => ({
        id: c.id,
        haystack: `${c.jobberName} ${c.ghlName} ${c.jobberClientId} ${c.ghlContactId} ${c.matchMethod}`,
        node: (
          <tr key={c.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-2">
              <Link href={`/customers/${c.id}`} className="font-medium text-[#1d4654] underline">
                {c.jobberName}
              </Link>
              {c.namesDiffer ? (
                <div className="mt-1 text-[11px] text-[#8a5a12]">
                  GHL shows: {c.ghlName}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-[#657683]">{c.ghlName}</div>
              )}
              <IdDetails label="Jobber ID" value={c.jobberClientId} />
              <IdDetails label="GHL ID" value={c.ghlContactId} />
            </td>
            <td>{c.verified ? "Verified" : "Pending review"}</td>
            <td>
              {c.matchMethod.replace(/_/g, " ")}
              <div className="text-[11px] text-[#657683]">
                {[c.maskedEmail, c.maskedPhone].filter(Boolean).join(" · ") || "No contact mask"}
              </div>
            </td>
          </tr>
        ),
      }))}
      render={(filtered) => (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-[#657683]">
              <th className="py-2">Customer</th>
              <th>Status</th>
              <th>Match</th>
            </tr>
          </thead>
          <tbody>{filtered.map((r) => r.node)}</tbody>
        </table>
      )}
    />
  );
}

export function JobsBoard({ rows }: { rows: JobRowView[] }) {
  return (
    <SearchableTable
      placeholder="Search jobs by title, number, customer, or ID"
      rows={rows.map((j) => ({
        id: j.id,
        haystack: `${j.jobberTitle} ${j.jobNumber} ${j.customerName} ${j.opportunityTitle} ${j.jobberJobId} ${j.ghlOpportunityId}`,
        node: (
          <tr key={j.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-2">
              <div className="font-medium">{j.jobberTitle}</div>
              {j.customerLinkId ? (
                <Link href={`/customers/${j.customerLinkId}`} className="text-[11px] underline">
                  {j.customerName}
                </Link>
              ) : (
                <div className="text-[11px] text-[#657683]">{j.customerName}</div>
              )}
              <IdDetails label="Jobber job ID" value={j.jobberJobId} />
            </td>
            <td>
              {j.missingOpportunity ? (
                <span className="text-[#8a5a12]">No linked opportunity</span>
              ) : (
                j.opportunityTitle
              )}
              <IdDetails label="GHL opportunity ID" value={j.ghlOpportunityId} />
            </td>
            <td>{j.statusLabel}</td>
          </tr>
        ),
      }))}
      render={(filtered) => (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-[#657683]">
              <th className="py-2">Job</th>
              <th>Opportunity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>{filtered.map((r) => r.node)}</tbody>
        </table>
      )}
    />
  );
}

export function FinanceBoard({
  rows,
}: {
  rows: {
    id: string;
    providerId: string | null;
    title: string;
    customerName: string;
    customerLinkId: string | null;
    statusLabel: string;
    ghlSync: string;
  }[];
}) {
  return (
    <SearchableTable
      placeholder="Search by customer, number, or ID"
      rows={rows.map((r) => ({
        id: r.id,
        haystack: `${r.title} ${r.customerName} ${r.providerId} ${r.statusLabel}`,
        node: (
          <tr key={r.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-2">
              {r.customerLinkId ? (
                <Link href={`/customers/${r.customerLinkId}`} className="underline">
                  {r.customerName}
                </Link>
              ) : (
                r.customerName
              )}
            </td>
            <td>
              {r.title}
              <IdDetails label="Provider ID" value={r.providerId} />
            </td>
            <td>{r.statusLabel}</td>
            <td>{r.ghlSync}</td>
          </tr>
        ),
      }))}
      render={(filtered) => (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-[#657683]">
              <th className="py-2">Customer</th>
              <th>Record</th>
              <th>Status</th>
              <th>GHL</th>
            </tr>
          </thead>
          <tbody>{filtered.map((r) => r.node)}</tbody>
        </table>
      )}
    />
  );
}
