import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import {
  canWriteForEntities,
  canWriteToProviders,
  isPilotEntity,
} from "@/lib/config/feature-flags";
import { pilotAllows } from "@/lib/config/pilot";
import { STM_GHL } from "@/lib/config/stm-mapping";
import { isJobberEncodedId } from "@/lib/jobber/ops";
import { processSyncEvent } from "@/lib/sync/engine";
import { decideMatch } from "@/lib/sync/identity";

describe("pilot allowlist does not enable Gate A", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = {
      ...prev,
      SYNC_ENABLED: "false",
      OUTBOUND_WRITES_ENABLED: "false",
      CUSTOMER_MESSAGING_ENABLED: "false",
      HISTORICAL_IMPORT_ENABLED: "false",
      PILOT_ENTITY_IDS: "pilot-jobber-1,pilot-ghl-1",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("keeps unrestricted writes off", () => {
    expect(canWriteToProviders()).toBe(false);
  });

  it("allows only listed ids", () => {
    expect(isPilotEntity("pilot-jobber-1")).toBe(true);
    expect(canWriteForEntities(["pilot-jobber-1", "pilot-ghl-1"])).toBe(true);
    expect(canWriteForEntities(["pilot-jobber-1", "someone-else"])).toBe(false);
    expect(canWriteForEntities([])).toBe(false);
  });
});

describe("typed pilot scope", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = {
      ...prev,
      SYNC_ENABLED: "false",
      OUTBOUND_WRITES_ENABLED: "false",
      PILOT_JOBBER_CLIENT_IDS: "jb-client-1",
      PILOT_GHL_CONTACT_IDS: "ghl-contact-1",
      PILOT_JOBBER_JOB_IDS: "jb-job-1",
      PILOT_GHL_OPPORTUNITY_IDS: "ghl-opp-1",
      PILOT_ENTITY_IDS: "",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("blocks creating a GHL contact while Gate A is off (existing-records-only)", () => {
    expect(
      pilotAllows({ jobberClientId: "jb-client-1", creatingGhlContact: true })
    ).toBe(false);
    expect(
      pilotAllows({
        jobberClientId: "jb-client-1",
        ghlContactId: "ghl-contact-1",
        creatingGhlContact: false,
      })
    ).toBe(true);
  });

  it("Gate A does not allow creating contacts without ALLOW_RECORD_CREATION", () => {
    process.env.SYNC_ENABLED = "true";
    process.env.OUTBOUND_WRITES_ENABLED = "true";
    process.env.ALLOW_RECORD_CREATION = "";
    process.env.PILOT_EXISTING_RECORDS_ONLY = "true";
    resetEnvCacheForTests();
    expect(canWriteToProviders()).toBe(true);
    expect(
      pilotAllows({ jobberClientId: "jb-client-1", creatingGhlContact: true })
    ).toBe(false);
    expect(
      pilotAllows({
        jobberClientId: "jb-client-1",
        ghlContactId: "ghl-contact-1",
        creatingGhlContact: false,
      })
    ).toBe(true);
  });

  it("blocks updating an unlisted GHL contact even if Jobber parent is approved", () => {
    expect(
      pilotAllows({
        jobberClientId: "jb-client-1",
        ghlContactId: "random-ghl",
        creatingGhlContact: false,
      })
    ).toBe(false);
    expect(
      pilotAllows({
        jobberClientId: "jb-client-1",
        ghlContactId: "ghl-contact-1",
      })
    ).toBe(true);
  });
});

describe("Jobber encoded ids", () => {
  it("rejects probe strings so GraphQL is not called", () => {
    expect(isJobberEncodedId("final-verify-1")).toBe(false);
    expect(isJobberEncodedId("Z2lkOi8vSm9iYmVyL0NsaWVudC8x")).toBe(true);
  });
});

describe("STM mapping", () => {
  it("uses Septic Tank Man ids not Arizona Sign Company", () => {
    expect(STM_GHL.locationId).toBe("p7HYMD0h2RScLKL68uj0");
    expect(STM_GHL.salesPipelineId).toBe("UMelQ0AisTqWdPl1XHK6");
    expect(STM_GHL.jobCompletedStageId).toBe("1724dc1d-02f1-422c-825f-bebb9d427e71");
  });
});

describe("no accidental merge", () => {
  it("will not pick a single link when two candidates exist", () => {
    const d = decideMatch({ exactIdHits: ["c1"], emailPhoneHits: ["c2"] });
    expect(d.kind).toBe("ambiguous");
  });
});

describe("completion without messaging", () => {
  it("does not throw when Gate C is off", async () => {
    process.env.OUTBOUND_WRITES_ENABLED = "false";
    process.env.CUSTOMER_MESSAGING_ENABLED = "false";
    process.env.JOB_COMPLETION_SYNC_ENABLED = "false";
    resetEnvCacheForTests();
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000099",
      eventKind: "JOB_CLOSED",
      source: "jobber",
    });
  });
});
