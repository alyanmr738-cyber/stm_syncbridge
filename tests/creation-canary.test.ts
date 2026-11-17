import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import {
  assertCreationCanaryWrite,
  assertProviderCreateAllowed,
  creationCanaryAllowsProviderCreate,
  creationCanaryMatchesRequest,
  resetCreationCanaryLedgerForTests,
} from "@/lib/config/creation-canary";
import {
  completeCanarySlot,
  getOrCreateCanaryLedger,
  reserveCanarySlot,
  resetCreationLedgerForTests,
} from "@/lib/sync/creation-ledger";
import { pilotAllows } from "@/lib/config/pilot";

const prev = { ...process.env };

describe("creation canary allowlist", () => {
  beforeEach(() => {
    resetCreationCanaryLedgerForTests();
    process.env = {
      ...prev,
      ALLOW_RECORD_CREATION: "",
      SYNC_ENABLED: "true",
      OUTBOUND_WRITES_ENABLED: "true",
      CREATION_CANARY_ENABLED: "true",
      CREATION_CANARY_GHL_CONTACT_ID: "canary-contact-1",
      CREATION_CANARY_SERVICE_REQUEST_KEYS: "req-live-001",
      CREATION_CANARY_NOT_BEFORE: "2020-01-01T00:00:00.000Z",
      CREATION_CANARY_NOT_AFTER: "2099-01-01T00:00:00.000Z",
      CREATION_CANARY_MAX_CLIENTS: "1",
      CREATION_CANARY_MAX_JOBS: "1",
      CREATION_CANARY_ALLOW_NEW_CLIENT: "true",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
    resetCreationCanaryLedgerForTests();
    resetCreationLedgerForTests();
    process.env.CREATION_LEDGER_MEMORY = "true";
  });

  it("matches only the designated contact and request", () => {
    expect(
      creationCanaryMatchesRequest({
        ghlContactId: "canary-contact-1",
        serviceRequestKey: "req-live-001",
      })
    ).toBe(true);
    expect(
      creationCanaryMatchesRequest({
        ghlContactId: "other-contact",
        serviceRequestKey: "req-live-001",
      })
    ).toBe(false);
  });

  it("exhausts budget after one client and one job in ledger", async () => {
    const ledger = await getOrCreateCanaryLedger({
      ghlContactId: "canary-contact-1",
      serviceRequestKey: "req-live-001",
    });
    expect(ledger?.id).toBeTruthy();
    await reserveCanarySlot({ kind: "client", ledgerId: ledger!.id, owner: "t" });
    await completeCanarySlot({
      kind: "client",
      ledgerId: ledger!.id,
      providerId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
    });
    await reserveCanarySlot({ kind: "job", ledgerId: ledger!.id, owner: "t" });
    await completeCanarySlot({
      kind: "job",
      ledgerId: ledger!.id,
      providerId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
    });
    await expect(
      assertProviderCreateAllowed({
        operation: "test.job2",
        ghlContactId: "canary-contact-1",
        serviceRequestKey: "req-live-001",
        kind: "job",
      })
    ).rejects.toThrow();
  });

  it("blocks unrelated production writes via pilot when creation is off globally", () => {
    expect(
      pilotAllows({
        ghlContactId: "unrelated-contact",
        creatingJobberJob: true,
        creationCanaryRequestKey: "req-live-001",
      })
    ).toBe(false);
    expect(
      pilotAllows({
        ghlContactId: "canary-contact-1",
        creatingJobberJob: true,
        creationCanaryRequestKey: "req-live-001",
      })
    ).toBe(true);
  });

  it("rejects when canary disabled", () => {
    process.env.CREATION_CANARY_ENABLED = "false";
    resetEnvCacheForTests();
    expect(() =>
      assertCreationCanaryWrite({
        operation: "job",
        ghlContactId: "canary-contact-1",
        serviceRequestKey: "req-live-001",
        kind: "job",
      })
    ).toThrow(/canary not enabled/);
  });
});