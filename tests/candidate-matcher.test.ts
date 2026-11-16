import { describe, expect, it } from "vitest";
import {
  canAcceptVerifiedLink,
  classifyCustomerPair,
  identityRevision,
  isExcludedIdentity,
  namesAligned,
} from "@/lib/sync/candidate-matcher";

describe("candidate matcher (never auto-verify)", () => {
  it("classifies unique email+phone+name as proposal-only", () => {
    const r = classifyCustomerPair({
      jobber: { id: "j1", emails: ["a@x.com"], phones: ["+15551212"], name: "Evan Test" },
      ghl: { id: "g1", emails: ["a@x.com"], phones: ["+1 555-1212"], name: "Evan Test" },
      emailUnique: true,
      phoneUnique: true,
    });
    expect(r.bucket).toBe("email_and_phone_unique");
    expect(r.canAutoVerify).toBe(false);
    expect(canAcceptVerifiedLink(r.bucket)).toBe(true);
  });

  it("never verifies email-only", () => {
    const r = classifyCustomerPair({
      jobber: { id: "j1", emails: ["a@x.com"], phones: [], name: "Ann" },
      ghl: { id: "g1", emails: ["a@x.com"], phones: ["+1"], name: "Ann" },
      emailUnique: true,
      phoneUnique: true,
    });
    expect(r.bucket).toBe("email_only");
    expect(canAcceptVerifiedLink(r.bucket)).toBe(false);
  });

  it("never verifies phone-only", () => {
    const r = classifyCustomerPair({
      jobber: { id: "j1", emails: [], phones: ["5551212121"], name: "Ann" },
      ghl: { id: "g1", emails: [], phones: ["5551212121"], name: "Ann" },
      emailUnique: true,
      phoneUnique: true,
    });
    expect(r.bucket).toBe("phone_only");
    expect(canAcceptVerifiedLink(r.bucket)).toBe(false);
  });

  it("flags Sherri/Sherry excluded", () => {
    expect(isExcludedIdentity("Sherri Waldren", "Sherry Waldron")).toBe(true);
    const r = classifyCustomerPair({
      jobber: { id: "j", emails: ["s@x.com"], phones: ["1"], name: "Sherri" },
      ghl: { id: "g", emails: ["s@x.com"], phones: ["1"], name: "Sherry" },
      emailUnique: true,
      phoneUnique: true,
    });
    expect(r.bucket).toBe("excluded");
  });

  it("treats collisions as ambiguous", () => {
    const r = classifyCustomerPair({
      jobber: { id: "j", emails: ["a@x.com"], name: "A" },
      ghl: { id: "g", emails: ["a@x.com"], name: "A" },
      emailUnique: false,
      phoneUnique: false,
      collidingIds: ["g1", "g2"],
    });
    expect(r.bucket).toBe("ambiguous");
  });

  it("namesAligned requires overlapping tokens", () => {
    expect(namesAligned("Evan Test", "Evan TestQA")).toBe(true);
    expect(namesAligned("Alice", "Bob")).toBe(false);
  });

  it("identityRevision is stable for loop guards", () => {
    const a = identityRevision({ email: "A@X.com", phone: "555", name: "Evan" });
    const b = identityRevision({ email: "a@x.com", phone: "555", name: "Evan" });
    expect(a).toBe(b);
  });
});
