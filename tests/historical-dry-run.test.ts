import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";
import {
  assertHistoricalExecute,
  dryRunMatchCustomers,
} from "@/lib/sync/historical";

describe("historical import dry-run", () => {
  it("pairs unique phone/email and never sets messaging", () => {
    const report = dryRunMatchCustomers(
      [
        {
          id: "jb-1",
          emails: ["a@x.com"],
          phones: ["9412754761"],
        },
        { id: "jb-2", emails: [], phones: ["5551112222"] },
      ],
      [
        { id: "ghl-1", emails: ["a@x.com"], phones: ["+19412754761"] },
        { id: "ghl-2", emails: ["other@x.com"], phones: [] },
      ]
    );
    expect(report.messaging).toBe(false);
    expect(report.exact).toEqual([
      { jobberId: "jb-1", ghlId: "ghl-1", via: "both" },
    ]);
    expect(report.unmatchedJobber).toContain("jb-2");
    expect(report.unmatchedGhl).toContain("ghl-2");
  });

  it("does not merge two GHL hits", () => {
    const report = dryRunMatchCustomers(
      [{ id: "jb-1", emails: ["a@x.com"], phones: ["9412754761"] }],
      [
        { id: "ghl-a", emails: ["a@x.com"], phones: [] },
        { id: "ghl-b", emails: [], phones: ["9412754761"] },
      ]
    );
    expect(report.exact).toHaveLength(0);
    expect(report.ambiguousJobber[0]?.ghlIds).toHaveLength(2);
  });
});

describe("historical execute gate", () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env = { ...prev, HISTORICAL_IMPORT_ENABLED: "false" };
    resetEnvCacheForTests();
  });
  afterEach(() => {
    process.env = prev;
    resetEnvCacheForTests();
  });

  it("refuses execute while Gate B is off", () => {
    expect(() => assertHistoricalExecute()).toThrow(GateClosedError);
  });
});
