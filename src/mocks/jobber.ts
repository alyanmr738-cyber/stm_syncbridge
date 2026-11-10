import type { JobberCapabilityProbe } from "@/adapters/jobber/client";

export function jobberMockCapabilities(): JobberCapabilityProbe[] {
  return [
    {
      operation: "client.search/read/create/update",
      verified: false,
      evidence: "mock — run live GraphiQL introspection",
      fallback: "Manual new-client workflow",
    },
    {
      operation: "visit.create/reschedule/cancel",
      verified: false,
      evidence: "mock — scheduling mutation names unverified",
      fallback: "pending_jobber_confirmation + staff scheduling",
    },
    {
      operation: "availability.check/reserve",
      verified: false,
      evidence: "mock — assume pending path until live audit",
      fallback: "pending_jobber_confirmation",
    },
    {
      operation: "job.completion.webhook",
      verified: false,
      evidence: "mock — subscribe in Developer Center after Phase 0",
      fallback: "Periodic reconciliation",
    },
    {
      operation: "internal.note.append",
      verified: false,
      evidence: "mock — verify mutation in GraphiQL",
      fallback: "GHL-only summary + admin alert",
    },
  ];
}

const mockAccount = {
  account: {
    id: "MOCK_JOBBER_ACCOUNT",
    name: "Septic Tank Man (Mock)",
    timezone: "America/Phoenix",
  },
};

export async function jobberMockQuery<T>(query: string): Promise<T> {
  if (query.includes("GetAccount") || query.includes("GetAccountTimezone")) {
    return mockAccount as T;
  }
  if (query.includes("services")) {
    return {
      productOrServices: {
        nodes: [
          { id: "svc-pump", name: "Pump Out", defaultDuration: 60 },
          { id: "svc-inspect", name: "Inspection", defaultDuration: 45 },
        ],
      },
    } as T;
  }
  return {} as T;
}
