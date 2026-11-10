import { decideMatch, normalizeEmail, normalizePhone, type MatchDecision } from "@/lib/sync/identity";

export type ProviderHit = { id: string; emails?: string[]; phones?: string[] };

export function collectIdHits(records: ProviderHit[], email?: string | null, phone?: string | null): string[] {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  const hits: string[] = [];
  for (const rec of records) {
    const emails = (rec.emails ?? []).map((x) => normalizeEmail(x)).filter(Boolean);
    const phones = (rec.phones ?? []).map((x) => normalizePhone(x)).filter(Boolean);
    const emailOk = e ? emails.includes(e) : false;
    const phoneOk = p ? phones.includes(p) : false;
    if (emailOk || phoneOk) hits.push(rec.id);
  }
  return [...new Set(hits)];
}

export function decideProviderMatch(opts: {
  existingLinkId?: string;
  ghlHits: string[];
  jobberHits: string[];
}): MatchDecision {
  if (opts.existingLinkId) {
    return { kind: "linked", customerLinkId: opts.existingLinkId };
  }
  if (opts.ghlHits.length === 1) {
    return { kind: "provider", ghlContactId: opts.ghlHits[0] };
  }
  if (opts.ghlHits.length > 1) {
    return { kind: "ambiguous", candidateIds: opts.ghlHits };
  }
  if (opts.jobberHits.length === 1) {
    return { kind: "provider", jobberClientId: opts.jobberHits[0] };
  }
  if (opts.jobberHits.length > 1) {
    return { kind: "ambiguous", candidateIds: opts.jobberHits };
  }
  return decideMatch({ exactIdHits: [], emailPhoneHits: [] });
}

export function jobberClientToGhlPayload(client: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emails?: { address?: string }[];
  phones?: { number?: string }[];
  clientProperties?: {
    nodes?: { address?: { street1?: string; city?: string; postalCode?: string } | null }[];
  };
}) {
  const prop = client.clientProperties?.nodes?.[0]?.address;
  return {
    firstName: client.firstName ?? undefined,
    lastName: client.lastName ?? undefined,
    email: client.emails?.map((e) => e.address).find(Boolean),
    phone: normalizePhone(client.phones?.[0]?.number) ?? undefined,
    address1: prop?.street1,
    city: prop?.city,
    postalCode: prop?.postalCode,
    jobberClientId: client.id,
  };
}

export function quoteInvoiceNoteBody(kind: "quote" | "invoice", opts: {
  id: string;
  number?: string | null;
  status?: string | null;
}): string {
  return `[SyncBridge ${kind} ${opts.number ?? opts.id}] status=${opts.status ?? "unknown"}`;
}

export function jobClosed(status?: string | null): boolean {
  return /close|complete|done/i.test(status ?? "");
}

export function shouldReuseJob(existingJobberJobId?: string | null, incomingJobberJobId?: string | null): boolean {
  return Boolean(existingJobberJobId && incomingJobberJobId && existingJobberJobId === incomingJobberJobId);
}
