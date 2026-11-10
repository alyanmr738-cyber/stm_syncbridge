import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { STM_GHL } from "@/lib/config/stm-mapping";
import { processSyncEvent } from "@/lib/sync/engine";
import { buildPilotGhlContactBody } from "@/lib/config/pilot";

const writes: { fn: string; args: unknown }[] = [];

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@/lib/sync/match-store", () => ({
  matchCustomer: vi.fn(async () => ({ kind: "provider", ghlContactId: "ghl-1" })),
  findJobLink: vi.fn(async () => null),
  upsertCustomerLink: vi.fn(async () => "link-1"),
  upsertJobLink: vi.fn(async () => "job-link-1"),
  openConflict: vi.fn(),
}));

vi.mock("@/lib/jobber/ops", async () => {
  const actual = await vi.importActual<typeof import("@/lib/jobber/ops")>("@/lib/jobber/ops");
  return {
    ...actual,
    fetchJobberClient: vi.fn(async () => ({
      id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      firstName: "Pat",
      lastName: "Pilot",
      name: "Pat Pilot",
      emails: [{ address: "pat@example.com" }],
      phones: [{ number: "9415550100" }],
      clientProperties: { nodes: [] },
    })),
    fetchJobberJob: vi.fn(async () => ({
      id: "Z2lkOi8vSm9iYmVyL0pvYi8x",
      jobStatus: "closed",
      title: "Pump",
      jobNumber: "100",
      client: { id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" },
    })),
    fetchJobberQuote: vi.fn(async () => ({
      id: "Z2lkOi8vSm9iYmVyL1F1b3RlLzE=",
      quoteNumber: "Q-1",
      quoteStatus: "approved",
      client: { id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" },
    })),
    createJobberNote: vi.fn(async (opts: { message: string }) => {
      writes.push({ fn: "createJobberNote", args: opts });
      return "note-1";
    }),
    searchJobberClients: vi.fn(async () => []),
    editJobberClient: vi.fn(),
    createJobberClient: vi.fn(),
  };
});

vi.mock("@/lib/ghl/rest", () => ({
  searchGhlContacts: vi.fn(async () => [{ id: "ghl-1" }]),
  getGhlContact: vi.fn(async () => ({ id: "ghl-1" })),
  upsertGhlContact: vi.fn(async (input: Record<string, unknown>) => {
    writes.push({ fn: "upsertGhlContact", args: input });
    return { id: input.id ?? "ghl-new" };
  }),
  searchGhlOpportunities: vi.fn(async () => []),
  createOpportunity: vi.fn(async (input: Record<string, unknown>) => {
    writes.push({ fn: "createOpportunity", args: input });
    return { id: "opp-1" };
  }),
  moveOpportunityStage: vi.fn(async (input: Record<string, unknown>) => {
    writes.push({ fn: "moveOpportunityStage", args: input });
  }),
  addGhlContactNote: vi.fn(async (id: string, body: string) => {
    writes.push({ fn: "addGhlContactNote", args: { id, body } });
    return "ghl-note-1";
  }),
}));

describe("end-to-end payloads with Gate A", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    writes.length = 0;
    process.env = {
      ...prev,
      SYNC_ENABLED: "true",
      OUTBOUND_WRITES_ENABLED: "true",
      PILOT_EXISTING_RECORDS_ONLY: "false",
      JOB_COMPLETION_SYNC_ENABLED: "true",
      ESTIMATE_SYNC_ENABLED: "true",
      AI_SUMMARY_SYNC_ENABLED: "true",
      CUSTOMER_MESSAGING_ENABLED: "false",
      REVIEW_TRIGGER_ENABLED: "false",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
    vi.clearAllMocks();
  });

  it("Jobber CLIENT_UPDATE sends existing GHL id plus Jobber Client ID", async () => {
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000021",
      eventKind: "CLIENT_UPDATE",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
    });
    const call = writes.find((w) => w.fn === "upsertGhlContact");
    expect(call?.args).toMatchObject({
      id: "ghl-1",
      firstName: "Pat",
      lastName: "Pilot",
      email: "pat@example.com",
      jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
    });
    const body = buildPilotGhlContactBody(call?.args as never);
    expect(body.customFields).toEqual(
      expect.arrayContaining([
        { id: STM_GHL.fields.jobberClientId, field_value: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" },
      ])
    );
  });

  it("Jobber VISIT_UPDATE reuses job id and does not invent booking confirmation", async () => {
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000022",
      eventKind: "VISIT_UPDATE",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
    });
    expect(writes.some((w) => w.fn === "createOpportunity")).toBe(false);
  });

  it("JOB_CLOSED does not move GHL when Jobber status is still today", async () => {
    const { fetchJobberJob } = await import("@/lib/jobber/ops");
    vi.mocked(fetchJobberJob).mockResolvedValueOnce({
      id: "Z2lkOi8vSm9iYmVyL0pvYi8x",
      jobStatus: "today",
      client: { id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" },
    });
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000028",
      eventKind: "JOB_CLOSED",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
    });
    expect(writes.some((w) => w.fn === "moveOpportunityStage")).toBe(false);
  });

  it("JOB_CLOSED does not trust a closed payload when Jobber fetch returns no live job", async () => {
    const { fetchJobberJob } = await import("@/lib/jobber/ops");
    vi.mocked(fetchJobberJob).mockResolvedValueOnce(null);
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000029",
      eventKind: "JOB_CLOSED",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
      payload: { jobStatus: "closed" },
    });
    expect(writes.some((w) => w.fn === "moveOpportunityStage")).toBe(false);
  });

  it("JOB_CLOSED moves to Job Completed and does not send reviews when Gate C is off", async () => {
    const { findJobLink } = await import("@/lib/sync/match-store");
    vi.mocked(findJobLink).mockResolvedValueOnce({
      id: "jl",
      ghl_opportunity_id: "opp-live",
      last_job_status: "active",
    });
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000023",
      eventKind: "JOB_CLOSED",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
    });
    expect(writes.find((w) => w.fn === "moveOpportunityStage")?.args).toEqual({
      opportunityId: "opp-live",
      stageId: STM_GHL.jobCompletedStageId,
    });
  });

  it("quote handler reads live Jobber quote status without creating a GHL estimate", async () => {
    const { fetchJobberQuote } = await import("@/lib/jobber/ops");
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000024",
      eventKind: "QUOTE_UPDATE",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL1F1b3RlLzE=",
    });
    expect(fetchJobberQuote).toHaveBeenCalledWith("Z2lkOi8vSm9iYmVyL1F1b3RlLzE=");
    expect(writes.some((w) => w.fn === "createOpportunity")).toBe(false);
  });

  it("AI summary creates a Jobber internal note with the summary text", async () => {
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000025",
      eventKind: "CONVERSATION_SUMMARY",
      source: "ghl",
      providerEntityId: "ghl-1",
      payload: {
        summary: "Customer needs pumping next week",
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
        eventKey: "sum-1",
      },
    });
    expect(writes.find((w) => w.fn === "createJobberNote")?.args).toMatchObject({
      clientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      message: "Customer needs pumping next week",
    });
  });

  it("GHL ContactUpdate calls Jobber clientEdit then reconciles GHL from Jobber", async () => {
    const { matchCustomer } = await import("@/lib/sync/match-store");
    const { editJobberClient, fetchJobberClient } = await import("@/lib/jobber/ops");
    vi.mocked(matchCustomer).mockResolvedValueOnce({
      kind: "provider",
      jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
    });
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000026",
      eventKind: "ContactUpdate",
      source: "ghl",
      providerEntityId: "ghl-1",
      payload: {
        id: "ghl-1",
        firstName: "Pat",
        lastName: "Pilot",
        email: "pat@example.com",
        phone: "+19415550100",
      },
    });
    expect(editJobberClient).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
        email: "pat@example.com",
      })
    );
    expect(fetchJobberClient).toHaveBeenCalled();
    expect(writes.find((w) => w.fn === "upsertGhlContact")?.args).toMatchObject({
      id: "ghl-1",
    });
  });

  it("Jobber JOB_UPDATE with an existing opportunity does not create another", async () => {
    const { findJobLink } = await import("@/lib/sync/match-store");
    const { fetchJobberJob } = await import("@/lib/jobber/ops");
    vi.mocked(fetchJobberJob).mockResolvedValueOnce({
      id: "Z2lkOi8vSm9iYmVyL0pvYi8x",
      jobStatus: "active",
      title: "Pump",
      client: { id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" },
    });
    vi.mocked(findJobLink).mockResolvedValueOnce({
      id: "jl",
      ghl_opportunity_id: "opp-existing",
      last_job_status: "active",
    });
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000027",
      eventKind: "JOB_UPDATE",
      source: "jobber",
      providerEntityId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
    });
    expect(writes.some((w) => w.fn === "createOpportunity")).toBe(false);
    expect(writes.some((w) => w.fn === "moveOpportunityStage")).toBe(false);
  });
});
