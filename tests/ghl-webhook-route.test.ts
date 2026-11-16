import { afterEach, describe, expect, it, vi } from "vitest";

const persistAndEnqueue = vi.fn(async () => ({ eventId: "evt-ghl-1", queued: true }));
const envState = {
  GHL_WEBHOOK_SECRET: "test-wf-secret" as string | undefined,
  GHL_LOCATION_ID: "loc" as string | undefined,
};

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({
    GHL_WEBHOOK_SECRET: envState.GHL_WEBHOOK_SECRET,
    GHL_LOCATION_ID: envState.GHL_LOCATION_ID,
  }),
}));

vi.mock("@/services/events/inbox", () => ({ persistAndEnqueue }));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));
vi.mock("@/lib/queue/drain", () => ({ drainQueue: vi.fn() }));

describe("POST /api/webhooks/ghl", () => {
  afterEach(() => {
    envState.GHL_WEBHOOK_SECRET = "test-wf-secret";
    envState.GHL_LOCATION_ID = "loc";
    vi.clearAllMocks();
  });

  it("rejects unsigned workflow body", async () => {
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

  it("rejects wrong location", async () => {
    const { POST } = await import("@/app/api/webhooks/ghl/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GHL-Webhook-Secret": "test-wf-secret",
        },
        body: JSON.stringify({ type: "ContactUpdate", contactId: "c1", locationId: "wrong" }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("rejects ContactUpdate without contactId", async () => {
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