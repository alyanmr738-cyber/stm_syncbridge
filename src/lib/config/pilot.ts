import { getEnv, parseIdAllowlist } from "@/lib/config/env";
import { canWriteToProviders, GateClosedError } from "@/lib/config/feature-flags";

export type PilotScope = {
  jobberClientIds: string[];
  jobberJobIds: string[];
  ghlContactIds: string[];
  ghlOpportunityIds: string[];
  legacyIds: string[];
};

export function getPilotScope(): PilotScope {
  const env = getEnv();
  return {
    jobberClientIds: parseIdAllowlist(env.PILOT_JOBBER_CLIENT_IDS),
    jobberJobIds: parseIdAllowlist(env.PILOT_JOBBER_JOB_IDS),
    ghlContactIds: parseIdAllowlist(env.PILOT_GHL_CONTACT_IDS),
    ghlOpportunityIds: parseIdAllowlist(env.PILOT_GHL_OPPORTUNITY_IDS),
    legacyIds: parseIdAllowlist(env.PILOT_ENTITY_IDS),
  };
}

function inList(id: string | null | undefined, list: string[]): boolean {
  return Boolean(id && list.includes(id));
}

/**
 * Writes only if Gate A is on, or the *source* record is allowlisted.
 * Existing destination IDs must also be allowlisted (or already linked to that parent).
 * Creating a child is allowed only when the parent is approved and destination id is absent.
 */
export function pilotAllows(opts: {
  jobberClientId?: string | null;
  jobberJobId?: string | null;
  ghlContactId?: string | null;
  ghlOpportunityId?: string | null;
  creatingGhlContact?: boolean;
  creatingJobberClient?: boolean;
  creatingGhlOpportunity?: boolean;
}): boolean {
  if (canWriteToProviders()) return true;
  const p = getPilotScope();
  const anyTyped =
    p.jobberClientIds.length +
      p.jobberJobIds.length +
      p.ghlContactIds.length +
      p.ghlOpportunityIds.length >
    0;

  if (opts.jobberJobId) {
    const jobOk = inList(opts.jobberJobId, p.jobberJobIds) || inList(opts.jobberJobId, p.legacyIds);
    if (!jobOk) return false;
    if (opts.ghlOpportunityId && !opts.creatingGhlOpportunity) {
      if (
        !inList(opts.ghlOpportunityId, p.ghlOpportunityIds) &&
        !inList(opts.ghlOpportunityId, p.legacyIds)
      ) {
        return false;
      }
    }
    return true;
  }

  if (opts.jobberClientId) {
    const clientOk =
      inList(opts.jobberClientId, p.jobberClientIds) || inList(opts.jobberClientId, p.legacyIds);
    if (!clientOk) return false;
    if (opts.ghlContactId && !opts.creatingGhlContact) {
      if (!inList(opts.ghlContactId, p.ghlContactIds) && !inList(opts.ghlContactId, p.legacyIds)) {
        return false;
      }
    }
    return true;
  }

  if (opts.ghlContactId) {
    const contactOk =
      inList(opts.ghlContactId, p.ghlContactIds) || inList(opts.ghlContactId, p.legacyIds);
    if (!contactOk) return false;
    if (opts.jobberClientId && !opts.creatingJobberClient) {
      if (
        !inList(opts.jobberClientId, p.jobberClientIds) &&
        !inList(opts.jobberClientId, p.legacyIds)
      ) {
        return false;
      }
    }
    return true;
  }

  if (opts.ghlOpportunityId) {
    return (
      inList(opts.ghlOpportunityId, p.ghlOpportunityIds) ||
      inList(opts.ghlOpportunityId, p.legacyIds)
    );
  }

  if (!anyTyped && p.legacyIds.length > 0) {
    return false;
  }
  return false;
}

export function assertPilotWrite(operation: string, opts: Parameters<typeof pilotAllows>[0]): void {
  if (pilotAllows(opts)) return;
  throw new GateClosedError("production_writes", operation);
}
