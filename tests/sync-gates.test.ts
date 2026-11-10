import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { processSyncEvent } from "@/lib/sync/engine";
import { handleMockBooking } from "@/services/workflows/booking";

describe("integration gates (authorized tests, no live writes)", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...prev,
      OUTBOUND_WRITES_ENABLED: "false",
      CUSTOMER_MESSAGING_ENABLED: "false",
      HISTORICAL_IMPORT_ENABLED: "false",
    };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("booking stays pending when reservation cannot be verified", async () => {
    const res = await handleMockBooking({
      forcePending: true,
      reason: "no availability API",
    });
    expect(res.type).toBe("pending_jobber_confirmation");
  });

  it("job.completed does not throw when messaging gate is off", async () => {
    await processSyncEvent({
      syncEventId: "00000000-0000-0000-0000-000000000001",
      eventKind: "JOB_CLOSED",
      source: "jobber",
    });
  });
});
