import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { resetCreationCanaryLedgerForTests } from "@/lib/config/creation-canary";
import { syncServiceRequest, type LoadedEvent } from "@/lib/sync/handlers";

const writes: string[] = [];

vi.mock("@/lib/ghl/rest", () => ({
  getGhlContact: vi.fn(async () => ({
    id: "canary-contact-1",
    firstName: "Canary",
    lastName: "Operator",
    email: "canary@internal.example",
    phone: "+19415550199",
  })),
  upsertGhlContact: vi.fn(async (input: { id: string }) => {
    writes.push(`ghl:${input.id}`);
    return { id: input.id };
  }),
}));

vi.mock("@/lib/jobber/ops", async () => {
  const actual = await vi.importActual<typeof import("@/lib/jobber/ops")>("@/lib/jobber/ops");
  return {
    ...actual,
    createJobberClient: vi.fn(async () => {
      writes.push("clientCreate");
      return "Z2lkOi8vSm9iYmVyL0NsaWVudC85OTk=";
    }),
    createJobberJob: vi.fn(async () => {
      writes.push("jobCreate");
      return "Z2lkOi8vSm9iYmVyL0pvYi85OTk=";
    }),
    fetchJobberClient: vi.fn(),
    searchJobberClients: vi.fn(async () => []),
  };
});

vi.mock("@/lib/sync/match-store", () => ({
  findJobLink: vi.fn(async () => null),
  matchCustomer: vi.fn(async () => ({ kind: "create" })),
  upsertCustomerLink: vi.fn(async () => "link-1"),
  upsertJobLink: vi.fn(async () => "job-link-1"),
  openConflict: vi.fn(),
}));

const prev = { ...process.env };

function event(payload: Record<string, unknown>): LoadedEvent {
  return {
    id: "evt-1",
    source: "ghl",
    eventKind: "ServiceRequest",
    providerEntityId: null,
    payload,
  };
}

describe("syncServiceRequest handler", () => {
  beforeEach(() => {
    writes.length = 0;
    resetCreationCanaryLedgerForTests();
    process.env = {
      ...prev,
      SYNC_ENABLED: "true",
      OUTBOUND_WRITES_ENABLED: "true",
      ALLOW_RECORD_CREATION: "",
      CREATION_CANARY_ENABLED: "false",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
    resetCreationCanaryLedgerForTests();
  });

  it("with canary off performs no provider creates", async () => {
    const outcome = await syncServiceRequest(
      event({
        contactId: "canary-contact-1",
        serviceRequestId: "req-1",
      })
    );
    expect(outcome).toBe("local_state_only");
    expect(writes).toEqual([]);
  });

  it("with canary on allows one client and one job", async () => {
    process.env.CREATION_CANARY_ENABLED = "true";
    process.env.CREATION_CANARY_GHL_CONTACT_ID = "canary-contact-1";
    process.env.CREATION_CANARY_SERVICE_REQUEST_KEYS = "req-live-001";
    process.env.CREATION_CANARY_NOT_BEFORE = "2020-01-01T00:00:00.000Z";
    process.env.CREATION_CANARY_NOT_AFTER = "2099-01-01T00:00:00.000Z";
    process.env.CREATION_CANARY_ALLOW_NEW_CLIENT = "true";
    resetEnvCacheForTests();

    const outcome = await syncServiceRequest(
      event({
        contactId: "canary-contact-1",
        serviceRequestId: "req-live-001",
        serviceKey: "pump-out",
      })
    );
    expect(outcome).toBe("provider_write");
    expect(writes).toEqual(["clientCreate", "jobCreate", "ghl:canary-contact-1"]);
  });

  it("unlisted contact never calls Jobber", async () => {
    process.env.CREATION_CANARY_ENABLED = "true";
    process.env.CREATION_CANARY_GHL_CONTACT_ID = "canary-contact-1";
    process.env.CREATION_CANARY_SERVICE_REQUEST_KEYS = "req-live-001";
    process.env.CREATION_CANARY_NOT_BEFORE = "2020-01-01T00:00:00.000Z";
    process.env.CREATION_CANARY_NOT_AFTER = "2099-01-01T00:00:00.000Z";
    resetEnvCacheForTests();

    const outcome = await syncServiceRequest(
      event({ contactId: "someone-else", serviceRequestId: "req-live-001" })
    );
    expect(outcome).toBe("local_state_only");
    expect(writes).toEqual([]);
  });
});