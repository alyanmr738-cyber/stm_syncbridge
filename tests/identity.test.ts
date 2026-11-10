import { describe, expect, it } from "vitest";
import {
  decideMatch,
  normalizeEmail,
  normalizePhone,
} from "@/lib/sync/identity";

describe("identity matching", () => {
  it("normalizes email and phone", () => {
    expect(normalizeEmail("  A@B.COM ")).toBe("a@b.com");
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("flags ambiguous matches (T04)", () => {
    const d = decideMatch({
      exactIdHits: ["a"],
      emailPhoneHits: ["b"],
    });
    expect(d.kind).toBe("ambiguous");
  });

  it("creates when unmatched (T03)", () => {
    expect(decideMatch({ exactIdHits: [], emailPhoneHits: [] }).kind).toBe(
      "create"
    );
  });
});
