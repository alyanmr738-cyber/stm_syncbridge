"use client";

import type { CapabilityAuditReport } from "@/services/audit/capability-audit";

export function CapabilityAuditView({
  initial,
}: {
  initial: CapabilityAuditReport;
}) {
  return (
    <AuditClient initial={initial} />
  );
}

function AuditClient({ initial }: { initial: CapabilityAuditReport }) {
  return (
    <div className="space-y-4 text-sm">
      <p>
        Generated: {initial.generatedAt} · Mode: <strong>{initial.mode}</strong>
      </p>
      <section>
        <h3 className="font-semibold">Business approvals pending</h3>
        <ul className="mt-2 list-disc pl-5 text-[#657683]">
          {initial.businessApprovalsPending.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold">Capability matrix</h3>
        <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-[#e1e8ec]">
          <table className="w-full text-xs">
            <thead className="bg-[#f6f8fa]">
              <tr>
                <th className="p-2 text-left">Operation</th>
                <th className="p-2 text-left">Provider</th>
                <th className="p-2 text-left">Verified</th>
                <th className="p-2 text-left">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {initial.matrix.map((row) => (
                <tr key={`${row.provider}-${row.operation}`} className="border-t">
                  <td className="p-2">{row.operation}</td>
                  <td className="p-2">{row.provider}</td>
                  <td className="p-2">{row.accountVerified ? "yes" : "no"}</td>
                  <td className="p-2">{row.fallback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="font-semibold">Recommended production path</h3>
        <ol className="mt-2 list-decimal pl-5 text-[#657683]">
          {initial.recommendedProductionPath.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
