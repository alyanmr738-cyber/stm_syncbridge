import { describe, expect, it } from "vitest";
import { analyzeJobRelationship } from "@/lib/sync/job-relationship-reconcile";
import { STM_GHL } from "@/lib/config/stm-mapping";

describe("analyzeJobRelationship", () => {
  const used = new Set<string>();

  it("proposes customer_link_backfill when verified mapping exists but job_links.customer_link_id is null", () => {
    const row = analyzeJobRelationship({
      jobLinkId: "jl-1",
      jobberJobId: "job-1",
      jobberClientId: "client-a",
      storedCustomerLinkId: null,
      storedOpportunityId: null,
      jobberStatus: "active",
      verifiedCustomer: { id: "cust-link-1", ghl_contact_id: "ghl-1" },
      unverifiedCustomer: null,
      usedOpportunityIds: used,
      opportunityUsageCount: 0,
      candidateOpportunities: [],
    });
    expect(
      row.proposals.some((p) => p.proposal_type === "customer_link_backfill")
    ).toBe(true);
    expect(row.proposals[0]?.rollback_sql).toContain("customer_link_id = null");
  });

  it("does not propose backfill when only unverified customer exists", () => {
    const row = analyzeJobRelationship({
      jobLinkId: "jl-2",
      jobberJobId: "job-2",
      jobberClientId: "client-b",
      storedCustomerLinkId: null,
      storedOpportunityId: null,
      jobberStatus: "active",
      verifiedCustomer: null,
      unverifiedCustomer: { id: "pending-1" },
      usedOpportunityIds: used,
      opportunityUsageCount: 0,
      candidateOpportunities: [],
    });
    expect(row.issues).toContain("unverified_syncbridge_customer_mapping");
    expect(row.proposals.some((p) => p.proposal_type === "customer_link_backfill")).toBe(
      false
    );
  });

  it("proposes opportunity_link for unique operational opportunity", () => {
    const row = analyzeJobRelationship({
      jobLinkId: "jl-3",
      jobberJobId: "job-3",
      jobberClientId: "client-c",
      storedCustomerLinkId: "cust-1",
      storedOpportunityId: null,
      jobberStatus: "active",
      verifiedCustomer: { id: "cust-1", ghl_contact_id: "ghl-1" },
      unverifiedCustomer: null,
      usedOpportunityIds: new Set(),
      opportunityUsageCount: 0,
      candidateOpportunities: [
        { id: "opp-1", pipelineStageId: STM_GHL.jobScheduledStageId },
      ],
    });
    const opp = row.proposals.find((p) => p.proposal_type === "opportunity_link");
    expect(opp?.target_ghl_opportunity_id).toBe("opp-1");
  });

  it("flags duplicate opportunity across jobs", () => {
    const row = analyzeJobRelationship({
      jobLinkId: "jl-4",
      jobberJobId: "job-4",
      jobberClientId: "client-d",
      storedCustomerLinkId: null,
      storedOpportunityId: "opp-dup",
      jobberStatus: "active",
      verifiedCustomer: { id: "cust-2", ghl_contact_id: "ghl-2" },
      unverifiedCustomer: null,
      usedOpportunityIds: new Set(["opp-dup", "opp-dup"]),
      opportunityUsageCount: 2,
      candidateOpportunities: [],
    });
    expect(row.issues).toContain("duplicate_ghl_opportunity_across_jobs");
  });
});