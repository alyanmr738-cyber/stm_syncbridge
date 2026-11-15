import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { isEventInOAuthRecoveryQuarantine } from "@/lib/jobber/recovery-quarantine";

describe("oauth recovery quarantine", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env.OAUTH_RECOVERY_QUARANTINE_ENABLED = "true";
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("quarantines retrying outage events only", () => {
    expect(
      isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "retrying")
    ).toBe(true);
    expect(
      isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "dead_letter")
    ).toBe(true);
    expect(
      isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "queued")
    ).toBe(false);
    expect(
      isEventInOAuthRecoveryQuarantine("2026-11-13T19:00:00Z", "retrying")
    ).toBe(false);
  });
});