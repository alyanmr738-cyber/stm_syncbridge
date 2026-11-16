import { describe, expect, it } from "vitest";
import { assessFinanceReadiness } from "@/lib/sync/finance-readiness";

describe("finance readiness", () => {
  it("tracks invoice paid vs invoiced when flags off", () => {
    const row = assessFinanceReadiness({
      id: "1",
      kind: "invoice",
      jobberId: "inv-1",
      status: "paid",
      clientId: "client-1",
      ghlSyncEnabled: false,
    });
    expect(row.customerResolvable).toBe(true);
    expect(row.issues).toContain("distinguish_paid_from_invoiced_required");
  });

  it("blocks ghl when sync flag on without gate approval", () => {
    const row = assessFinanceReadiness({
      id: "2",
      kind: "quote",
      jobberId: "q-1",
      clientId: null,
      ghlSyncEnabled: true,
    });
    expect(row.issues).toContain("jobber_customer_unresolved");
    expect(row.issues).toContain("ghl_write_flag_on_requires_gate");
  });
});