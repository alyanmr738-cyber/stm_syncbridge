import { describe, expect, it } from "vitest";
import {
  customerLinksWithOpenConflicts,
  jobCountByCustomerLink,
  normalizeProviderEntityId,
} from "@/lib/display/customer-ops";
import { resolveGhlStageName } from "@/lib/ghl/pipeline-stages";
import { STM_GHL } from "@/lib/config/stm-mapping";
import { classifyProcessOutcome } from "@/lib/display/process-outcome";

describe("customerLinksWithOpenConflicts", () => {
  const customers = [
    { id: "link-a", jobber_client_id: "jobber-1", ghl_contact_id: "ghl-1" },
    { id: "link-b", jobber_client_id: "jobber-2", ghl_contact_id: "ghl-2" },
  ];

  it("maps Jobber client conflicts to customer link id", () => {
    const ids = customerLinksWithOpenConflicts(
      [{ state: "open", entity_type: "customer", source_entity_id: "jobber-1" }],
      customers
    );
    expect(ids.has("link-a")).toBe(true);
    expect(ids.has("link-b")).toBe(false);
  });

  it("maps GHL contact conflicts to customer link id", () => {
    const ids = customerLinksWithOpenConflicts(
      [{ state: "open", entity_type: "customer", source_entity_id: " ghl-2 " }],
      customers
    );
    expect(ids.has("link-b")).toBe(true);
  });

  it("ignores resolved conflicts and non-customer entities", () => {
    const ids = customerLinksWithOpenConflicts(
      [
        { state: "resolved", entity_type: "customer", source_entity_id: "jobber-1" },
        { state: "open", entity_type: "job", source_entity_id: "jobber-1" },
      ],
      customers
    );
    expect(ids.size).toBe(0);
  });

  it("does not attach conflict when id matches two different links", () => {
    const ids = customerLinksWithOpenConflicts(
      [{ state: "open", entity_type: "customer", source_entity_id: "shared" }],
      [
        { id: "x", jobber_client_id: "shared", ghl_contact_id: null },
        { id: "y", jobber_client_id: null, ghl_contact_id: "shared" },
      ]
    );
    expect(ids.size).toBe(0);
  });
});

describe("jobCountByCustomerLink", () => {
  const customers = [
    { id: "cust-1", jobber_client_id: "jb-a" },
    { id: "cust-2", jobber_client_id: "jb-b" },
  ];

  it("counts via jobberClientId without customer_link_id", () => {
    const counts = jobCountByCustomerLink(customers, [
      { jobberClientId: "jb-a", jobberJobId: "job-1" },
      { jobberClientId: "jb-a", jobberJobId: "job-2" },
      { jobberClientId: "jb-b", jobberJobId: "job-3" },
    ]);
    expect(counts.get("cust-1")).toBe(2);
    expect(counts.get("cust-2")).toBe(1);
  });

  it("does not double-count duplicate job rows", () => {
    const counts = jobCountByCustomerLink(customers, [
      { jobberClientId: "jb-a", jobberJobId: "job-1" },
      { jobberClientId: "jb-a", jobberJobId: "job-1" },
    ]);
    expect(counts.get("cust-1")).toBe(1);
  });

  it("ignores jobs with no matching customer link", () => {
    const counts = jobCountByCustomerLink(customers, [
      { jobberClientId: "jb-unknown", jobberJobId: "job-9" },
    ]);
    expect(counts.size).toBe(0);
  });
});

describe("normalizeProviderEntityId", () => {
  it("trims whitespace", () => {
    expect(normalizeProviderEntityId("  abc ")).toBe("abc");
  });
});

describe("resolveGhlStageName", () => {
  it("uses authoritative pipeline stage names when present", () => {
    const map = new Map([[STM_GHL.jobCompletedStageId, "Job Completed"]]);
    expect(resolveGhlStageName(STM_GHL.jobCompletedStageId, map)).toBe("Job Completed");
  });
});

describe("provider write attribution", () => {
  it("does not treat succeeded without process_outcome as provider write", () => {
    expect(
      classifyProcessOutcome({ status: "succeeded", recordedOutcome: null })
    ).toBe("write_not_recorded");
    expect(
      classifyProcessOutcome({ status: "succeeded", recordedOutcome: "provider_write" })
    ).toBe("provider_write");
  });
});