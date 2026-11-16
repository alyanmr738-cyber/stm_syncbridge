import { describe, expect, it } from "vitest";
import { canAcceptVerifiedLink, type CandidateBucket } from "@/lib/sync/candidate-matcher";

describe("matching accept policy", () => {
  const blocked: CandidateBucket[] = [
    "email_only",
    "phone_only",
    "ambiguous",
    "name_not_aligned",
    "excluded",
    "already_linked",
  ];
  it("never auto-accepts email-only / phone-only / collisions", () => {
    for (const b of blocked) {
      expect(canAcceptVerifiedLink(b)).toBe(false);
    }
  });
  it("allows verified accept only for unique email+phone", () => {
    expect(canAcceptVerifiedLink("email_and_phone_unique")).toBe(true);
  });
});
