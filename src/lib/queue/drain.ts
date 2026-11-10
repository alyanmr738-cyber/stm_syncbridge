import { getEventQueue } from "@/lib/queue";
import { processSyncEvent } from "@/services/events/processor";

export async function drainQueue(limit = 10): Promise<{ processed: number }> {
  const queue = getEventQueue();
  let processed = 0;
  while (processed < limit && (await queue.processNext(processSyncEvent))) {
    processed += 1;
  }
  return { processed };
}
