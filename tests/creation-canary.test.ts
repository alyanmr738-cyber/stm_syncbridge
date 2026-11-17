import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import {
  assertCreationCanaryWrite,
  assertProviderCreateAllowed,
  creationCanaryAllowsProviderCreate,
  creationCanaryMatchesRequest,
  getCreationCanaryLedger,
  recordCreationCanaryWrite,
  resetCreationCanaryLedgerForTests,
} from "@/lib/config/creation-canary";
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

  it("exhausts budget after one client and one job", () => {
    expect(
      creationCanaryAllowsProviderCreate({
        ghlContactId: "canary-contact-1",
        serviceRequestKey: "req-live-001",
        kind: "client",
      })
    ).toBe(true);
    recordCreationCanaryWrite({ kind: "client", providerId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" });
    expect(
      creationCanaryAllowsProviderCreate({
        ghlContactId: "canary-contact-1",
        serviceRequestKey: "req-live-001",
        kind: "client",
      })
    ).toBe(false);
    expect(getCreationCanaryLedger().clientsCreated).toBe(1);
    assertProviderCreateAllowed({
      operation: "test.job",
      ghlContactId: "canary-contact-1",
      serviceRequestKey: "req-live-001",
      kind: "job",
    });
    recordCreationCanaryWrite({ kind: "job", providerId: "Z2lkOi8vSm9iYmVyL0pvYi8x" });
    expect(
      creationCanaryAllowsProviderCreate({
        ghlContactId: "canary-contact-1",
        serviceRequestKey: "req-live-001",
        kind: "job",
      })
    ).toBe(false);
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