"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell, Panel } from "@/components/admin/shell";
import { IdDetails } from "@/components/admin/id-details";
import { SearchableTable } from "@/components/admin/searchable-table";

type CustomerView = {
  id: string;
  jobberClientId: string | null;
  ghlContactId: string | null;
  verified: boolean;
  matchMethod: string;
  jobberName: string;
  ghlName: string;
  namesDiffer: boolean;
  maskedEmail: string | null;
  maskedPhone: string | null;
};

type ProposalView = {
  id: string;
  bucket: string;
  status: string;
  jobber_id: string | null;
  ghl_id: string | null;
  reason: string | null;
  jobberName: string;
  ghlName: string;
  namesDiffer: boolean;
  maskedEmail: string | null;
  maskedPhone: string | null;
  canAccept: boolean;
};

type Payload = {
  counts: Record<string, number>;
  policy: Record<string, unknown>;
  verified: CustomerView[];
  pending: CustomerView[];
  proposals: ProposalView[];
  conflicts: { id: string; reason: string; state: string; source_entity_id?: string }[];
};

export default function MatchingPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [jobs, setJobs] = useState<Record<string, unknown> | null>(null);
  const [jobReconcile, setJobReconcile] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const m = await fetch("/api/admin/matching").then((r) => r.json());
    setData(m);
    fetch("/api/admin/jobs/candidates")
      .then((r) => r.json())
      .then((j) => setJobs(j))
      .catch(() => setJobs({ error: "candidates unavailable" }));
    fetch("/api/admin/jobs/reconcile")
      .then((r) => r.json())
      .then((j) => setJobReconcile(j))
      .catch(() => setJobReconcile({ error: "reconcile unavailable" }));
  }

  useEffect(() => {
    void load();
  }, []);

  async function persistJobProposals(live: boolean) {
    if (
      !window.confirm(
        "Store job relationship proposals in the database? This does NOT apply job_links mutations."
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/jobs/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true, persist: true, liveOpportunityScan: live }),
    });
    setMsg(JSON.stringify(await res.json()));
    await load();
  }

  async function refresh(persist: boolean) {
    if (
      !window.confirm(
        persist
          ? "Revalidate pending links live and store suggested proposals? This will not verify customer_links."
          : "Revalidate pending links live without storing?"
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/matching/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true, persist }),
    });
    setMsg(JSON.stringify(await res.json()));
    await load();
  }

  async function decide(proposalId: string, action: "accept" | "reject") {
    if (
      !window.confirm(
        `Confirm ${action}? Names matching is not enough. Email-only and phone-only cannot be verified here.`
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/matching/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId, action, confirm: true }),
    });
    setMsg(JSON.stringify(await res.json()));
    await load();
  }

  return (
    <AdminShell
      title="Matching & conflict review"
      subtitle="Review names and evidence. Accept never runs from name match alone."
    >
      {msg ? <p className="mb-3 text-xs text-[#1d4654]">{msg}</p> : null}
      <div className="mb-4 space-x-3 text-sm">
        <button className="underline" onClick={() => void refresh(false)}>
          Live revalidate (no store)
        </button>
        <button className="underline" onClick={() => void refresh(true)}>
          Store suggested proposals
        </button>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        {Object.entries(data?.counts ?? {}).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-[#e1e8ec] bg-white p-3 text-sm">
            <div className="text-[11px] uppercase text-[#657683]">{k}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <Panel heading="Suggested proposals">
        {!data?.proposals?.length ? (
          <p className="text-sm text-[#657683]">No stored proposals.</p>
        ) : (
          <SearchableTable
            placeholder="Search proposals by customer name or ID"
            rows={data.proposals.map((p) => ({
              id: p.id,
              haystack: `${p.jobberName} ${p.ghlName} ${p.jobber_id} ${p.ghl_id} ${p.bucket} ${p.reason}`,
              node: (
                <tr key={p.id} className="border-b border-[#eef1f3] align-top">
                  <td className="py-2">
                    <div className="font-medium">{p.jobberName}</div>
                    {p.namesDiffer ? (
                      <div className="text-[11px] text-[#8a5a12]">GHL: {p.ghlName}</div>
                    ) : (
                      <div className="text-[11px] text-[#657683]">{p.ghlName}</div>
                    )}
                    <div className="text-[11px] text-[#657683]">
                      {[p.maskedEmail, p.maskedPhone].filter(Boolean).join(" · ")}
                    </div>
                    <IdDetails label="Jobber ID" value={p.jobber_id} />
                    <IdDetails label="GHL ID" value={p.ghl_id} />
                  </td>
                  <td>
                    {p.bucket.replace(/_/g, " ")}
                    <div className="text-[11px] text-[#657683]">{p.reason}</div>
                  </td>
                  <td>{p.status}</td>
                  <td className="space-x-2">
                    {p.status === "suggested" ? (
                      <>
                        <button className="underline" onClick={() => void decide(p.id, "accept")}>
                          Accept
                        </button>
                        <button className="underline" onClick={() => void decide(p.id, "reject")}>
                          Reject
                        </button>
                        {!p.canAccept ? (
                          <div className="mt-1 text-[11px] text-[#8a5a12]">Review only — cannot auto-verify</div>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                </tr>
              ),
            }))}
            render={(filtered) => (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[#657683]">
                    <th className="py-2">People</th>
                    <th>Evidence</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{filtered.map((r) => r.node)}</tbody>
              </table>
            )}
          />
        )}
      </Panel>
      <Panel heading="Pending customer links">
        <PeopleMini rows={data?.pending ?? []} />
      </Panel>
      <Panel heading="Verified sample">
        <PeopleMini rows={data?.verified ?? []} />
      </Panel>
      <Panel heading="Open customer conflicts">
        {(data?.conflicts ?? []).length === 0 ? (
          <p className="text-sm text-[#657683]">None.</p>
        ) : (
          <ul className="text-xs">
            {(data?.conflicts ?? []).map((c) => (
              <li key={c.id}>
                {c.reason.replace(/_/g, " ")} — {c.state}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel heading="Job ↔ opportunity candidates (read-only)">
        <pre className="overflow-auto text-[11px]">{JSON.stringify(jobs?.counts ?? jobs, null, 2)}</pre>
      </Panel>
      <Panel heading="Job relationship reconciliation (database proposals only)">
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => persistJobProposals(false)}
          >
            Persist proposals (labels only)
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => persistJobProposals(true)}
          >
            Persist with live GHL opportunity scan
          </button>
        </div>
        <pre className="overflow-auto text-[11px]">
          {JSON.stringify(jobReconcile?.counts ?? jobReconcile, null, 2)}
        </pre>
      </Panel>
    </AdminShell>
  );
}

function PeopleMini({ rows }: { rows: CustomerView[] }) {
  if (!rows.length) return <p className="text-sm text-[#657683]">None.</p>;
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b text-[#657683]">
          <th className="py-2">Jobber</th>
          <th>GHL</th>
          <th>Method</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 80).map((r) => (
          <tr key={r.id} className="border-b border-[#eef1f3] align-top">
            <td className="py-2">
              <Link href={`/customers/${r.id}`} className="underline">
                {r.jobberName}
              </Link>
              <IdDetails label="Jobber ID" value={r.jobberClientId} />
            </td>
            <td>
              {r.ghlName}
              {r.namesDiffer ? <div className="text-[11px] text-[#8a5a12]">Names differ</div> : null}
              <IdDetails label="GHL ID" value={r.ghlContactId} />
            </td>
            <td>{r.matchMethod.replace(/_/g, " ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
