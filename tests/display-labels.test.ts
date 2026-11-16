import { describe, expect, it } from "vitest";
import {
  displayName,
  formatJobStatus,
  ghlSyncLabel,
  maskEmail,
  maskPhone,
  namesDiffer,
  parseRevisionBlob,
} from "@/lib/display/format";

describe("admin display labels", () => {
  it("falls back when names are missing", () => {
    expect(displayName([null, "", "  "], "Name unavailable")).toBe("Name unavailable");
    expect(displayName(["Evan", "Test"])).toBe("Evan Test");
    expect(displayName(["Dominique Tollis Dominique Tollis"])).toBe("Dominique Tollis");
    expect(displayName(["Dominique Tollis", "Dominique Tollis"])).toBe("Dominique Tollis");
  });

  it("keeps duplicate names distinguishable only via caller IDs, not invention", () => {
    expect(displayName(["John Smith"])).toBe("John Smith");
    expect(displayName(["John Smith"])).toBe("John Smith");
  });

  it("flags mismatched identities", () => {
    expect(namesDiffer("Sherri Waldren", "Sherry Waldron")).toBe(true);
    expect(namesDiffer("Evan Test", "evan test")).toBe(false);
    expect(namesDiffer("Evan Test", "")).toBe(false);
    expect(namesDiffer("Evan Test", "GHL contact (name unavailable)")).toBe(false);
  });

  it("parses revision blobs and ignores invalid JSON", () => {
    expect(parseRevisionBlob('{"name":"Evan Test","email":"a@b.com"}').name).toBe("Evan Test");
    expect(parseRevisionBlob("not-json")).toEqual({});
  });

  it("masks email and phone", () => {
    expect(maskEmail("alex@example.com")).toBe("al•••@example.com");
    expect(maskPhone("+19418008271")).toBe("•••-•••-8271");
    expect(maskPhone("123")).toBeNull();
  });

  it("formats job status and does not imply GHL push", () => {
    expect(formatJobStatus("requires_invoicing")).toBe("Needs invoicing");
    expect(ghlSyncLabel(null)).toBe("Database only — not pushed to GHL");
    expect(ghlSyncLabel("note_1")).toBe("GHL note recorded");
  });
});
