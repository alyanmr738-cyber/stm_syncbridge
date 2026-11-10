import { describe, expect, it } from "vitest";
import { InMemoryEventQueue } from "@/lib/queue/memory-queue";

describe("queue overlap and dead-letter", () => {
  it("does not double-process the same idempotency key", async () => {
    const q = new InMemoryEventQueue();
    const payload = {
      syncEventId: "evt-1",
      eventKind: "JOB_UPDATE",
      source: "jobber" as const,
    };
    const a = await q.enqueue(payload, "jobber:JOB_UPDATE:1");
    const b = await q.enqueue(payload, "jobber:JOB_UPDATE:1");
    expect(a.alreadyQueued).toBeFalsy();
    expect(b.alreadyQueued).toBe(true);
    let n = 0;
    await q.processNext(async () => {
      n += 1;
    });
    await q.processNext(async () => {
      n += 1;
    });
    expect(n).toBe(1);
  });

  it("runs overlapping processNext without duplicating work", async () => {
    const q = new InMemoryEventQueue();
    await q.enqueue({
      syncEventId: "evt-2",
      eventKind: "CLIENT_UPDATE",
      source: "jobber",
    });
    let active = 0;
    let max = 0;
    const handler = async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
    };
    await Promise.all([q.processNext(handler), q.processNext(handler)]);
    expect(max).toBeLessThanOrEqual(1);
    expect((await q.stats()).pending).toBe(0);
  });

  it("dead-letters after bounded failures", async () => {
    const q = new InMemoryEventQueue();
    await q.enqueue({
      syncEventId: "evt-3",
      eventKind: "JOB_CLOSED",
      source: "jobber",
    });
    for (let i = 0; i < 8; i++) {
      await q.processNext(async () => {
        throw new Error("provider_5xx");
      });
    }
    const stats = await q.stats();
    expect(stats.deadLetter).toBe(1);
    expect(stats.pending).toBe(0);
  });
});
