import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { drainQueue } from "@/lib/queue/drain";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  const eventId = body.eventId;
  if (!eventId) return Response.json({ error: "eventId required" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });

  const { data: current } = await supabase
    .from("sync_events")
    .select("id, last_error_redacted")
    .eq("id", eventId)
    .maybeSingle();
  const { isObsoleteJobberSchemaError } = await import("@/lib/sync/matching");
  if (isObsoleteJobberSchemaError(current?.last_error_redacted as string | undefined)) {
    await supabase
      .from("sync_events")
      .update({
        status: "suppressed",
        last_error_redacted: "Obsolete Jobber emails{nodes} schema error — do not replay",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    return Response.json({ retried: eventId, suppressed: true, reason: "obsolete_jobber_schema" });
  }

  await supabase
    .from("sync_events")
    .update({ status: "queued", last_error_redacted: null })
    .eq("id", eventId);
  await supabase.from("queue_jobs").insert({
    sync_event_id: eventId,
    status: "pending",
    attempt: 0,
    max_attempts: 8,
  });
  const drained = await drainQueue(5);
  return Response.json({ retried: eventId, ...drained });
}
