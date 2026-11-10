import { AdminShell, Panel } from "@/components/admin/shell";
import { listFinance, listLinks } from "@/lib/db/admin-lists";

export default async function LinksPage() {
  const { customers, jobs } = await listLinks();
  const { quotes, invoices } = await listFinance();
  return (
    <AdminShell
      title="Customer & job links"
      subtitle="Ambiguous matches stay here — no auto-merge."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel heading={`Customers (${customers.length})`}>
          <LinkTable
            rows={customers.map((c) => [
              c.jobber_client_id ?? "—",
              c.ghl_contact_id ?? "—",
              c.match_method,
            ])}
            heads={["Jobber client", "GHL contact", "Match"]}
          />
        </Panel>
        <Panel heading={`Jobs (${jobs.length})`}>
          <LinkTable
            rows={jobs.map((j) => [
              j.jobber_job_id ?? "—",
              j.ghl_opportunity_id ?? "—",
              j.last_job_status ?? "—",
            ])}
            heads={["Jobber job", "GHL opportunity", "Status"]}
          />
        </Panel>
        <Panel heading={`Quotes (${quotes.length})`}>
          <LinkTable
            rows={quotes.map((q) => [
              q.jobber_quote_id,
              q.last_status ?? "—",
              q.ghl_reference ? "GHL note" : "DB only",
            ])}
            heads={["Jobber quote", "Status", "GHL"]}
          />
        </Panel>
        <Panel heading={`Invoices (${invoices.length})`}>
          <LinkTable
            rows={invoices.map((inv) => [
              inv.jobber_invoice_id,
              inv.last_status ?? "—",
              inv.ghl_reference ? "GHL note" : "DB only",
            ])}
            heads={["Jobber invoice", "Status", "GHL"]}
          />
        </Panel>
      </div>
    </AdminShell>
  );
}

function LinkTable({
  rows,
  heads,
}: {
  rows: string[][];
  heads: string[];
}) {
  if (!rows.length) {
    return <p className="text-sm text-[#657683]">No links yet.</p>;
  }
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b text-[#657683]">
          {heads.map((h) => (
            <th key={h} className="py-2">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-[#eef1f3]">
            {r.map((c) => (
              <td key={c} className="py-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
