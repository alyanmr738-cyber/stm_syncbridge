import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";
import { processSyncEvent } from "@/lib/sync/engine";

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@/lib/jobber/ops", async () => {
  const actual = await vi.importActual<typeof import("@/lib/jobber/ops")>("@/lib/jobber/ops");
  return {
    ...actual,
    fetchJobberClient: vi.fn(async () => ({
      id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      firstName: "Test",
      lastName: "Pilot",
      emails: [{ address: "pilot@example.com" }],
      phones: [{ number: "9415550100" }],
      clientProperties: { nodes: [] },
    })),
    searchJobberClients: vi.fn(async () => []),
  };
});

vi.mock("@/lib/ghl/rest", () => ({
  searchGhlContacts: vi.fn(async () => []),
  getGhlContact: vi.fn(async () => null),
  upsertGhlContact: vi.fn(async () => {
    throw new Error("upsert should not run when gated");
  }),
  searchGhlOpportunities: vi.fn(async () => []),
  getGhlOpportunity: vi.fn(async () => null),
  createOpportunity: vi.fn(),
  moveOpportunityStage: vi.fn(),
  addGhlContactNote: vi.fn(),
}));

describe("gated writes never hit providers", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = {
      ...prev,
      SYNC_ENABLED: "false",
      OUTBOUND_WRITES_ENABLED: "false",
      PILOT_JOBBER_CLIENT_IDS: "",
      PILOT_GHL_CONTACT_IDS: "",
      PILOT_ENTITY_IDS: "",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
    vi.clearAllMocks();
  });

  it("suppresses Jobber CLIENT_UPDATE without calling GHL upsert", async () => {
    const { upsertGhlContact } = await import("@/lib/ghl/rest");
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000010",
      eventKind: "CLIENT_UPDATE",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
    });
    expect(upsertGhlContact).not.toHaveBeenCalled();
  });

  it("GateClosedError is the write barrier", () => {
    expect(new GateClosedError("production_writes", "test").gate).toBe(
      "production_writes"
    );
  });
});
