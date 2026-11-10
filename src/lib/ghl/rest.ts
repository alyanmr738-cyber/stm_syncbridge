import { getEnv } from "@/lib/config/env";
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
};

export async function searchGhlContacts(query: string): Promise<GhlContact[]> {
  const loc = stmLocationId();
  const json = await ghlGet<{ contacts?: GhlContact[] }>(
    `/contacts/?locationId=${encodeURIComponent(loc)}&query=${encodeURIComponent(query)}`
  );
  return json.contacts ?? [];
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
}): Promise<GhlContact> {
  const loc = stmLocationId();
  const body = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    address1: input.address1,
    city: input.city,
    postalCode: input.postalCode,
  };
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
