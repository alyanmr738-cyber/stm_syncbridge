import { getEnv } from "@/lib/config/env";
import {
  assertOutboundWrite,
  GateClosedError,
} from "@/lib/config/feature-flags";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { QueueJobPayload } from "@/lib/queue/types";

export async function processSyncEvent(payload: QueueJobPayload): Promise<void> {
  const env = getEnv();
  const kind = payload.eventKind.toUpperCase();

  if (kind === "APP_DISCONNECT") {
    const supabase = getSupabaseAdmin();
    await supabase
      ?.from("sync_connections")
      .update({ status: "reauthorization_required" })
      .eq("provider", "jobber");
    return;
  }

  try {
    if (needsWrite(kind)) {
      assertOutboundWrite(`${payload.source}:${kind}`);
    }
  } catch (e) {
    if (e instanceof GateClosedError) {
      await markSuppressed(payload.syncEventId, e.message);
      if (isBooking(kind)) {
        await recordPendingBooking(payload, e.message);
      }
      return;
    }
    throw e;
  }

  if (isBooking(kind)) {
    const policy = getSchedulingPolicy();
    if (!policy.autoSchedulingEnabled || env.EMERGENCY_AUTO_BOOK_ENABLED) {
      await recordPendingBooking(
        payload,
        policy.autoSchedulingEnabled
          ? "Emergency auto-book remains disabled"
          : "Scheduling buffers unset — pending_jobber_confirmation"
      );
      return;
    }
  }

  if (kind.includes("JOB_CLOSED") || kind === "JOB.COMPLETED") {
    await handleJobClosed(payload);
    return;
  }
}

function needsWrite(kind: string): boolean {
  return /CREATE|UPDATE|CLOSED|COMPLETE|APPOINTMENT|BOOKING/.test(kind);
}

function isBooking(kind: string): boolean {
  return /APPOINTMENT|VISIT_CREATE|BOOKING/.test(kind);
}

async function markSuppressed(eventId: string, reason: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    ?.from("sync_events")
    .update({
      status: "suppressed",
      last_error_redacted: reason.slice(0, 240),
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}

async function recordPendingBooking(
  payload: QueueJobPayload,
  reason: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("appointment_links").insert({
    ghl_appointment_id: payload.syncEventId,
    booking_state: "pending_jobber_confirmation",
  });
  await supabase.from("sync_conflicts").insert({
    source_event_id: payload.syncEventId,
    entity_type: "booking",
    source_entity_id: payload.syncEventId,
    reason: "pending_jobber_confirmation",
    details_redacted: { note: reason },
  });
}

async function handleJobClosed(payload: QueueJobPayload): Promise<void> {
  const env = getEnv();
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  if (!env.JOB_COMPLETION_SYNC_ENABLED) {
    await markSuppressed(payload.syncEventId, "JOB_COMPLETION_SYNC_ENABLED=false");
    return;
  }
  if (!env.CUSTOMER_MESSAGING_ENABLED || !env.REVIEW_TRIGGER_ENABLED) {
    await supabase.from("review_deliveries").upsert(
      {
        jobber_account_id: "connected",
        jobber_job_id: payload.syncEventId,
        status: "suppressed",
        failure_reason_redacted: "customer_messaging gate OFF",
      },
      { onConflict: "jobber_account_id,jobber_job_id,review_kind" }
    );
  }
}
