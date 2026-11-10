import type { GhlCapabilityProbe } from "@/adapters/ghl/client";

export function ghlMockCapabilities(): GhlCapabilityProbe[] {
  return [
    {
      operation: "contacts.read/write",
      verified: false,
      evidence: "mock — verify PIT scopes in sub-account",
      fallback: "Dry-run report",
    },
    {
      operation: "opportunities.pipeline/stages",
      verified: false,
      evidence: "mock — discover Completed Job stage ID",
      fallback: "Admin mapping required",
    },
    {
      operation: "calendars.appointments",
      verified: false,
      evidence: "mock — inventory Voice AI calendars",
      fallback: "Pending bookings only",
    },
    {
      operation: "review.workflow.inbound",
      verified: false,
      evidence: "mock — dedicated job-completion trigger required",
      fallback: "Review dispatch disabled",
    },
  ];
}

export async function ghlMockGet<T>(path: string): Promise<T> {
  if (path.includes("timezone")) {
    return { timezone: "America/Phoenix" } as T;
  }
  if (path.includes("pipelines")) {
    return {
      pipelines: [
        {
          id: "pipe-mock",
          stages: [{ id: "stage-completed", name: "Completed Job" }],
        },
      ],
    } as T;
  }
  return {} as T;
}
