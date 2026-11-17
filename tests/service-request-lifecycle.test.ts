import { describe, expect, it } from "vitest";
import {
  parseServiceRequestPayload,
  planServiceRequest,
} from "@/lib/sync/service-request";

describe("service request lifecycle planning", () => {
  it("existing verified customer → new job", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-1",
      serviceRequestId: "req-1",
      intent: "new_service_request",
      serviceKey: "pump-out",
    });
    expect(parsed?.serviceRequestKey).toBe("req-1");
    const plan = planServiceRequest({
      parsed: parsed!,
      match: {
        kind: "linked",
        customerLinkId: "link-1",
        verified: true,
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      },
    });
    expect(plan).toEqual({
      action: "reuse_existing_client",
      jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      customerLinkId: "link-1",
      createJob: true,
    });
  });

  it("new customer → new job plan (blocked until canary)", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-new",
      serviceRequestId: "req-new",
    });
    const plan = planServiceRequest({
      parsed: parsed!,
      match: { kind: "create" },
    });
    expect(plan).toEqual({
      action: "create_client_then_job",
      createClient: true,
      createJob: true,
    });
  });

  it("duplicate request suppression", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-1",
      serviceRequestId: "req-dupe",
    });
    const plan = planServiceRequest({
      parsed: parsed!,
      match: {
        kind: "linked",
        customerLinkId: "link-1",
        verified: true,
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      },
      existingJobLinkId: "prior-link",
    });
    expect(plan).toEqual({ action: "duplicate", priorLinkId: "prior-link" });
  });

  it("ambiguous identity never merges", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-1",
      serviceRequestId: "req-ambig",
    });
    const plan = planServiceRequest({
      parsed: parsed!,
      match: { kind: "ambiguous", candidateIds: ["a", "b"] },
    });
    expect(plan.action).toBe("blocked_ambiguous");
  });

  it("customer exists under another identity", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-1",
      serviceRequestId: "req-x",
    });
    const plan = planServiceRequest({
      parsed: parsed!,
      match: { kind: "provider", jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8y" },
      verifiedJobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8z",
    });
    expect(plan.action).toBe("blocked_ambiguous");
    if (plan.action === "blocked_ambiguous") {
      expect(plan.reason).toBe("customer_exists_under_another_identity");
    }
  });

  it("reschedule stays pending review (no auto confirm)", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-1",
      serviceRequestId: "req-r",
      intent: "reschedule",
    });
    const plan = planServiceRequest({
      parsed: parsed!,
      match: {
        kind: "linked",
        customerLinkId: "l",
        verified: true,
        jobberClientId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x",
      },
    });
    expect(plan).toEqual({
      action: "pending_review",
      reason: "reschedule_requires_staff_confirmation",
    });
  });

  it("additional visit reuses existing job", () => {
    const parsed = parseServiceRequestPayload({
      contactId: "ghl-1",
      serviceRequestId: "req-v",
      intent: "additional_visit",
      jobberJobId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
    });
    const plan = planServiceRequest({
      parsed: parsed!,
      match: { kind: "create" },
    });
    expect(plan).toEqual({
      action: "additional_visit",
      jobberJobId: "Z2lkOi8vSm9iYmVyL0pvYi8x",
      createJob: false,
    });
  });
});