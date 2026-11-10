import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/supabase-admin", () => {
  const store: { source: string; provider_event_key: string; id: string; status: string }[] = [];
  return {
    getSupabaseAdmin: () => ({
      from: () => {
        const filters: Record<string, string> = {};
        const api = {
          select: () => api,
          eq: (col: string, val: string) => {
            filters[col] = val;
            return api;
          },
          maybeSingle: async () => ({
            data:
              store.find(
                (e) =>
                  e.source === filters.source && e.provider_event_key === filters.provider_event_key
              ) ?? null,
          }),
          insert: (row: { source: string; provider_event_key: string }) => ({
            select: () => ({
              single: async () => {
                if (
                  store.some(
                    (e) =>
                      e.source === row.source && e.provider_event_key === row.provider_event_key
                  )
                ) {
                  return { data: null, error: { code: "23505", message: "duplicate" } };
                }
                const created = { ...row, id: "evt-1", status: "queued" };
                store.push(created);
                return { data: created, error: null };
              },
            }),
          }),
        };
        return api;
      },
    }),
  };
});

vi.mock("@/lib/queue", () => ({
  getEventQueue: () => ({
    enqueue: vi.fn(async () => ({ jobId: "job-1" })),
  }),
}));

describe("webhook inbox dedupe", () => {
  it("second persist of the same provider_event_key does not throw", async () => {
    const { persistAndEnqueue } = await import("@/services/events/inbox");
    const event = {
      source: "jobber" as const,
      eventKind: "CLIENT_UPDATE",
      providerEventKey: "CLIENT_UPDATE:abc:1",
      providerEntityId: "abc",
      payload: {},
    };
    const a = await persistAndEnqueue(event);
    const b = await persistAndEnqueue(event);
    expect(a.queued).toBe(true);
    expect(b.queued).toBe(false);
    expect(b.eventId).toBe(a.eventId);
  });
});
