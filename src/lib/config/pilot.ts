import { getEnv, parseIdAllowlist } from "@/lib/config/env";
import { canWriteToProviders, GateClosedError } from "@/lib/config/feature-flags";
import { STM_GHL } from "@/lib/config/stm-mapping";

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
  if (existingRecordsOnly()) {
    if (opts.creatingGhlContact || opts.creatingJobberClient || opts.creatingGhlOpportunity) {
      return false;
    }
  }
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

/** Default: never create contacts/jobs/opps. Gate A does not lift this. */
export function existingRecordsOnly(): boolean {
  const env = getEnv();
  if (env.ALLOW_RECORD_CREATION === "true") return false;
  if (env.PILOT_EXISTING_RECORDS_ONLY === "false" && canWriteToProviders()) return false;
  return true;
}

export type PilotGhlField =
  | "jobberClientId"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "address1"
  | "city"
  | "postalCode"
  | "lastSyncedFrom"
  | "lastSyncedBy"
  | "lastSyncTimestamp";

/** Gate A off: only listed fields. Empty env → jobberClientId only. */
export function getPilotGhlAllowedFields(): Set<PilotGhlField> {
  if (canWriteToProviders()) {
    return new Set([
      "jobberClientId",
      "firstName",
      "lastName",
      "email",
      "phone",
      "address1",
      "city",
      "postalCode",
      "lastSyncedFrom",
      "lastSyncedBy",
      "lastSyncTimestamp",
    ]);
  }
  const listed = parseIdAllowlist(getEnv().PILOT_GHL_ALLOWED_FIELDS) as PilotGhlField[];
  if (listed.length === 0) return new Set(["jobberClientId"]);
  return new Set(listed);
}

export function buildPilotGhlContactBody(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  postalCode?: string;
  jobberClientId?: string;
}): Record<string, unknown> {
  const allow = getPilotGhlAllowedFields();
  const body: Record<string, unknown> = {};
  const copy = (key: PilotGhlField) => {
    if (!allow.has(key)) return;
    const value = input[key as keyof typeof input];
    if (value !== undefined) body[key] = value;
  };
  copy("firstName");
  copy("lastName");
  copy("email");
  copy("phone");
  copy("address1");
  copy("city");
  copy("postalCode");

  const customFields: { id: string; field_value: string }[] = [];
  if (allow.has("jobberClientId") && input.jobberClientId) {
    customFields.push({
      id: STM_GHL.fields.jobberClientId,
      field_value: input.jobberClientId,
    });
  }
  if (allow.has("lastSyncedFrom")) {
    customFields.push({ id: STM_GHL.fields.lastSyncedFrom, field_value: "jobber" });
  }
  if (allow.has("lastSyncedBy")) {
    customFields.push({ id: STM_GHL.fields.lastSyncedBy, field_value: "syncbridge" });
  }
  if (allow.has("lastSyncTimestamp")) {
    customFields.push({
      id: STM_GHL.fields.lastSyncTimestamp,
      field_value: new Date().toISOString(),
    });
  }
  if (customFields.length) body.customFields = customFields;
  return body;
}
