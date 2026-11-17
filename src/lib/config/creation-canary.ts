import { getEnv, parseIdAllowlist } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";
import {
  canaryBudgetAvailable,
  canaryEnvAllowsAttempt,
  resetCreationLedgerForTests,
} from "@/lib/sync/creation-ledger";

export type CreationCanaryConfig = {
  enabled: boolean;
  ghlContactId: string | null;
  serviceRequestKeys: string[];
  notBefore: Date | null;
  notAfter: Date | null;
  maxClients: number;
  maxJobs: number;
  allowNewClient: boolean;
};

export function resetCreationCanaryLedgerForTests(): void {
  resetCreationLedgerForTests();
}

export function getCreationCanaryConfig(): CreationCanaryConfig {
  const env = getEnv();
  const enabled = env.CREATION_CANARY_ENABLED === true;
  const ghlContactId = (env.CREATION_CANARY_GHL_CONTACT_ID ?? "").trim() || null;
  const serviceRequestKeys = parseIdAllowlist(env.CREATION_CANARY_SERVICE_REQUEST_KEYS);
  const notBefore = env.CREATION_CANARY_NOT_BEFORE
    ? new Date(env.CREATION_CANARY_NOT_BEFORE)
    : null;
  const notAfter = env.CREATION_CANARY_NOT_AFTER
    ? new Date(env.CREATION_CANARY_NOT_AFTER)
    : null;
  return {
    enabled,
    ghlContactId,
    serviceRequestKeys,
    notBefore,
    notAfter,
    maxClients: env.CREATION_CANARY_MAX_CLIENTS ?? 1,
    maxJobs: env.CREATION_CANARY_MAX_JOBS ?? 1,
    allowNewClient: env.CREATION_CANARY_ALLOW_NEW_CLIENT === true,
  };
}

export function creationCanaryWindowOpen(now = new Date()): boolean {
  const cfg = getCreationCanaryConfig();
  if (!cfg.enabled) return false;
  if (cfg.notBefore && now < cfg.notBefore) return false;
  if (cfg.notAfter && now > cfg.notAfter) return false;
  return true;
}

export function creationCanaryMatchesRequest(opts: {
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
}): boolean {
  const cfg = getCreationCanaryConfig();
  if (!cfg.enabled || !cfg.ghlContactId || cfg.serviceRequestKeys.length !== 1) {
    return false;
  }
  const contact = (opts.ghlContactId ?? "").trim();
  const key = (opts.serviceRequestKey ?? "").trim();
  if (contact !== cfg.ghlContactId) return false;
  return cfg.serviceRequestKeys[0] === key;
}

/** Sync pilot gate: env allowlist only; global budget checked async via ledger reserve. */
export function creationCanaryAllowsProviderCreate(opts: {
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
  kind: "client" | "job";
  now?: Date;
}): boolean {
  if (!creationCanaryWindowOpen(opts.now)) return false;
  return canaryEnvAllowsAttempt({
    ghlContactId: opts.ghlContactId,
    serviceRequestKey: opts.serviceRequestKey,
    kind: opts.kind,
  });
}

export async function creationCanaryBudgetAllows(kind: "client" | "job"): Promise<boolean> {
  if (!getCreationCanaryConfig().enabled) return false;
  return canaryBudgetAvailable(kind);
}

export class CreationCanaryClosedError extends Error {
  constructor(
    public readonly operation: string,
    public readonly reason: string
  ) {
    super(`Creation canary blocked ${operation}: ${reason}`);
    this.name = "CreationCanaryClosedError";
  }
}

export function assertCreationCanaryWrite(opts: {
  operation: string;
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
  kind: "client" | "job";
}): void {
  const cfg = getCreationCanaryConfig();
  if (!cfg.enabled) {
    throw new CreationCanaryClosedError(opts.operation, "canary not enabled");
  }
  if (!creationCanaryWindowOpen()) {
    throw new CreationCanaryClosedError(opts.operation, "authorization window closed");
  }
  if (!creationCanaryMatchesRequest(opts)) {
    throw new CreationCanaryClosedError(opts.operation, "contact or request not on allowlist");
  }
  if (!creationCanaryAllowsProviderCreate(opts)) {
    throw new CreationCanaryClosedError(opts.operation, "canary not authorized for this create");
  }
}

/** Never bypass via ALLOW_RECORD_CREATION — canary-only provider creates. */
export async function assertProviderCreateAllowed(opts: {
  operation: string;
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
  kind: "client" | "job";
  ledgerId?: string;
}): Promise<void> {
  assertCreationCanaryWrite(opts);
  if (getEnv().ALLOW_RECORD_CREATION === "true" && !getCreationCanaryConfig().enabled) {
    throw new CreationCanaryClosedError(
      opts.operation,
      "global ALLOW_RECORD_CREATION cannot authorize Jobber creates"
    );
  }
  const budget = await creationCanaryBudgetAllows(opts.kind);
  if (!budget && !opts.ledgerId) {
    throw new CreationCanaryClosedError(opts.operation, "canary budget exhausted or slot taken");
  }
}

export function isCreationCanaryGateError(
  e: unknown
): e is CreationCanaryClosedError | GateClosedError {
  return e instanceof CreationCanaryClosedError || e instanceof GateClosedError;
}

export function canaryLockOwner(): string {
  return (
    process.env.CREATION_CANARY_LOCK_OWNER ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    `worker-${process.pid}`
  );
}