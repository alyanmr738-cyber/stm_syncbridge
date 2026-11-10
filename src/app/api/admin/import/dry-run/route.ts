import { getAdminSession } from "@/lib/auth/session";
import { ghlGet } from "@/lib/ghl/rest";
import { stmLocationId } from "@/lib/ghl/rest";
import { jobberGraphql } from "@/lib/jobber/graphql";
import {
  dryRunMatchCustomers,
  toProviderHitsFromGhl,
  toProviderHitsFromJobber,
} from "@/lib/sync/historical";

export async function GET() {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobber = await jobberGraphql<{
    clients: {
      nodes: { id: string; emails?: { address?: string }[]; phones?: { number?: string }[] }[];
    };
  }>(`query {
    clients(first: 50) {
      nodes { id emails { address } phones { number } }
    }
  }`);
  const loc = stmLocationId();
  const ghl = await ghlGet<{
    contacts?: { id: string; email?: string; phone?: string }[];
  }>(`/contacts/?locationId=${encodeURIComponent(loc)}&limit=100`);

  const report = dryRunMatchCustomers(
    toProviderHitsFromJobber(jobber.clients.nodes),
    toProviderHitsFromGhl(ghl.contacts ?? [])
  );
  return Response.json({
    note: "Dry-run sample (50 Jobber / 100 GHL). No writes. No messaging. Full 7140 requires Gate B approval.",
    messaging: report.messaging,
    counts: {
      jobberSample: report.jobberCount,
      ghlSample: report.ghlCount,
      exact: report.exact.length,
      ambiguous: report.ambiguousJobber.length,
      unmatchedJobber: report.unmatchedJobber.length,
    },
    exactSample: report.exact.slice(0, 15),
    ambiguousSample: report.ambiguousJobber.slice(0, 10),
  });
}
