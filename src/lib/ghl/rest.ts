import { getEnv } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";
import { buildPilotGhlContactBody, existingRecordsOnly } from "@/lib/config/pilot";
import { STM_GHL } from "@/lib/config/stm-mapping";

const BASE = "https://services.leadconnectorhq.com";

function headers(): HeadersInit {
  const env = getEnv();
  if (!env.GHL_PRIVATE_INTEGRATION_TOKEN) {
    throw new Error("GHL token missing");
  }
  return {
    Authorization: `Bearer ${env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
    Version: "2021-07-28",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function stmLocationId(): string {
  const env = getEnv();
  const id = env.GHL_LOCATION_ID ?? STM_GHL.locationId;
  if (id !== STM_GHL.locationId) {
    throw new Error("GHL location is not Septic Tank Man");
  }
  return id;
}

export async function ghlGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`GHL GET ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export async function ghlWrite<T>(
  method: "POST" | "PUT" | "PATCH",
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${method} ${path} ${res.status}: ${text.slice(0, 180)}`);
  }
  return res.json() as Promise<T>;
}

export type GhlContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  contactName?: string;
};

export type GhlOpportunity = {
  id: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
};

export async function getGhlContact(id: string): Promise<GhlContact | null> {
  try {
    const json = await ghlGet<{ contact: GhlContact }>(`/contacts/${id}`);
    return json.contact ?? null;
  } catch {
    return null;
  }
}

async function ghlGetOptional<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export async function searchGhlContacts(query: string): Promise<GhlContact[]> {
  const loc = stmLocationId();
  const q = query.trim();
  if (!q) return [];
  const json = await ghlGetOptional<{ contacts?: GhlContact[] }>(
    `/contacts/?locationId=${encodeURIComponent(loc)}&query=${encodeURIComponent(q)}`
  );
  if (json?.contacts?.length) return json.contacts;
  const phoneJson = await ghlGetOptional<{ contacts?: GhlContact[] }>(
    `/contacts/?locationId=${encodeURIComponent(loc)}&phone=${encodeURIComponent(q)}`
  );
  return phoneJson?.contacts ?? [];
}

export async function searchGhlOpportunities(contactId: string): Promise<GhlOpportunity[]> {
  const loc = stmLocationId();
  const json = await ghlGet<{ opportunities?: GhlOpportunity[] }>(
    `/opportunities/search?location_id=${encodeURIComponent(loc)}&contact_id=${encodeURIComponent(contactId)}&pipeline_id=${STM_GHL.salesPipelineId}&limit=20`
  );
  return json.opportunities ?? [];
}

export async function addGhlContactNote(contactId: string, body: string): Promise<string | null> {
  const json = await ghlWrite<{ note?: { id: string } }>("POST", `/contacts/${contactId}/notes`, {
    body,
  });
  return json.note?.id ?? null;
}

export async function upsertGhlContact(input: {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  postalCode?: string;
  jobberClientId?: string;
}): Promise<GhlContact> {
  const loc = stmLocationId();
  if (!input.id && existingRecordsOnly()) {
    throw new GateClosedError("production_writes", "ghl.contact.create");
  }
  const body = buildPilotGhlContactBody(input);
  if (Object.keys(body).length === 0) {
    throw new GateClosedError("production_writes", "ghl.contact.empty_pilot_payload");
  }
  if (input.id) {
    const json = await ghlWrite<{ contact: GhlContact }>("PUT", `/contacts/${input.id}`, body);
    return json.contact;
  }
  const json = await ghlWrite<{ contact: GhlContact }>("POST", "/contacts/", {
    locationId: loc,
    ...body,
  });
  return json.contact;
}

export async function moveOpportunityStage(opts: {
  opportunityId: string;
  pipelineId?: string;
  stageId: string;
}): Promise<void> {
  await ghlWrite("PUT", `/opportunities/${opts.opportunityId}`, {
    pipelineId: opts.pipelineId ?? STM_GHL.salesPipelineId,
    pipelineStageId: opts.stageId,
  });
}

export async function createOpportunity(opts: {
  contactId: string;
  name: string;
  stageId: string;
}): Promise<{ id: string }> {
  const json = await ghlWrite<{ opportunity: { id: string } }>("POST", "/opportunities/", {
    locationId: stmLocationId(),
    pipelineId: STM_GHL.salesPipelineId,
    pipelineStageId: opts.stageId,
    contactId: opts.contactId,
    name: opts.name,
  });
  return json.opportunity;
}
