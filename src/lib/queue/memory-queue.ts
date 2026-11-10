import type { EventQueue, EnqueueResult, QueueJobPayload } from "./types";

type MemJob = QueueJobPayload & { id: string; attempts: number };

export class InMemoryEventQueue implements EventQueue {
  private pending: MemJob[] = [];
  private deadLetter: MemJob[] = [];
  private seen = new Set<string>();

  async enqueue(
    payload: QueueJobPayload,
    idempotencyKey?: string
  ): Promise<EnqueueResult> {
    const key = idempotencyKey ?? payload.syncEventId;
    if (this.seen.has(key)) {
      return { jobId: key, alreadyQueued: true };
    }
    this.seen.add(key);
    const job: MemJob = { ...payload, id: crypto.randomUUID(), attempts: 0 };
    this.pending.push(job);
    return { jobId: job.id };
  }

  async processNext(
    handler: (payload: QueueJobPayload) => Promise<void>
  ): Promise<boolean> {
    const job = this.pending.shift();
    if (!job) return false;
    try {
      await handler(job);
    } catch {
      job.attempts += 1;
      if (job.attempts >= 8) {
        this.deadLetter.push(job);
      } else {
        this.pending.push(job);
      }
    }
    return true;
  }

  async stats() {
    return {
      pending: this.pending.length,
      leased: 0,
      deadLetter: this.deadLetter.length,
    };
  }
}
