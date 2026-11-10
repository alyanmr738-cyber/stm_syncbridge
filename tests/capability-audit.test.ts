import { describe, it, expect } from "vitest";
import { runCapabilityAudit } from "@/services/audit/capability-audit";

describe("capability audit", () => {
  it("includes integration fallback rows and three approval topics", async () => {
    const report = await runCapabilityAudit();
    expect(report.businessApprovalsPending.length).toBeGreaterThanOrEqual(3);
    expect(
      report.matrix.some((r) => r.operation.includes("pending_jobber_confirmation"))
    ).toBe(true);
    expect(report.approvalGates.production_writes).toBe(false);
  });
});
