import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCacheForTests } from "@/lib/config/env";
import { resetCreationCanaryLedgerForTests } from "@/lib/config/creation-canary";
import {
  canaryBudgetAvailable,
  completeCanarySlot,
  getLedgerByRequestKey,
  getOrCreateCanaryLedger,
  reserveCanarySlot,
} from "@/lib/sync/creation-ledger";

const prev = { ...process.env };

describe("durable creation ledger (memory backend)", () => {
  beforeEach(() => {
    process.env = {
      ...prev,
      CREATION_LEDGER_MEMORY: "true",
      CREATION_CANARY_ENABLED: "true",
      CREATION_CANARY_GHL_CONTACT_ID: "ghl-canary",
      CREATION_CANARY_SERVICE_REQUEST_KEYS: "req-001",
      CREATION_CANARY_NOT_BEFORE: "2020-01-01T00:00:00Z",
      CREATION_CANARY_NOT_AFTER: "2099-01-01T00:00:00Z",
      CREATION_CANARY_ALLOW_NEW_CLIENT: "true",
    };
    resetEnvCacheForTests();
    resetCreationCanaryLedgerForTests();
  });
  afterEach(() => {
    process.env = prev;
    delete process.env.CREATION_LEDGER_MEMORY;
    resetEnvCacheForTests();
    resetCreationCanaryLedgerForTests();
  });

  it("allows only one client and one job globally", async () => {
    const ledger = await getOrCreateCanaryLedger({
      ghlContactId: "ghl-canary",
      serviceRequestKey: "req-001",
    });
    expect(ledger?.id).toBeTruthy();
  const owner = "worker-a";
  expect(await reserveCanarySlot({ kind: "client", ledgerId: ledger!.id, owner })).toBe(true);
    expect(await reserveCanarySlot({ kind: "client", ledgerId: ledger!.id, owner: "worker-b" })).toBe(
      false
    );
    await completeCanarySlot({ kind: "client", ledgerId: ledger!.id, providerId: "Z2lkOi8vSm9iYmVyL0NsaWVudC8x" });
    expect(await canaryBudgetAvailable("client")).toBe(false);
    expect(await reserveCanarySlot({ kind: "job", ledgerId: ledger!.id, owner })).toBe(true);
    await completeCanarySlot({ kind: "job", ledgerId: ledger!.id, providerId: "Z2lkOi8vSm9iYmVyL0pvYi8x" });
    const row = await getLedgerByRequestKey("req-001");
    expect(row?.run_state).toBe("completed");
    expect(row?.jobber_client_id).toBeTruthy();
    expect(row?.jobber_job_id).toBeTruthy();
  });
});