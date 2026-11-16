import { getAdminSession } from "@/lib/auth/session";
import {
  buildLiveCustomerProposalDrafts,
  upsertSuggestedProposals,
} from "@/lib/sync/proposal-refresh";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    confirm?: boolean;
    persist?: boolean;
  };
  if (body.confirm !== true) {
    return Response.json({ error: "explicit confirm=true required" }, { status: 400 });
  }
  const built = await buildLiveCustomerProposalDrafts();
  let persisted = 0;
  if (body.persist === true) {
    persisted = await upsertSuggestedProposals(built.drafts);
  }
  return Response.json({
    note: "Live revalidation of pending customer_links only. No verified writes. persist=true stores suggested match_proposals.",
    policy: {
      autoVerifyNever: true,
      legacyBatchB: "email_only + name_aligned — cannot accept via UI",
      currentEligibleAccept: "email_and_phone_unique only",
    },
    ...built,
    persisted,
  });
}
