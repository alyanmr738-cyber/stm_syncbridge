import { GateClosedError } from "@/lib/config/feature-flags";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { ProcessOutcome } from "@/lib/display/process-outcome";
import {
  OAuthRecoveryQuarantineError,
  assertNotOAuthRecoveryQuarantine,
} from "@/lib/jobber/recovery-quarantine";
import type { QueueJobPayload } from "@/lib/queue/types";
import {
  syncAiSummary,
  syncBooking,
  syncGhlContact,
  syncJobClosed,
  syncJobberClient,
  syncJobberJob,
  syncQuoteOrInvoice,
  syncServiceRequest,
  CreationCanaryClosedError,
  type LoadedEvent,
} from "@/lib/sync/handlers";

export async function processSyncEvent(payload: QueueJobPayload): Promise<ProcessOutcome> {
  const supabase = getSupabaseAdmin();
  const loaded = supabase
    ? await supabase
        .from("sync_events")
        .select("id, source, event_kind, provider_entity_id, payload, received_at, status")
        .eq("id", payload.syncEventId)
        .maybeSingle()
    : { data: null };
  const row = loaded.data;

  if (row?.received_at) {
    assertNotOAuthRecoveryQuarantine(
      row.received_at as string,
      row.event_kind as string,
      row.status as string
    );
  }

  const event: LoadedEvent = {
    id: payload.syncEventId,
    source: payload.source,
    eventKind: (row?.event_kind as string) ?? payload.eventKind,
    providerEntityId:
      (row?.provider_entity_id as string | null) ?? payload.providerEntityId ?? null,
    payload: (row?.payload as Record<string, unknown>) ?? payload.payload ?? {},
  };
  const kind = event.eventKind.toUpperCase();

  if (kind === "APP_DISCONNECT") {
    await supabase
      ?.from("sync_connections")
      .update({ status: "reauthorization_required" })
      .eq("provider", "jobber");
    await recordOutcome(payload.syncEventId, "local_state_only");
    return "local_state_only";
  }

  try {
    let outcome: ProcessOutcome = "write_not_recorded";
    if (/CLIENT_CREATE|CLIENT_UPDATE|CLIENT\.CREATE|CLIENT\.UPDATE/.test(kind) && event.source === "jobber") {
      outcome = await syncJobberClient(event);
    } else if (/SERVICE.?REQUEST|SERVICEREQUEST/.test(kind) && event.source === "ghl") {
      outcome = await syncServiceRequest(event);
    } else if (/CONTACT|CUSTOMER/.test(kind) && event.source === "ghl") {
      outcome = await syncGhlContact(event);
    } else if (/APPOINTMENT|BOOKING/.test(kind) && event.source !== "jobber") {
      outcome = await syncBooking(event);
    } else if (/JOB_CLOSED|JOB\.COMPLETED|JOB_COMPLETE/.test(kind)) {
      outcome = await syncJobClosed(event);
    } else if ((/JOB_|JOB\./.test(kind) || /VISIT_/.test(kind)) && event.source === "jobber") {
      outcome = await syncJobberJob(event);
    } else if (/QUOTE|ESTIMATE/.test(kind)) {
      outcome = await syncQuoteOrInvoice(event, "quote");
    } else if (/INVOICE/.test(kind)) {
      outcome = await syncQuoteOrInvoice(event, "invoice");
    } else if (/SUMMARY|AI_NOTE|CONVERSATION_SUMMARY/.test(kind)) {
      outcome = await syncAiSummary(event);
    } else {
      outcome = "no_change";
    }
    await recordOutcome(payload.syncEventId, outcome);
    return outcome;
  } catch (e) {
    if (e instanceof OAuthRecoveryQuarantineError) {
      await markSuppressed(payload.syncEventId, e.message, "suppressed_feature");
      return "suppressed_feature";
    }
    if (e instanceof CreationCanaryClosedError) {
      await markSuppressed(payload.syncEventId, e.message, "suppressed_feature");
      return "suppressed_feature";
    }
    if (e instanceof GateClosedError) {
      await markSuppressed(payload.syncEventId, e.message, "suppressed_feature");
      if (/SERVICE.?REQUEST|SERVICEREQUEST/.test(kind) && event.source === "ghl") {
        const srOutcome = await syncServiceRequest(event);
        await recordOutcome(payload.syncEventId, srOutcome);
        return srOutcome;
      }
      if (/APPOINTMENT|BOOKING/.test(kind) && event.source !== "jobber") {
        const bookingOutcome = await syncBooking(event);
        await recordOutcome(payload.syncEventId, bookingOutcome);
        return bookingOutcome;
      }
      return "suppressed_feature";
    }
    throw e;
  }
}

async function recordOutcome(eventId: string, outcome: ProcessOutcome): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    ?.from("sync_events")
    .update({ process_outcome: outcome })
    .eq("id", eventId);
}

async function markSuppressed(
  eventId: string,
  reason: string,
  outcome: ProcessOutcome
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    ?.from("sync_events")
    .update({
      status: "suppressed",
      last_error_redacted: reason.slice(0, 240),
      processed_at: new Date().toISOString(),
      process_outcome: outcome,
    })
    .eq("id", eventId);
}
