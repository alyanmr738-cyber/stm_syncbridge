import { describe, expect, it } from "vitest";
import { buildClientEditVariables } from "@/lib/jobber/ops";
import {
  collectIdHits,
  decideProviderMatch,
  isObsoleteJobberSchemaError,
  jobberClientToGhlPayload,
  jobCancelled,
  jobClosed,
  jobStageForStatus,
  quoteInvoiceNoteBody,
  shouldReuseJob,
} from "@/lib/sync/matching";

const client = {
  id: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
  firstName: "Abel",
  lastName: "Viamontes",
  emails: [{ address: "a@example.com" }],
  phones: [{ number: "(941) 275-4761" }],
  clientProperties: {
    nodes: [
      {
        id: "Z2lkOi8vSm9iYmVyL1Byb3BlcnR5LzE=",
        address: { street1: "5379 VIXEN TER", city: "NORTH PORT", postalCode: "34286" },
      },
    ],
  },
};

describe("identity when links are empty", () => {
  it("matches a single GHL hit by email or phone", () => {
    const hits = collectIdHits(
      [{ id: "ghl-1", emails: ["A@example.com"], phones: ["9412754761"] }],
      "a@example.com",
      "(941) 275-4761"
    );
    expect(hits).toEqual(["ghl-1"]);
    expect(decideProviderMatch({ ghlHits: hits, jobberHits: [] }).kind).toBe("provider");
  });

  it("flags two GHL contacts as ambiguous (no merge)", () => {
    const d = decideProviderMatch({ ghlHits: ["a", "b"], jobberHits: [] });
    expect(d.kind).toBe("ambiguous");
  });

  it("creates when neither side matches", () => {
    expect(decideProviderMatch({ ghlHits: [], jobberHits: [] }).kind).toBe("create");
  });
});

describe("Jobber → GHL payload", () => {
  it("maps name, phone, address, and Jobber client id", () => {
    const p = jobberClientToGhlPayload(client);
    expect(p.email).toBe("a@example.com");
    expect(p.phone).toBe("+19412754761");
    expect(p.address1).toBe("5379 VIXEN TER");
    expect(p.jobberClientId).toBe(client.id);
  });
});

describe("Jobber clientEdit payload (2026-11-03)", () => {
  it("uses clientId + emailsToAdd/phonesToAdd, not input.id", () => {
    const v = buildClientEditVariables({
      id: client.id,
      email: "new@example.com",
      phone: "+19415551212",
      existing: client,
    });
    expect(v.clientId).toBe(client.id);
    expect(v.input).not.toHaveProperty("id");
    expect(v.input.emailsToAdd).toEqual([{ address: "new@example.com", primary: true }]);
    expect(v.input.phonesToAdd).toBeTruthy();
  });

  it("does not re-add an email the client already has", () => {
    const v = buildClientEditVariables({
      id: client.id,
      email: "a@example.com",
      existing: client,
    });
    expect(v.input.emailsToAdd).toBeUndefined();
  });
});

describe("jobs and documents", () => {
  it("reuses the same Jobber job id", () => {
    expect(shouldReuseJob("job-1", "job-1")).toBe(true);
    expect(shouldReuseJob("job-1", "job-2")).toBe(false);
  });

  it("treats closed/complete as completion", () => {
    expect(jobClosed("closed")).toBe(true);
    expect(jobClosed("active")).toBe(false);
    expect(jobCancelled("cancelled")).toBe(true);
    expect(jobStageForStatus("closed")).toBe("completed");
    expect(jobStageForStatus("cancelled")).toBe("cancelled");
    expect(jobStageForStatus("active")).toBe("scheduled");
  });

  it("detects obsolete Jobber emails{nodes} dead letters", () => {
    expect(
      isObsoleteJobberSchemaError("Field 'nodes' doesn't exist on type 'Email'")
    ).toBe(true);
    expect(isObsoleteJobberSchemaError("GHL GET 422")).toBe(false);
  });

  it("builds an idempotent quote/invoice note body", () => {
    const a = quoteInvoiceNoteBody("quote", { id: "q1", number: "12", status: "approved" });
    const b = quoteInvoiceNoteBody("quote", { id: "q1", number: "12", status: "approved" });
    expect(a).toBe(b);
    expect(a).toContain("quote 12");
  });
});
