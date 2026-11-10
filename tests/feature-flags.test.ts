import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import {
  canWriteToProviders,
  assertOutboundWrite,
  GateClosedError,
} from "@/lib/config/feature-flags";

describe("approval gates", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev, SYNC_ENABLED: "false", OUTBOUND_WRITES_ENABLED: "false" };
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("fails closed when outbound writes disabled (T25)", () => {
    expect(canWriteToProviders()).toBe(false);
    expect(() => assertOutboundWrite("test-op")).toThrow(GateClosedError);
  });

  it("requires both sync and outbound flags", () => {
    process.env.SYNC_ENABLED = "true";
    process.env.OUTBOUND_WRITES_ENABLED = "false";
    resetEnvCacheForTests();
    expect(canWriteToProviders()).toBe(false);
    process.env.OUTBOUND_WRITES_ENABLED = "true";
    resetEnvCacheForTests();
    expect(canWriteToProviders()).toBe(true);
  });
});
