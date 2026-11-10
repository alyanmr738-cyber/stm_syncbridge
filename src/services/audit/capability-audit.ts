import { JobberReadOnlyClient } from "@/adapters/jobber/client";
import { GhlReadOnlyClient } from "@/adapters/ghl/client";
import { featureFlagsSnapshot, gateStatus } from "@/lib/config/feature-flags";
import { getSchedulingPolicy } from "@/lib/config/scheduling-policy";
import { getEnv } from "@/lib/config/env";

export type CapabilityMatrixRow = {
  operation: string;
  provider: "jobber" | "ghl" | "integration";
  accountVerified: boolean;
  discoveryEvidence: string;
  fallback: string;
  recommendedPath: string;
};

export type CapabilityAuditReport = {
  generatedAt: string;
  mode: "mock" | "live_readonly";
  businessTimezone: {
    jobber: string | null;
    ghl: string | null;
    authoritativeProposal: "jobber" | "unset";
    match: boolean | null;
  };
  schedulingPolicy: ReturnType<typeof getSchedulingPolicy>;
  approvalGates: ReturnType<typeof gateStatus>;
  featureFlags: ReturnType<typeof featureFlagsSnapshot>;
  matrix: CapabilityMatrixRow[];
  businessApprovalsPending: string[];
  unsupportedOrUnverified: string[];
  recommendedProductionPath: string[];
};

const INTEGRATION_ROWS: CapabilityMatrixRow[] = [
  {
    operation: "pending_jobber_confirmation booking fallback",
    provider: "integration",
    accountVerified: true,
    discoveryEvidence: "Architecture decision §1 — approved fallback",
    fallback: "Staff scheduler notification",
    recommendedPath: "Default until availability API verified",
  },
  {
    operation: "per-job review ledger",
    provider: "integration",
    accountVerified: true,
    discoveryEvidence: "Architecture decision §8",
    fallback: "Review dispatch disabled",
    recommendedPath: "Enable only with customer_messaging gate",
  },
  {
    operation: "historical import suppression",
    provider: "integration",
    accountVerified: true,
    discoveryEvidence: "Architecture decision §7",
    fallback: "Dry-run only",
    recommendedPath: "Separate historical_backfill gate",
  },
];

export async function runCapabilityAudit(): Promise<CapabilityAuditReport> {
  const env = getEnv();
  const jobber = JobberReadOnlyClient.fromEnv();
  const ghl = GhlReadOnlyClient.fromEnv();
  const mode =
    env.USE_PROVIDER_MOCKS === true ? "mock" : ("live_readonly" as const);

  const [jobberProbes, ghlProbes, jobberTz, ghlTz] = await Promise.all([
    jobber.probeCapabilities(),
    ghl.probeCapabilities(),
    jobber.getAccountTimezone(),
    ghl.getLocationProfile(),
  ]);

  const matrix: CapabilityMatrixRow[] = [
    ...jobberProbes.map((p) => ({
      operation: p.operation,
      provider: "jobber" as const,
      accountVerified: p.verified,
      discoveryEvidence: p.evidence,
      fallback: p.fallback,
      recommendedPath: p.verified
        ? "Implement in Phase 3+"
        : "Use fallback; re-audit with OAuth token",
    })),
    ...ghlProbes.map((p) => ({
      operation: p.operation,
      provider: "ghl" as const,
      accountVerified: p.verified,
      discoveryEvidence: p.evidence,
      fallback: p.fallback,
      recommendedPath: p.verified
        ? "Implement after pipeline mapping"
        : "Discover IDs in read-only audit",
    })),
    ...INTEGRATION_ROWS,
  ];

  const jTz = jobberTz.timezone;
  const gTz = ghlTz.timezone;
  const tzMatch =
    jTz && gTz ? jTz.toLowerCase() === gTz.toLowerCase() : null;

  const businessApprovalsPending = [
    "Production writes (contacts, jobs, visits, opportunities)",
    "Historical backfill execution",
    "Customer messaging (reviews, reminders, notifications)",
    "Non-emergency scheduling buffer semantics (lead time vs between-visit)",
    "Manual-confirmation booking model for customers (if auto-confirm unavailable)",
  ];

  const unsupportedOrUnverified = matrix
    .filter((r) => !r.accountVerified && r.provider !== "integration")
    .map((r) => `${r.provider}: ${r.operation}`);

  const recommendedProductionPath = [
    "Complete live read-only OAuth + PIT audit; fill matrix with GraphiQL/GHL evidence.",
    "Map GHL services to Jobber catalog in admin UI; flag unmapped intents.",
    "Pilot booking with pending_jobber_confirmation unless slot reservation verified.",
    "Enable production_writes only after T05–T10 sandbox scenarios pass.",
    "Enable historical_backfill only after dry-run reconciliation sign-off.",
    "Enable customer_messaging only after review workflow + consent audit.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode,
    businessTimezone: {
      jobber: jTz,
      ghl: gTz,
      authoritativeProposal: jTz ? "jobber" : "unset",
      match: tzMatch,
    },
    schedulingPolicy: getSchedulingPolicy(),
    approvalGates: gateStatus(),
    featureFlags: featureFlagsSnapshot(),
    matrix,
    businessApprovalsPending,
    unsupportedOrUnverified,
    recommendedProductionPath,
  };
}
