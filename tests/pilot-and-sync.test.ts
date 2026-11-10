import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import {
  canWriteForEntities,
  canWriteToProviders,
  isPilotEntity,
} from "@/lib/config/feature-flags";
import { STM_GHL } from "@/lib/config/stm-mapping";
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
