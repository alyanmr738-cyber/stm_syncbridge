import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyJobberWebhook } from "@/lib/webhooks/verify";
import { authorizeGhlRequest } from "@/lib/webhooks/ghl-verify";

describe("webhook HMAC (T22)", () => {
  it("accepts matching Jobber signature over raw bytes", () => {
    const body = Buffer.from('{"topic":"JOB_UPDATE"}');
    const secret = "test-secret";
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyJobberWebhook(body, sig, secret)).toBe(true);
  });

  it("rejects spoofed signature", () => {
    const body = Buffer.from('{"topic":"JOB_UPDATE"}');
    expect(verifyJobberWebhook(body, "deadbeef", "test-secret")).toBe(false);
  });
});

describe("GHL webhook auth fail-closed", () => {
  const raw = Buffer.from('{"type":"ContactUpdate"}');

  it("rejects unsigned requests", () => {
    const r = authorizeGhlRequest({
      rawBody: raw,
      ghlSignature: null,
      whSignature: null,
    });
    expect(r.ok).toBe(false);
  });

  it("accepts workflow shared secret", () => {
    const r = authorizeGhlRequest({
      rawBody: raw,
      ghlSignature: null,
      whSignature: null,
      workflowSecret: "wf-secret",
      presentedSecret: "wf-secret",
    });
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("workflow_secret");
  });

  it("rejects wrong workflow secret", () => {
    const r = authorizeGhlRequest({
      rawBody: raw,
      ghlSignature: null,
      whSignature: null,
      workflowSecret: "wf-secret",
      presentedSecret: "nope",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects bogus platform signature", () => {
    const r = authorizeGhlRequest({
      rawBody: raw,
      ghlSignature: "AAAA",
      whSignature: null,
    });
    expect(r.ok).toBe(false);
  });
});
