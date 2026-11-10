import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { processSyncEvent } from "@/lib/sync/engine";

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@/lib/jobber/ops", () => ({
  isJobberEncodedId: () => true,
  fetchJobberClient: vi.fn(),
  searchJobberClients: vi.fn(async () => []),
  editJobberClient: vi.fn(),
  createJobberClient: vi.fn(),
}));

vi.mock("@/lib/ghl/rest", () => ({
  getGhlContact: vi.fn(async () => ({
    id: "6fphEggI2IDws4TlmD6Q",
    firstName: "ALEX",
    lastName: "TETIYEVSKY",
    email: "alext@usa.net",
    phone: "+12012595233",
  })),
  searchGhlContacts: vi.fn(async () => []),
  upsertGhlContact: vi.fn(),
}));

describe("reverse GHL→Jobber is blocked in restricted pilot", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = {
      ...prev,
      SYNC_ENABLED: "false",
      OUTBOUND_WRITES_ENABLED: "false",
      PILOT_JOBBER_CLIENT_IDS: "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==",
      PILOT_GHL_CONTACT_IDS: "6fphEggI2IDws4TlmD6Q",
      PILOT_GHL_ALLOWED_FIELDS: "jobberClientId",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
    vi.clearAllMocks();
  });

  it("does not call Jobber clientEdit", async () => {
    const { editJobberClient, createJobberClient } = await import("@/lib/jobber/ops");
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000011",
      eventKind: "ContactUpdate",
      source: "ghl",
      providerEntityId: "6fphEggI2IDws4TlmD6Q",
    });
    expect(editJobberClient).not.toHaveBeenCalled();
    expect(createJobberClient).not.toHaveBeenCalled();
  });
});
