import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { isEventInOAuthRecoveryQuarantine } from "@/lib/jobber/recovery-quarantine";

describe("oauth recovery quarantine", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env.OAUTH_RECOVERY_QUARANTINE_ENABLED = "true";
    process.env.OAUTH_RECOVERY_QUARANTINE_SINCE = "2026-11-13T20:09:00.000Z";
    process.env.OAUTH_RECOVERY_QUARANTINE_UNTIL = "2026-11-15T13:06:08.000Z";
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("quarantines retrying/dead_letter events inside the outage window only", () => {
    expect(isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "retrying")).toBe(true);
    expect(isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "dead_letter")).toBe(true);
    expect(isEventInOAuthRecoveryQuarantine("2026-11-13T20:09:01Z", "dead_letter")).toBe(true);
  });

  it("does not quarantine queued or succeeded events in the window", () => {
    expect(isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "queued")).toBe(false);
    expect(isEventInOAuthRecoveryQuarantine("2026-11-13T20:10:00Z", "succeeded")).toBe(false);
  });

  it("does not quarantine events before since or at/after until", () => {
    expect(isEventInOAuthRecoveryQuarantine("2026-11-13T19:00:00Z", "retrying")).toBe(false);
    expect(isEventInOAuthRecoveryQuarantine("2026-11-15T13:06:08.000Z", "dead_letter")).toBe(false);
    expect(isEventInOAuthRecoveryQuarantine("2026-11-15T18:23:26Z", "retrying")).toBe(false);
    expect(isEventInOAuthRecoveryQuarantine("2026-11-16T10:00:00Z", "dead_letter")).toBe(false);
  });
});
