import { describe, expect, it } from "vitest";
import {
  classifyOpportunityStage,
  isOperationalJobStatus,
} from "@/lib/sync/job-opp-candidates";
import { STM_GHL } from "@/lib/config/stm-mapping";

describe("job/opportunity candidate filters", () => {
  it("treats archived/cancelled jobs as non-operational", () => {
    expect(isOperationalJobStatus("archived")).toBe(false);
    expect(isOperationalJobStatus("cancelled")).toBe(false);
    expect(isOperationalJobStatus("active")).toBe(true);
    expect(isOperationalJobStatus("requires_invoicing")).toBe(true);
  });

  it("only scheduled/completed stages are operational", () => {
    expect(classifyOpportunityStage(STM_GHL.jobScheduledStageId)).toBe("operational");
    expect(classifyOpportunityStage(STM_GHL.jobCompletedStageId)).toBe("operational");
    expect(classifyOpportunityStage("24f673b2-2610-410b-a172-73f9352f6b29")).toBe("historical");
  });
});
