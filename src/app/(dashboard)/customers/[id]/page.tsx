import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell, Panel } from "@/components/admin/shell";
import { IdDetails } from "@/components/admin/id-details";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { listFinance } from "@/lib/db/admin-lists";
import { enrichCustomers, enrichEvents, enrichFinance, enrichJobs } from "@/lib/display/enrich";
import { listRecentEvents } from "@/services/events/inbox";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) notFound();
  const { data: row } = await supabase
    .from("customer_links")
    .select(
      "id, jobber_client_id, ghl_contact_id, verified, match_method, last_jobber_revision, last_ghl_revision, last_synced_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const [views] = [await enrichCustomers([row])];
  const customer = views[0]!;
  const { data: jobs } = await supabase
    .from("job_links")
    .select("id, jobber_job_id, ghl_opportunity_id, last_job_status, customer_link_id")
    .eq("customer_link_id", id)
    .limit(100);
  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: visits } = jobIds.length
    ? await supabase
        .from("appointment_links")
        .select("id, ghl_appointment_id, jobber_visit_id, booking_state, requested_start_at, job_link_id")
        .in("job_link_id", jobIds)
        .limit(50)
    : { data: [] };
  const jobViews = await enrichJobs(jobs ?? [], views);
  const { quotes, invoices } = await listFinance();
  const quoteViews = (await enrichFinance(quotes, "quote", views)).filter(
    (q) => q.customerLinkId === id
  );
  const invoiceViews = (await enrichFinance(invoices, "invoice", views)).filter(
    (q) => q.customerLinkId === id
  );
  const events = await listRecentEvents(80);
  const history = (await enrichEvents(events, views, jobViews)).filter(
    (e) =>
      e.customerLinkId === id ||
      e.providerEntityId === customer.jobberClientId ||
      e.providerEntityId === customer.ghlContactId
  );
  const { data: conflicts } = await supabase
    .from("sync_conflicts")
    .select("id, reason, state, created_at, source_entity_id")
    .or(
      `source_entity_id.eq.${customer.jobberClientId ?? "none"},source_entity_id.eq.${customer.ghlContactId ?? "none"}`
    )
    .limit(50);

  return (
    <AdminShell
      title={customer.jobberName}
      subtitle={customer.verified ? "Verified customer link" : "Pending identity review"}
    >
      <p className="mb-4 text-sm">
        <Link href="/links" className="underline">
          Back to customers
        </Link>
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel heading="Connections">
          <p className="text-sm">
            Jobber: {customer.jobberName}
            {customer.namesDiffer ? (
              <span className="block text-[#8a5a12]">GHL name: {customer.ghlName}</span>
            ) : (
              <span className="block text-[#657683]">GHL: {customer.ghlName}</span>
            )}
          </p>
          <p className="mt-2 text-xs text-[#657683]">
            {customer.matchMethod.replace(/_/g, " ")} · {[customer.maskedEmail, customer.maskedPhone].filter(Boolean).join(" · ")}
          </p>
          <IdDetails label="Jobber client ID" value={customer.jobberClientId} />
          <IdDetails label="GHL contact ID" value={customer.ghlContactId} />
        </Panel>
        <Panel heading={`Jobs (${jobViews.length})`}>
          {jobViews.length === 0 ? (
            <p className="text-sm text-[#657683]">No jobs linked to this customer row.</p>
          ) : (
            <ul className="text-sm">
              {jobViews.map((j) => (
                <li key={j.id}>
                  {j.jobberTitle} · {j.statusLabel}
                  {j.missingOpportunity ? " · no opportunity" : ` · ${j.opportunityTitle}`}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel heading="Visits / bookings">
          {(visits ?? []).length === 0 ? (
            <p className="text-sm text-[#657683]">No appointment rows.</p>
          ) : (
            <ul className="text-xs">
              {(visits ?? []).slice(0, 15).map((v) => (
                <li key={v.id}>
                  {v.booking_state} · {v.requested_start_at ?? "no requested time"}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel heading="Quotes & invoices">
          <p className="text-xs text-[#657683]">GHL column means database notes only unless a GHL note id exists.</p>
          <ul className="mt-2 text-sm">
            {quoteViews.map((q) => (
              <li key={q.id}>
                {q.title} · {q.statusLabel} · {q.ghlSync}
              </li>
            ))}
            {invoiceViews.map((q) => (
              <li key={q.id}>
                {q.title} · {q.statusLabel} · {q.ghlSync}
              </li>
            ))}
            {quoteViews.length + invoiceViews.length === 0 ? <li>None on this link.</li> : null}
          </ul>
        </Panel>
        <Panel heading="Sync history">
          {history.length === 0 ? (
            <p className="text-sm text-[#657683]">No recent events for this identity.</p>
          ) : (
            <ul className="text-xs">
              {history.map((e) => (
                <li key={e.id}>
                  {e.eventKind} · {e.status} · {e.receivedAt}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel heading="Conflicts">
          {(conflicts ?? []).length === 0 ? (
            <p className="text-sm text-[#657683]">None.</p>
          ) : (
            <ul className="text-xs">
              {(conflicts ?? []).map((c) => (
                <li key={c.id}>
                  {c.reason} · {c.state}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
