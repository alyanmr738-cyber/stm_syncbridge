import { AdminShell, Panel } from "@/components/admin/shell";
import { CustomersBoard, FinanceBoard, JobsBoard } from "@/components/admin/links-board";
import { listFinance, listLinks } from "@/lib/db/admin-lists";
import { enrichCustomers, enrichFinance, enrichJobs } from "@/lib/display/enrich";

export default async function LinksPage() {
  const { customers, jobs } = await listLinks();
  const { quotes, invoices } = await listFinance();
  const customerViews = await enrichCustomers(customers);
  const jobViews = await enrichJobs(jobs, customerViews);
  const quoteViews = await enrichFinance(quotes, "quote", customerViews);
  const invoiceViews = await enrichFinance(invoices, "invoice", customerViews);
  return (
    <AdminShell
      title="Customer & job links"
      subtitle="Names from Jobber and GHL. IDs stay in expandable details. Ambiguous matches are never auto-merged."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel heading={`Customers (${customerViews.length})`}>
          <CustomersBoard rows={customerViews} />
        </Panel>
        <Panel heading={`Jobs (${jobViews.length})`}>
          <JobsBoard rows={jobViews} />
        </Panel>
        <Panel heading={`Quotes (${quoteViews.length})`}>
          <FinanceBoard rows={quoteViews} />
        </Panel>
        <Panel heading={`Invoices (${invoiceViews.length})`}>
          <FinanceBoard rows={invoiceViews} />
        </Panel>
      </div>
    </AdminShell>
  );
}
