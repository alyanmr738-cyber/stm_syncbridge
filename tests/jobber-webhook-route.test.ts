import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";

const persistAndEnqueue = vi.fn(async () => ({ eventId: "evt-1", queued: false }));
const drainQueue = vi.fn(async () => ({ processed: 0 }));

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ JOBBER_CLIENT_SECRET: "test-secret" }),
}));

vi.mock("@/services/events/inbox", () => ({ persistAndEnqueue }));
vi.mock("@/lib/queue/drain", () => ({ drainQueue }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));

describe("public Jobber webhook", () => {
  it("returns 200 on a valid duplicate delivery", async () => {
    const { POST } = await import("@/app/api/webhooks/jobber/route");
    const raw = Buffer.from(
      JSON.stringify({ topic: "CLIENT_UPDATE", itemId: "abc", occurredAt: "1" })
    );
    const sig = createHmac("sha256", "test-secret").update(raw).digest("hex");
    persistAndEnqueue.mockResolvedValue({ eventId: "evt-1", queued: false });
    const res = await POST(
      new Request("http://localhost/api/webhooks/jobber", {
        method: "POST",
        headers: { "x-jobber-hmac-sha256": sig },
        body: raw,
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
  });

  it("unwraps Jobber nested webHookEvent and accepts base64 HMAC", async () => {
    const { POST } = await import("@/app/api/webhooks/jobber/route");
    const raw = Buffer.from(
      JSON.stringify({
        data: {
          webHookEvent: {
            topic: "JOB_CLOSED",
            itemId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
            occurredAt: "2026-11-10T18:04:31Z",
          },
        },
      })
    );
    const sig = createHmac("sha256", "test-secret").update(raw).digest("base64");
    persistAndEnqueue.mockClear();
    persistAndEnqueue.mockResolvedValue({ eventId: "evt-2", queued: true });
    const res = await POST(
      new Request("http://localhost/api/webhooks/jobber", {
        method: "POST",
        headers: { "x-jobber-hmac-sha256": sig },
        body: raw,
      })
    );
    expect(res.status).toBe(200);
    expect(persistAndEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: "JOB_CLOSED",
        providerEntityId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
      })
    );
  });
});
