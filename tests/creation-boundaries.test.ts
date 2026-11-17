import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import {
  assertProviderCreateAllowed,
  creationCanaryMatchesRequest,
  resetCreationCanaryLedgerForTests,
} from "@/lib/config/creation-canary";
import { pilotAllows } from "@/lib/config/pilot";

const prev = { ...process.env };

describe("creation authorization boundaries", () => {
  beforeEach(() => {
    process.env = {
      ...prev,
      ALLOW_RECORD_CREATION: "true",
      SYNC_ENABLED: "true",
      OUTBOUND_WRITES_ENABLED: "true",
      CREATION_CANARY_ENABLED: "false",
      CREATION_CANARY_GHL_CONTACT_ID: "ghl-1",
      CREATION_CANARY_SERVICE_REQUEST_KEYS: "req-1",
    };
    resetEnvCacheForTests();
    resetCreationCanaryLedgerForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("rejects Jobber creates when global ALLOW_RECORD_CREATION=true but canary off", async () => {
    await expect(
      assertProviderCreateAllowed({
        operation: "test",
        ghlContactId: "ghl-1",
        serviceRequestKey: "req-1",
        kind: "job",
      })
    ).rejects.toThrow(/canary not enabled/);
    expect(
      pilotAllows({
        ghlContactId: "ghl-1",
        creatingJobberJob: true,
        creationCanaryRequestKey: "req-1",
      })
    ).toBe(false);
  });

  it("rejects unauthorized contacts even if canary enabled", () => {
    process.env.CREATION_CANARY_ENABLED = "true";
    process.env.CREATION_CANARY_NOT_BEFORE = "2020-01-01T00:00:00Z";
    process.env.CREATION_CANARY_NOT_AFTER = "2099-01-01T00:00:00Z";
    resetEnvCacheForTests();
    expect(
      creationCanaryMatchesRequest({ ghlContactId: "other", serviceRequestKey: "req-1" })
    ).toBe(false);
    expect(
      pilotAllows({
        ghlContactId: "other",
        creatingJobberClient: true,
        creationCanaryRequestKey: "req-1",
      })
    ).toBe(false);
  });
});