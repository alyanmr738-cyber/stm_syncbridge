import { describe, expect, it, vi } from "vitest";
import { enrichEvents, enrichFinance, enrichJobs } from "@/lib/display/enrich";
import { classifyProcessOutcome, outcomeLabel } from "@/lib/display/process-outcome";
import { operationalStats } from "@/lib/display/operational-stats";

vi.mock("@/lib/display/entity-labels", () => ({
  hydrateLabels: async (
    keys: { provider: string; entity_type: string; entity_id: string }[]
  ) => {
    const map = new Map();
    for (const k of keys) {
      const key = `${k.provider}:${k.entity_type}:${k.entity_id}`;
      if (k.entity_type === "job" && k.entity_id === "job-8137") {
        map.set(key, {
          ...k,
          title: "Service",
          extra: {
            jobNumber: "8137",
            clientId: "client-kiesel",
            clientName: "Christopher Kiesel",
          },
          lookup_ok: true,
        });
      } else if (k.entity_type === "opportunity") {
        map.set(key, {
          ...k,
          title: "Christopher Kiesel opportunity",
          extra: {},
          lookup_ok: true,
        });
      } else if (k.entity_type === "quote" && k.entity_id === "q1") {
        map.set(key, {
          ...k,
          title: "Quote 100",
          extra: { clientId: "c1", clientName: "Pat Owner", quoteStatus: "draft" },
          lookup_ok: true,
        });
      } else if (k.entity_type === "invoice" && k.entity_id === "i-fail") {
        map.set(key, { ...k, title: "", extra: {}, lookup_ok: false });
      } else if (k.entity_type === "invoice" && k.entity_id === "i-orphan") {
        map.set(key, {
          ...k,
          title: "Invoice 9",
          extra: { invoiceStatus: "paid" },
          lookup_ok: true,
        });
      } else if (k.entity_type === "client") {
        map.set(key, { ...k, title: "Christopher Kiesel", extra: {}, lookup_ok: true });
      }
    }
    return map;
  },
  labelOf: (
    map: Map<string, { title?: string; extra?: Record<string, unknown>; lookup_ok?: boolean }>,
    provider: string,
    entity_type: string,
    entity_id?: string | null
  ) => (entity_id ? map.get(`${provider}:${entity_type}:${entity_id}`) ?? null : null),
}));

describe("job three-state customer resolution", () => {
  it("shows Jobber customer even when SyncBridge link is unverified and an opportunity exists", async () => {
    const jobs = await enrichJobs(
      [
        {
          id: "jl1",
          jobber_job_id: "job-8137",
          ghl_opportunity_id: "opp-1",
          customer_link_id: null,
          last_job_status: "active",
        },
      ],
      [
        {
          id: "cl-pending",
          jobberClientId: "client-kiesel",
          ghlContactId: "ghl-1",
          verified: false,
          matchMethod: "pending_verification",
          relationshipStatus: "pending",
          jobberName: "Christopher Kiesel",
          ghlName: "Christopher Kiesel",
          namesDiffer: false,
          maskedEmail: null,
          maskedPhone: null,
          lastSyncedAt: null,
          lastSyncedLabel: "",
          jobCount: 0,
          lastProviderWrite: "",
          lastAttempt: "—",
          blocker: null,
        },
      ]
    );
    expect(jobs[0]!.jobberCustomerName).toBe("Christopher Kiesel");
    expect(jobs[0]!.customerLinkStatus).toBe("unverified");
    expect(jobs[0]!.opportunityLinkStatus).toBe("linked");
    expect(jobs[0]!.jobberCustomerName).not.toMatch(/unlinked/i);
  });

  it("does not invent a customer when Jobber client is missing", async () => {
    const jobs = await enrichJobs(
      [{ id: "jl2", jobber_job_id: "job-unknown", last_job_status: "active" }],
      []
    );
    expect(jobs[0]!.jobberCustomerName).toBe("Jobber customer unresolved");
    expect(jobs[0]!.customerLinkStatus).toBe("none");
  });
});

describe("finance customer resolution", () => {
  it("resolves Jobber owners, lookup failures, and unresolved records separately", async () => {
    const rows = await enrichFinance(
      [
        { id: "1", jobber_quote_id: "q1", last_status: "draft" },
        { id: "2", jobber_invoice_id: "i-fail", last_status: "paid" },
        { id: "3", jobber_invoice_id: "i-orphan", last_status: "paid" },
      ],
      "quote",
      []
    );
    const quotes = await enrichFinance(
      [{ id: "1", jobber_quote_id: "q1", last_status: "draft" }],
      "quote",
      []
    );
    const failed = await enrichFinance(
      [{ id: "2", jobber_invoice_id: "i-fail", last_status: "paid" }],
      "invoice",
      []
    );
    const orphan = await enrichFinance(
      [{ id: "3", jobber_invoice_id: "i-orphan", last_status: "paid" }],
      "invoice",
      []
    );
    expect(quotes[0]!.customerName).toBe("Pat Owner");
    expect(quotes[0]!.customerResolution).toBe("jobber_customer");
    expect(failed[0]!.customerResolution).toBe("lookup_failed");
    expect(orphan[0]!.customerResolution).toBe("jobber_unresolved");
    expect(orphan[0]!.customerName).toBe("Jobber customer unresolved");
    void rows;
  });
});

describe("processed is not a provider write", () => {
  it("classifies historical succeeded as write_not_recorded", () => {
    expect(
      classifyProcessOutcome({ status: "succeeded", recordedOutcome: null })
    ).toBe("write_not_recorded");
    expect(outcomeLabel("write_not_recorded")).toMatch(/not recorded/i);
  });

  it("does not treat local_state_only as a provider write", () => {
    expect(
      classifyProcessOutcome({
        status: "succeeded",
        recordedOutcome: "local_state_only",
      })
    ).toBe("local_state_only");
    const events = awaitableEvents();
    expect(events.filter((e) => e.outcome === "provider_write")).toHaveLength(1);
    expect(events.filter((e) => e.outcome === "write_not_recorded")).toHaveLength(1);
  });
});

function awaitableEvents() {
  return [
    { outcome: classifyProcessOutcome({ status: "succeeded", recordedOutcome: "provider_write" }) },
    { outcome: classifyProcessOutcome({ status: "succeeded", recordedOutcome: null }) },
  ];
}

describe("operational stats definitions", () => {
  it("derives counts from rows, not heading totals", () => {
    const stats = operationalStats({
      customers: [
        {
          id: "a",
          relationshipStatus: "verified",
        } as never,
        { id: "b", relationshipStatus: "pending" } as never,
      ],
      jobs: [
        {
          opportunityLinkStatus: "linked",
          customerLinkStatus: "none",
          active: true,
        } as never,
      ],
      quotes: [{ customerResolution: "jobber_customer" } as never],
      invoices: [{ customerResolution: "lookup_failed" } as never],
      events: [{ outcome: "write_not_recorded" }, { outcome: "provider_write" }],
      openConflicts: 2,
      quarantined: 40,
      windowLabel: "test",
    });
    expect(stats.verified).toBe(1);
    expect(stats.unverified).toBe(1);
    expect(stats.withOpp).toBe(1);
    expect(stats.missingCustomerLink).toBe(1);
    expect(stats.writes).toBe(1);
    expect(stats.quarantined).toBe(40);
  });
});

describe("enrichEvents historical honesty", () => {
  it("does not promote succeeded to provider_write without evidence", async () => {
    const rows = await enrichEvents(
      [
        {
          id: "e1",
          source: "jobber",
          eventKind: "CLIENT_UPDATE",
          status: "succeeded",
          error: null,
          receivedAt: "2026-11-15T00:00:00.000Z",
        },
      ],
      [],
      []
    );
    expect(rows[0]!.outcome).toBe("write_not_recorded");
    expect(rows[0]!.providerWrite).toBeNull();
  });
});
