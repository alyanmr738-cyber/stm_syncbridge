import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { canAcceptVerifiedLink, type CandidateBucket } from "@/lib/sync/candidate-matcher";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    proposalId?: string;
    action?: "accept" | "reject";
    confirm?: boolean;
  };
  if (!body.proposalId || !body.action) {
    return Response.json({ error: "proposalId and action required" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return Response.json({ error: "explicit confirm=true required" }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });

  const { data: proposal } = await supabase
    .from("match_proposals")
    .select("*")
    .eq("id", body.proposalId)
    .maybeSingle();
  if (!proposal) return Response.json({ error: "not found" }, { status: 404 });
  if (proposal.status !== "suggested") {
    return Response.json({ error: "proposal already decided" }, { status: 409 });
  }

  if (body.action === "reject") {
    const { data } = await supabase
      .from("match_proposals")
      .update({
        status: "rejected",
        decided_by: session.email,
        decided_at: new Date().toISOString(),
      })
      .eq("id", proposal.id)
      .select("id, status")
      .single();
    return Response.json({ ok: true, proposal: data, linked: false });
  }

  const bucket = proposal.bucket as CandidateBucket;
  if (!canAcceptVerifiedLink(bucket)) {
    return Response.json(
      {
        error: "approval_required",
        message:
          "Only unique email+phone+aligned-name proposals can be verified here. Email-only/phone-only/ambiguous need Batch B or case approval.",
        bucket,
      },
      { status: 403 }
    );
  }

  const { data: existingJ } = await supabase
    .from("customer_links")
    .select("id, ghl_contact_id, verified")
    .eq("jobber_client_id", proposal.jobber_id)
    .maybeSingle();
  const { data: existingG } = await supabase
    .from("customer_links")
    .select("id, jobber_client_id")
    .eq("ghl_contact_id", proposal.ghl_id)
    .maybeSingle();
  if (existingJ && existingJ.ghl_contact_id && existingJ.ghl_contact_id !== proposal.ghl_id) {
    return Response.json({ error: "jobber_id_already_linked" }, { status: 409 });
  }
  if (existingG && existingG.jobber_client_id && existingG.jobber_client_id !== proposal.jobber_id) {
    return Response.json({ error: "ghl_id_already_linked" }, { status: 409 });
  }

  if (!existingJ) {
    await supabase.from("customer_links").insert({
      jobber_client_id: proposal.jobber_id,
      ghl_contact_id: proposal.ghl_id,
      match_method: "admin_accepted_email_and_phone_unique",
      verified: true,
      last_synced_at: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("customer_links")
      .update({
        ghl_contact_id: proposal.ghl_id,
        verified: true,
        match_method: "admin_accepted_email_and_phone_unique",
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", existingJ.id);
  }

  await supabase
    .from("match_proposals")
    .update({
      status: "accepted",
      decided_by: session.email,
      decided_at: new Date().toISOString(),
    })
    .eq("id", proposal.id);

  return Response.json({ ok: true, linked: true, verified: true });
}
