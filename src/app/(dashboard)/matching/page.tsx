"use client";

import { useEffect, useState } from "react";
import { AdminShell, Panel } from "@/components/admin/shell";

type Payload = {
  counts: Record<string, number>;
  policy: Record<string, unknown>;
  verified: { id: string; jobber_client_id: string; ghl_contact_id: string; match_method: string }[];
  pending: { id: string; jobber_client_id: string; ghl_contact_id: string; match_method: string }[];
  proposals: {
    id: string;
    bucket: string;
    status: string;
    jobber_id: string | null;
    ghl_id: string | null;
    reason: string | null;
  }[];
  conflicts: { id: string; reason: string; state: string }[];
};

export default function MatchingPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [jobs, setJobs] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const [m, j] = await Promise.all([
      fetch("/api/admin/matching").then((r) => r.json()),
      fetch("/api/admin/jobs/candidates").then((r) => r.json()),
    ]);
    setData(m);
    setJobs(j);
  }

  useEffect(() => {
    void load();
  }, []);

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
    if (!window.confirm(`Confirm ${action} for proposal ${proposalId}? This never auto-links email-only or phone-only.`)) {
      return;
    }
    const res = await fetch("/api/admin/matching/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId, action, confirm: true }),
    });
    const body = await res.json();
    setMsg(JSON.stringify(body));
    await load();
  }

  return (
    <AdminShell
      title="Matching & conflict review"
      subtitle="Candidates only. Email-only / phone-only never become verified from this screen. Batch B is not applied."
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
          <p className="text-sm text-[#657683]">No stored proposals. Seed via SQL after review; none auto-verify.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-[#657683]">
                <th className="py-2">Bucket</th>
                <th>Jobber</th>
                <th>GHL</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.proposals.map((p) => (
                <tr key={p.id} className="border-b border-[#eef1f3]">
                  <td className="py-2">{p.bucket}</td>
                  <td className="max-w-[140px] truncate">{p.jobber_id}</td>
                  <td className="max-w-[140px] truncate">{p.ghl_id}</td>
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
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel heading="Pending customer_links (not verified)">
        <LinkMini rows={data?.pending ?? []} />
      </Panel>
      <Panel heading="Verified (read-only sample)">
        <LinkMini rows={data?.verified ?? []} />
      </Panel>
      <Panel heading="Open customer conflicts">
        {(data?.conflicts ?? []).length === 0 ? (
          <p className="text-sm text-[#657683]">None.</p>
        ) : (
          <ul className="text-xs">
            {(data?.conflicts ?? []).map((c) => (
              <li key={c.id}>
                {c.reason} — {c.state}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel heading="Job ↔ opportunity candidates (read-only)">
        <pre className="overflow-auto text-[11px]">{JSON.stringify(jobs, null, 2)}</pre>
      </Panel>
    </AdminShell>
  );
}

function LinkMini({
  rows,
}: {
  rows: { id: string; jobber_client_id: string; ghl_contact_id: string; match_method: string }[];
}) {
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
          <tr key={r.id} className="border-b border-[#eef1f3]">
            <td className="max-w-[180px] truncate py-2">{r.jobber_client_id}</td>
            <td className="max-w-[140px] truncate">{r.ghl_contact_id}</td>
            <td>{r.match_method}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
