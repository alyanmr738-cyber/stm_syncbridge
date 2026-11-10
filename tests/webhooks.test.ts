import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyJobberWebhook } from "@/lib/webhooks/verify";

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
