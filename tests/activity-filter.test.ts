import { describe, expect, it } from "vitest";
import { classifyProcessOutcome, outcomeLabel } from "@/lib/display/process-outcome";

/** Mirrors ActivityBoard failure filter semantics. */
function activityErrorsFilter(outcome: ReturnType<typeof classifyProcessOutcome>): boolean {
  return (
    outcome === "failed" || outcome === "dead_letter" || outcome === "retrying"
  );
}

describe("activity filter navigation", () => {
  it("errors filter matches failed, dead_letter, and retrying outcomes", () => {
    expect(activityErrorsFilter(classifyProcessOutcome({ status: "dead_letter" }))).toBe(
      true
    );
    expect(activityErrorsFilter(classifyProcessOutcome({ status: "retrying" }))).toBe(true);
    expect(
      activityErrorsFilter(
        classifyProcessOutcome({ status: "succeeded", recordedOutcome: "provider_write" })
      )
    ).toBe(false);
  });

  it("overview sync failures should use errors filter id", () => {
    expect(outcomeLabel("dead_letter")).toMatch(/Dead-lettered/i);
  });
});