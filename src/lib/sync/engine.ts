import { GateClosedError } from "@/lib/config/feature-flags";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
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
  type LoadedEvent,
} from "@/lib/sync/handlers";

export async function processSyncEvent(payload: QueueJobPayload): Promise<void> {
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
    return;
  }

  try {
    if (/CLIENT_CREATE|CLIENT_UPDATE|CLIENT\.CREATE|CLIENT\.UPDATE/.test(kind) && event.source === "jobber") {
      await syncJobberClient(event);
      return;
    }
    if (/CONTACT|CUSTOMER/.test(kind) && event.source === "ghl") {
      await syncGhlContact(event);
      return;
    }
    if (/APPOINTMENT|BOOKING/.test(kind) && event.source !== "jobber") {
      await syncBooking(event);
      return;
    }
    if (/JOB_CLOSED|JOB\.COMPLETED|JOB_COMPLETE/.test(kind)) {
      await syncJobClosed(event);
      return;
    }
    if ((/JOB_|JOB\./.test(kind) || /VISIT_/.test(kind)) && event.source === "jobber") {
      await syncJobberJob(event);
      return;
    }
    if (/QUOTE|ESTIMATE/.test(kind)) {
      await syncQuoteOrInvoice(event, "quote");
      return;
    }
    if (/INVOICE/.test(kind)) {
      await syncQuoteOrInvoice(event, "invoice");
      return;
    }
    if (/SUMMARY|AI_NOTE|CONVERSATION_SUMMARY/.test(kind)) {
      await syncAiSummary(event);
    }
  } catch (e) {
    if (e instanceof OAuthRecoveryQuarantineError) {
      await markSuppressed(payload.syncEventId, e.message);
      return;
    }
    if (e instanceof GateClosedError) {
      await markSuppressed(payload.syncEventId, e.message);
      if (/APPOINTMENT|BOOKING/.test(kind) && event.source !== "jobber") {
        await syncBooking(event);
      }
      return;
    }
    throw e;
  }
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
