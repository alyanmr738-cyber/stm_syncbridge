import { getAdminSession } from "@/lib/auth/session";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export async function GET() {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });
  const { data } = await supabase
    .from("appointment_links")
    .select(
      "id, ghl_appointment_id, jobber_visit_id, booking_state, requested_start_at, confirmed_start_at"
    )
    .in("booking_state", ["requested", "checking", "pending_jobber_confirmation"])
    .order("requested_start_at", { ascending: false })
    .limit(200);
  return Response.json({
    policy: getSchedulingPolicy(),
    note: "BOOKING_SYNC remains off. These rows are pending Jobber confirmation only.",
    rows: data ?? [],
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    ghlAppointmentId?: string;
    requestedStartAt?: string;
    confirm?: boolean;
    confirmVisit?: boolean;
  };
  if (body.confirmVisit) {
    return Response.json(
      {
        error: "approval_required",
        message: "Confirming a Jobber visit requires BOOKING_SYNC_ENABLED and explicit operator approval.",
      },
      { status: 403 }
    );
  }
  if (!body.ghlAppointmentId || body.confirm !== true) {
    return Response.json({ error: "ghlAppointmentId and confirm=true required" }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ error: "db unavailable" }, { status: 503 });
  const { data, error } = await supabase
    .from("appointment_links")
    .upsert(
      {
        ghl_appointment_id: body.ghlAppointmentId,
        requested_start_at: body.requestedStartAt ?? null,
        booking_state: "pending_jobber_confirmation",
      },
      { onConflict: "ghl_appointment_id" }
    )
    .select("id, booking_state")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, row: data, jobberWrite: false });
}
