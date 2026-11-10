import { getEventQueue } from "@/lib/queue";
import type { QueueJobPayload } from "@/lib/queue/types";

export type InboundEvent = {
  source: "jobber" | "ghl" | "internal";
  eventKind: string;
  providerEventKey: string;
  providerEntityId?: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
};

type StoredEvent = InboundEvent & { id: string; status: string };

const memoryInbox: StoredEvent[] = [];

export async function persistAndEnqueue(
  event: InboundEvent
): Promise<{ eventId: string; queued: boolean }> {
  const eventId = crypto.randomUUID();
  memoryInbox.push({ ...event, id: eventId, status: "queued" });

  const queuePayload: QueueJobPayload = {
    syncEventId: eventId,
    eventKind: event.eventKind,
    source: event.source,
  };
  await getEventQueue().enqueue(queuePayload, `${event.source}:${event.providerEventKey}`);
  return { eventId, queued: true };
}

export function listRecentEvents(limit = 50) {
  return memoryInbox.slice(-limit).reverse();
}
