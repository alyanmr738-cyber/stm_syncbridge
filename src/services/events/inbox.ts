import { getEventQueue } from "@/lib/queue";
import type { QueueJobPayload } from "@/lib/queue/types";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export type InboundEvent = {
  source: "jobber" | "ghl" | "internal";
  eventKind: string;
  providerEventKey: string;
  providerEntityId?: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
};

export async function persistAndEnqueue(
  event: InboundEvent
): Promise<{ eventId: string; queued: boolean }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Event not durable: Supabase unavailable");
  }

  const { data: existing } = await supabase
    .from("sync_events")
    .select("id, status")
    .eq("source", event.source)
    .eq("provider_event_key", event.providerEventKey)
    .maybeSingle();

  if (existing?.id) {
    return { eventId: existing.id, queued: false };
  }

  const { data, error } = await supabase
    .from("sync_events")
    .insert({
      source: event.source,
      event_kind: event.eventKind,
      provider_entity_id: event.providerEntityId ?? null,
      provider_event_key: event.providerEventKey,
      payload: redactPayload(event.payload),
      status: "queued",
      occurred_at: event.occurredAt ?? new Date().toISOString(),
      idempotency_key: `${event.source}:${event.providerEventKey}`,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("sync_events")
        .select("id, status")
        .eq("source", event.source)
        .eq("provider_event_key", event.providerEventKey)
        .maybeSingle();
      if (raced?.id) {
        return { eventId: raced.id, queued: false };
      }
    }
    throw new Error(error.message);
  }

  const queuePayload: QueueJobPayload = {
    syncEventId: data.id,
    eventKind: event.eventKind,
    source: event.source,
  };
  await getEventQueue().enqueue(
    queuePayload,
    `${event.source}:${event.providerEventKey}`
  );
  return { eventId: data.id, queued: true };
}

export async function listRecentEvents(limit = 50) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("sync_events")
    .select(
      "id, source, event_kind, provider_entity_id, status, last_error_redacted, received_at, processed_at"
    )
    .order("received_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    source: row.source as string,
    eventKind: row.event_kind as string,
    status: row.status as string,
    error: row.last_error_redacted as string | null,
    receivedAt: row.received_at as string,
  }));
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...payload };
  for (const key of Object.keys(copy)) {
    if (/token|secret|password|authorization/i.test(key)) {
      copy[key] = "[redacted]";
    }
  }
  return copy;
}
