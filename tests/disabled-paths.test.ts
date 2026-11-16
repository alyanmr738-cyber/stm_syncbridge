import { describe, expect, it } from "vitest";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { gateStatus } from "@/lib/config/feature-flags";
import { assertHistoricalExecute } from "@/lib/sync/historical";
import { GateClosedError } from "@/lib/config/feature-flags";

describe("disabled production paths stay closed", () => {
  it("historical execute is blocked", () => {
    expect(() => assertHistoricalExecute()).toThrow(GateClosedError);
  });

  it("booking auto-schedule is off without buffers + gate", () => {
    const p = getSchedulingPolicy();
    expect(p.autoSchedulingEnabled).toBe(false);
    expect(p.emergencyAutoBookEnabled).toBe(false);
  });

  it("snapshot keeps B/C-class gates off in unit env", () => {
    const g = gateStatus();
    expect(g.historical_backfill).toBe(false);
  });
});
