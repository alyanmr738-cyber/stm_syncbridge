import { describe, expect, it } from "vitest";
import {
  identityRevision,
  planGhlInboundSync,
  shouldSkipInboundRevision,
} from "@/lib/sync/candidate-matcher";

describe("GHL inbound loop and write policy", () => {
  const rev = identityRevision({
    email: "evan@example.com",
    phone: "5551212121",
    name: "Evan Test",
  });

  it("skips when incoming matches last Jobber revision", () => {
    expect(
      shouldSkipInboundRevision({
        incomingRev: rev,
        lastJobberRevision: rev,
        lastGhlRevision: "other",
      })
    ).toBe(true);
    expect(
      planGhlInboundSync({
        verified: true,
        jobberId: "j1",
        incomingRev: rev,
        lastJobberRevision: rev,
      })
    ).toBe("skip_loop");
  });

  it("skips when incoming matches last GHL revision (echo)", () => {
    expect(
      planGhlInboundSync({
        verified: true,
        jobberId: "j1",
        incomingRev: rev,
        lastGhlRevision: rev,
      })
    ).toBe("skip_loop");
  });

  it("does not write unverified or missing jobber", () => {
    expect(
      planGhlInboundSync({
        verified: false,
        jobberId: "j1",
        incomingRev: rev,
      })
    ).toBe("conflict_unverified");
    expect(
      planGhlInboundSync({
        verified: true,
        jobberId: null,
        incomingRev: rev,
      })
    ).toBe("conflict_no_jobber");
  });

  it("blocks ambiguous identities", () => {
    expect(
      planGhlInboundSync({
        ambiguous: true,
        verified: true,
        jobberId: "j1",
        incomingRev: rev,
      })
    ).toBe("conflict_ambiguous");
  });

  it("writes only verified existing pairs on new revision", () => {
    expect(
      planGhlInboundSync({
        verified: true,
        jobberId: "j1",
        incomingRev: rev,
        lastJobberRevision: identityRevision({
          email: "evan@example.com",
          phone: "5551212121",
          name: "Evan TestQA",
        }),
      })
    ).toBe("write_existing");
  });
});
