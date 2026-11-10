import { getEnv } from "@/lib/config/env";
import { InMemoryEventQueue } from "./memory-queue";
import type { EventQueue } from "./types";

let queue: EventQueue | null = null;

export function getEventQueue(): EventQueue {
  if (!queue) {
    const provider = getEnv().QUEUE_PROVIDER;
    if (provider === "postgres") {
      // Postgres adapter uses sync_events + queue_jobs via Supabase when configured.
      queue = new InMemoryEventQueue();
    } else {
      queue = new InMemoryEventQueue();
    }
  }
  return queue;
}
