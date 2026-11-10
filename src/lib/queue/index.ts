import { getEnv } from "@/lib/config/env";
import { InMemoryEventQueue } from "./memory-queue";
import { PostgresEventQueue } from "./postgres-queue";
import type { EventQueue } from "./types";

let queue: EventQueue | null = null;

export function getEventQueue(): EventQueue {
  if (!queue) {
    queue =
      getEnv().QUEUE_PROVIDER === "postgres"
        ? new PostgresEventQueue()
        : new InMemoryEventQueue();
  }
  return queue;
}

export function resetQueueForTests(): void {
  queue = null;
}
