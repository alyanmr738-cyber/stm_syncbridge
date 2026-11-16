"use client";

import Link from "next/link";
import { IdDetails } from "@/components/admin/id-details";
import { SearchableTable } from "@/components/admin/searchable-table";
import type { CustomerRowView, FinanceRowView, JobRowView } from "@/lib/display/enrich";

function statusBadge(status: CustomerRowView["relationshipStatus"]) {
  const map = {
    verified: "Verified",
    pending: "Pending",
    rejected: "Rejected",
    conflicted: "Conflicted",
  };
  return map[status];
}

export function CustomersBoard({ rows }: { rows: CustomerRowView[] }) {
  return (
    <SearchableTable
      placeholder="Search customers by name, email mask, or ID"
      rows={rows.map((c) => ({
        id: c.id,
        haystack: `${c.jobberName} ${c.ghlName} ${c.jobberClientId} ${c.ghlContactId} ${c.matchMethod} ${c.relationshipStatus}`,
        node: (
          <tr key={c.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-3 pr-3">
              <Link href={`/customers/${c.id}`} className="font-medium text-[#1d4654] underline">
                {c.jobberName}
              </Link>
              {c.namesDiffer ? (
                <div className="mt-1 text-[11px] text-[#8a5a12]">
                  Identity difference — Jobber: {c.jobberName} · GHL: {c.ghlName}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-[#657683]">GHL: {c.ghlName}</div>
              )}
              <IdDetails label="Jobber ID" value={c.jobberClientId} />
              <IdDetails label="GHL ID" value={c.ghlContactId} />
            </td>
            <td className="py-3 pr-3">
              {statusBadge(c.relationshipStatus)}
              {c.blocker ? <div className="mt-1 text-[11px] text-[#8a5a12]">{c.blocker}</div> : null}
            </td>
            <td className="py-3 pr-3">
              {c.matchMethod.replace(/_/g, " ")}
              <div className="text-[11px] text-[#657683]">
                {[c.maskedEmail, c.maskedPhone].filter(Boolean).join(" · ") || "No contact mask"}
              </div>
            </td>
            <td className="py-3 pr-3">{c.jobCount}</td>
            <td className="py-3 text-[11px] text-[#657683]">
              <div>{c.lastAttempt}</div>
              <div className="mt-1">{c.lastProviderWrite}</div>
            </td>
          </tr>
        ),
      }))}
      render={(filtered) => (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-[#657683]">
              <th className="py-2">Customer</th>
              <th>Relationship</th>
              <th>Matching evidence</th>
              <th>Jobs</th>
              <th>Last attempt</th>
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
        haystack: `${j.jobberTitle} ${j.jobNumber} ${j.jobberCustomerName} ${j.opportunityTitle} ${j.jobberJobId} ${j.ghlOpportunityId} ${j.customerLinkStatus}`,
        node: (
          <tr key={j.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-3 pr-3">
              <Link href={`/jobs/${j.id}`} className="font-medium text-[#1d4654] underline">
                {j.jobberTitle}
              </Link>
              {j.jobNumber ? (
                <div className="text-[11px] text-[#657683]">Job #{j.jobNumber}</div>
              ) : null}
              <IdDetails label="Jobber job ID" value={j.jobberJobId} />
            </td>
            <td className="py-3 pr-3">
              {j.customerLinkId ? (
                <Link href={`/customers/${j.customerLinkId}`} className="underline">
                  {j.jobberCustomerName}
                </Link>
              ) : (
                <div>{j.jobberCustomerName}</div>
              )}
              <div className="mt-1 text-[11px] text-[#657683]">
                {j.customerLinkStatus === "verified"
                  ? "Verified SyncBridge customer mapping"
                  : j.customerLinkStatus === "unverified"
                    ? "Customer known in Jobber, but no verified GHL customer mapping"
                    : j.jobberCustomerSource === "jobber_job"
                      ? "Customer known in Jobber, but no verified GHL customer mapping"
                      : "Jobber customer unresolved"}
              </div>
            </td>
            <td className="py-3 pr-3">
              {j.opportunityLinkStatus === "none" ? (
                <span className="text-[#8a5a12]">No linked GHL opportunity</span>
              ) : (
                j.opportunityTitle
              )}
              <IdDetails label="GHL opportunity ID" value={j.ghlOpportunityId} />
            </td>
            <td className="py-3 pr-3">{j.statusLabel}</td>
            <td className="py-3 text-[11px]">
              {j.blocker ? <div className="text-[#8a5a12]">{j.blocker}</div> : null}
              <div className="text-[#657683]">{j.nextAction}</div>
            </td>
          </tr>
        ),
      }))}
      render={(filtered) => (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-[#657683]">
              <th className="py-2">Job</th>
              <th>Jobber customer</th>
              <th>GHL opportunity</th>
              <th>Jobber status</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>{filtered.map((r) => r.node)}</tbody>
        </table>
      )}
    />
  );
}

export function FinanceBoard({ rows }: { rows: FinanceRowView[] }) {
  return (
    <SearchableTable
      placeholder="Search by customer, number, or ID"
      rows={rows.map((r) => ({
        id: r.id,
        haystack: `${r.title} ${r.customerName} ${r.providerId} ${r.statusLabel} ${r.customerResolution}`,
        node: (
          <tr key={r.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-3 pr-3">
              {r.customerLinkId ? (
                <Link href={`/customers/${r.customerLinkId}`} className="underline">
                  {r.customerName}
                </Link>
              ) : (
                r.customerName
              )}
              <div className="mt-1 text-[11px] text-[#657683]">
                {r.customerResolution.replace(/_/g, " ")}
              </div>
            </td>
            <td className="py-3 pr-3">
              {r.title}
              <IdDetails label="Provider ID" value={r.providerId} />
            </td>
            <td className="py-3 pr-3">{r.statusLabel}</td>
            <td className="py-3">{r.ghlSync}</td>
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
