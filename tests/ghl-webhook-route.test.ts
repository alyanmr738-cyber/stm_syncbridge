import { afterEach, describe, expect, it, vi } from "vitest";

const persistAndEnqueue = vi.fn(async () => ({ eventId: "evt-ghl-1", queued: true }));

vi.mock("@/services/events/inbox", () => ({ persistAndEnqueue }));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("@/lib/queue/drain", () => ({ drainQueue: vi.fn() }));

describe("POST /api/webhooks/ghl", () => {
  const prev = process.env.GHL_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.GHL_WEBHOOK_SECRET = prev;
    vi.clearAllMocks();
  });

  it("rejects unsigned workflow body", async () => {
    process.env.GHL_WEBHOOK_SECRET = "test-wf-secret";
    const { POST } = await import("@/app/api/webhooks/ghl/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/ghl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ContactUpdate", contactId: "c1", locationId: "loc" }),
      })
    );
    expect(res.status).toBe(401);
    expect(persistAndEnqueue).not.toHaveBeenCalled();
  });

  it("rejects missing locationId when GHL_LOCATION_ID is set", async () => {
    process.env.GHL_WEBHOOK_SECRET = "test-wf-secret";
    process.env.GHL_LOCATION_ID = "loc";
    const { POST } = await import("@/app/api/webhooks/ghl/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GHL-Webhook-Secret": "test-wf-secret",
        },
        body: JSON.stringify({ type: "ContactUpdate", contactId: "c1" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects ContactUpdate without contactId", async () => {
    process.env.GHL_WEBHOOK_SECRET = "test-wf-secret";
    process.env.GHL_LOCATION_ID = "loc";
    const { POST } = await import("@/app/api/webhooks/ghl/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GHL-Webhook-Secret": "test-wf-secret",
        },
        body: JSON.stringify({ type: "ContactUpdate", locationId: "loc" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts workflow secret and normalizes ContactUpdate", async () => {
    process.env.GHL_WEBHOOK_SECRET = "test-wf-secret";
    process.env.GHL_LOCATION_ID = "loc";
    const { POST } = await import("@/app/api/webhooks/ghl/route");
    const body = {
      type: "ContactUpdate",
      contactId: "Oz6ZOx",
      locationId: "loc",
      syncEventKey: "dry-run-1",
      lastName: "ProbeOnly",
    };
    const res = await POST(
      new Request("http://localhost/api/webhooks/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GHL-Webhook-Secret": "test-wf-secret",
        },
        body: JSON.stringify(body),
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { auth: string; eventKind: string };
    expect(json.auth).toBe("workflow_secret");
    expect(json.eventKind).toBe("ContactUpdate");
    expect(persistAndEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: "ContactUpdate",
        providerEventKey: "dry-run-1",
        providerEntityId: "Oz6ZOx",
      })
    );
  });
});