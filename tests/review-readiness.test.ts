import { describe, expect, it } from "vitest";
import { reviewEligibilityForJob } from "@/lib/sync/review-readiness";

describe("review readiness", () => {
  it("suppresses when Gate C off", () => {
    expect(reviewEligibilityForJob({ gateMessagingOn: false, jobClosed: true }).status).toBe(
      "suppressed"
    );
  });

  it("detects duplicate ledger", () => {
    expect(
      reviewEligibilityForJob({
        gateMessagingOn: true,
        jobClosed: true,
        existingLedgerStatus: "eligible",
      }).status
    ).toBe("duplicate");
  });
});