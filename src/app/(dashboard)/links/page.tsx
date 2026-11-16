import Link from "next/link";
import { AdminShell, Panel } from "@/components/admin/shell";
import { CustomersBoard, FinanceBoard, JobsBoard } from "@/components/admin/links-board";
import { listConflicts, listFinance, listLinks } from "@/lib/db/admin-lists";
import {
  customerLinksWithOpenConflicts,
  jobCountByCustomerLink,
  loadCustomerSyncEvidence,
} from "@/lib/display/customer-ops";
import { enrichCustomers, enrichFinance, enrichJobs } from "@/lib/display/enrich";
import { getGhlPipelineStageMap } from "@/lib/ghl/pipeline-stages";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const { customers, jobs } = await listLinks();
  const { quotes, invoices } = await listFinance();
  const [conflicts, stageNames, syncEvidence] = await Promise.all([
    listConflicts(),
    getGhlPipelineStageMap(),
    loadCustomerSyncEvidence(customers),
  ]);
  const conflictedCustomerLinkIds = customerLinksWithOpenConflicts(conflicts, customers);
  const customerViews = await enrichCustomers(customers, {
    conflictedCustomerLinkIds,
    syncEvidence,
  });
  const jobViewsAll = await enrichJobs(jobs, customerViews, { stageNames });
  const jobCounts = jobCountByCustomerLink(customers, jobViewsAll);
  const customerViewsCounted = customerViews.map((c) => ({
    ...c,
    jobCount: jobCounts.get(c.id) ?? 0,
  }));
  const quoteViews = await enrichFinance(quotes, "quote", customerViewsCounted);
  const invoiceViews = await enrichFinance(invoices, "invoice", customerViewsCounted);

  const verified = customerViewsCounted.filter((c) => c.relationshipStatus === "verified");
  const unverified = customerViewsCounted.filter(
    (c) => c.relationshipStatus !== "verified"
  );
  let jobViews = jobViewsAll;
  if (filter === "missing_ghl") jobViews = jobViewsAll.filter((j) => j.opportunityLinkStatus === "none");
  if (filter === "unverified") jobViews = jobViewsAll.filter((j) => j.customerLinkStatus !== "verified");
  if (filter === "needs_attention") {
    jobViews = jobViewsAll.filter((j) => Boolean(j.blocker));
  }

  return (
    <AdminShell
      title="Customer & job links"
      subtitle="Read-only relationship resolution. Verified DB links are not proof of a recent provider write."
    >
      <p className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link className="underline" href="/links">
          All
        </Link>
        <Link className="underline" href="/links?filter=needs_attention">
          Needs attention
        </Link>
        <Link className="underline" href="/links?filter=missing_ghl">
          Missing GHL opportunity
        </Link>
        <Link className="underline" href="/links?filter=unverified">
          Unverified customer
        </Link>
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          heading={`Customers — ${verified.length} verified / ${unverified.length} unverified (${customerViewsCounted.length} total)`}
        >
          <CustomersBoard rows={customerViewsCounted} />
        </Panel>
        <Panel heading={`Jobs (${jobViews.length}${filter ? `, filtered` : ""})`}>
          <JobsBoard rows={jobViews} />
        </Panel>
        <Panel heading={`Quotes (${quoteViews.length}) · Jobber/DB only`}>
          <FinanceBoard rows={quoteViews} />
        </Panel>
        <Panel heading={`Invoices (${invoiceViews.length}) · Jobber/DB only`}>
          <FinanceBoard rows={invoiceViews} />
        </Panel>
      </div>
    </AdminShell>
  );
}