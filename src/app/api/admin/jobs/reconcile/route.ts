import { getAdminSession } from "@/lib/auth/session";
import {
  buildJobRelationshipAudit,
  persistJobRelationshipProposals,
} from "@/lib/sync/job-relationship-reconcile";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const live = url.searchParams.get("liveOpportunities") === "true";
  const audit = await buildJobRelationshipAudit({ liveOpportunityScan: live });
  return Response.json({
    note: "Read-only audit. Applies no job_links mutations. persist=true stores suggested proposals for approval.",
    liveOpportunityScan: live,
    counts: audit.counts,
    rows: audit.rows,
  });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    confirm?: boolean;
    persist?: boolean;
    liveOpportunityScan?: boolean;
  };
  if (!body.confirm) {
    return Response.json({ error: "confirm required" }, { status: 400 });
  }
  const audit = await buildJobRelationshipAudit({
    liveOpportunityScan: body.liveOpportunityScan === true,
  });
  if (!body.persist) {
    return Response.json({ dryRun: true, counts: audit.counts, rows: audit.rows });
  }
  const persisted = await persistJobRelationshipProposals(audit.rows);
  return Response.json({
    persisted,
    counts: audit.counts,
    note: "Proposals stored only — job_links not updated without separate production authorization.",
  });
}