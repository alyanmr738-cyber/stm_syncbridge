import { describe, expect, it } from "vitest";
import { parseGhlWebhookPayload } from "@/lib/webhooks/ghl-inbound";

describe("parseGhlWebhookPayload (workflow / custom webhook)", () => {
  it("infers ContactUpdate from flat workflow body", () => {
    const p = parseGhlWebhookPayload({
      locationId: "loc-1",
      id: "ct-1",
      firstName: "Evan",
      lastName: "Test",
    });
    expect(p.eventKind).toBe("ContactUpdate");
    expect(p.contactId).toBe("ct-1");
    expect(p.providerEventKey).toBe("ghl:ContactUpdate:ct-1");
  });

  it("uses explicit syncEventKey for dedupe", () => {
    const p = parseGhlWebhookPayload({
      type: "ContactUpdate",
      contactId: "ct-1",
      syncEventKey: "wf-run-99",
    });
    expect(p.providerEventKey).toBe("wf-run-99");
  });

  it("uses executionId when present", () => {
    const p = parseGhlWebhookPayload({
      type: "ContactUpdate",
      contactId: "ct-1",
      executionId: "exec-abc",
    });
    expect(p.providerEventKey).toBe("ghl:ContactUpdate:ct-1:exec-abc");
  });

  it("classifies service request when serviceRequestId present", () => {
    const p = parseGhlWebhookPayload({
      type: "Lead",
      contactId: "ct-svc",
      serviceRequestId: "req-100",
    });
    expect(p.eventKind).toBe("ServiceRequest");
    expect(p.providerEventKey).toBe("ghl:ServiceRequest:ct-svc");
  });

  it("reads nested contact object", () => {
    const p = parseGhlWebhookPayload({
      locationId: "loc-1",
      contact: { id: "nested", firstName: "A", lastName: "B" },
    });
    expect(p.contactId).toBe("nested");
    expect(p.eventKind).toBe("ContactUpdate");
  });
});