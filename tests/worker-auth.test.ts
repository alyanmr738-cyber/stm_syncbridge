import { describe, expect, it } from "vitest";
import { authorizeWorker } from "@/lib/auth/worker-auth";

describe("queue worker auth", () => {
  it("rejects GET/POST without CRON_SECRET bearer", () => {
    process.env.CRON_SECRET = "expected-secret";
    const req = new Request("http://localhost/api/internal/process-queue");
    expect(authorizeWorker(req, "")).toBe(false);
  });

  it("accepts Vercel Cron Authorization bearer", () => {
    process.env.CRON_SECRET = "expected-secret";
    const req = new Request("http://localhost/api/internal/process-queue", {
      headers: { authorization: "Bearer expected-secret" },
    });
    expect(authorizeWorker(req, "")).toBe(true);
  });
});
