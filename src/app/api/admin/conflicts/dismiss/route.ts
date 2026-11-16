import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    conflictId?: string;
    confirm?: boolean;
  };
  if (!body.conflictId || body.confirm !== true) {
    return Response.json({ error: "conflictId and confirm=true required" }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });
  const { data, error } = await supabase
    .from("sync_conflicts")
    .update({ state: "dismissed" })
    .eq("id", body.conflictId)
    .eq("state", "open")
    .select("id, state")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found or not open" }, { status: 404 });
  return Response.json({ ok: true, conflict: data });
}
