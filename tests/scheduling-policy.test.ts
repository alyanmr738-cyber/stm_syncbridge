import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";

describe("scheduling knobs", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = { ...prev };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("does not invent a two-hour rule when unset", () => {
    delete process.env.MIN_BOOKING_LEAD_TIME_MINUTES;
    delete process.env.VISIT_BUFFER_MINUTES;
    resetEnvCacheForTests();
    const p = getSchedulingPolicy();
    expect(p.minBookingLeadTimeMinutes).toBeNull();
    expect(p.autoSchedulingEnabled).toBe(false);
  });
});
