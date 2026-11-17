import { getEnv, parseIdAllowlist } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";

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

export type CreationCanaryLedger = {
  clientsCreated: number;
  jobsCreated: number;
  lastClientId: string | null;
  lastJobId: string | null;
};

let testLedger: CreationCanaryLedger = {
  clientsCreated: 0,
  jobsCreated: 0,
  lastClientId: null,
  lastJobId: null,
};

export function resetCreationCanaryLedgerForTests(): void {
  testLedger = {
    clientsCreated: 0,
    jobsCreated: 0,
    lastClientId: null,
    lastJobId: null,
  };
}

export function getCreationCanaryLedger(): CreationCanaryLedger {
  return { ...testLedger };
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
  if (!cfg.enabled || !cfg.ghlContactId || cfg.serviceRequestKeys.length === 0) {
    return false;
  }
  const contact = (opts.ghlContactId ?? "").trim();
  const key = (opts.serviceRequestKey ?? "").trim();
  if (contact !== cfg.ghlContactId) return false;
  return cfg.serviceRequestKeys.includes(key);
}

export function creationCanaryAllowsProviderCreate(opts: {
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
  kind: "client" | "job";
  now?: Date;
}): boolean {
  if (!creationCanaryWindowOpen(opts.now)) return false;
  if (!creationCanaryMatchesRequest(opts)) return false;
  const ledger = getCreationCanaryLedger();
  const cfg = getCreationCanaryConfig();
  if (opts.kind === "client") {
    if (!cfg.allowNewClient) return false;
    return ledger.clientsCreated < cfg.maxClients;
  }
  return ledger.jobsCreated < cfg.maxJobs;
}

export function recordCreationCanaryWrite(opts: {
  kind: "client" | "job";
  providerId: string;
}): void {
  if (opts.kind === "client") {
    testLedger = {
      ...testLedger,
      clientsCreated: testLedger.clientsCreated + 1,
      lastClientId: opts.providerId,
    };
    return;
  }
  testLedger = {
    ...testLedger,
    jobsCreated: testLedger.jobsCreated + 1,
    lastJobId: opts.providerId,
  };
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
    throw new CreationCanaryClosedError(opts.operation, "canary budget exhausted or client create disabled");
  }
}

/** Global ALLOW_RECORD_CREATION=true bypasses canary for integration tests only. */
export function providerCreateGloballyAllowed(): boolean {
  return getEnv().ALLOW_RECORD_CREATION === "true";
}

export function assertProviderCreateAllowed(opts: {
  operation: string;
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
  kind: "client" | "job";
}): void {
  if (providerCreateGloballyAllowed()) return;
  assertCreationCanaryWrite(opts);
}

export function isCreationCanaryGateError(
  e: unknown
): e is CreationCanaryClosedError | GateClosedError {
  return e instanceof CreationCanaryClosedError || e instanceof GateClosedError;
}