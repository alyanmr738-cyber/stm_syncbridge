import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getGhlContact, getGhlOpportunity } from "@/lib/ghl/rest";
import {
  fetchJobberClient,
  fetchJobberInvoice,
  fetchJobberJob,
  fetchJobberQuote,
  isJobberEncodedId,
  type JobberClient,
} from "@/lib/jobber/ops";
import { jobberGraphql } from "@/lib/jobber/graphql";
import { displayName } from "@/lib/display/format";

export type LabelKey = {
  provider: "jobber" | "ghl";
  entity_type: "client" | "contact" | "job" | "opportunity" | "quote" | "invoice";
  entity_id: string;
};

export type EntityLabel = LabelKey & {
  title: string;
  subtitle?: string | null;
  extra: Record<string, unknown>;
  lookup_ok: boolean;
};

const TTL_MS = 12 * 60 * 60 * 1000;
const LIVE_CAP = 24;

function clientTitle(c: JobberClient): string {
  return displayName([c.firstName, c.lastName, c.name], "");
}

export async function readCachedLabels(keys: LabelKey[]): Promise<Map<string, EntityLabel>> {
  const map = new Map<string, EntityLabel>();
  const supabase = getSupabaseAdmin();
  if (!supabase || keys.length === 0) return map;
  const ids = [...new Set(keys.map((k) => k.entity_id))];
  const { data } = await supabase
    .from("entity_labels")
    .select("provider, entity_type, entity_id, title, subtitle, extra, lookup_ok, fetched_at")
    .in("entity_id", ids);
  const now = Date.now();
  for (const row of data ?? []) {
    const fetched = new Date(String(row.fetched_at)).getTime();
    if (Number.isFinite(fetched) && now - fetched > TTL_MS) continue;
    map.set(`${row.provider}:${row.entity_type}:${row.entity_id}`, {
      provider: row.provider as EntityLabel["provider"],
      entity_type: row.entity_type as EntityLabel["entity_type"],
      entity_id: String(row.entity_id),
      title: String(row.title ?? ""),
      subtitle: (row.subtitle as string | null) ?? null,
      extra: (row.extra as Record<string, unknown>) ?? {},
      lookup_ok: row.lookup_ok !== false,
    });
  }
  return map;
}

async function writeLabels(rows: EntityLabel[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || rows.length === 0) return;
  try {
  await supabase.from("entity_labels").upsert(
    rows.map((r) => ({
      provider: r.provider,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      title: r.title || null,
      subtitle: r.subtitle ?? null,
      extra: r.extra,
      lookup_ok: r.lookup_ok,
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: "provider,entity_type,entity_id" }
  );
  } catch {
    /* cache is optional; dashboard still renders fallbacks */
  }
}

async function batchJobberClients(ids: string[]): Promise<EntityLabel[]> {
  const out: EntityLabel[] = [];
  const valid = ids.filter(isJobberEncodedId);
  for (let i = 0; i < valid.length; i += 8) {
    const chunk = valid.slice(i, i + 8);
    const fields = chunk
      .map(
        (id, idx) =>
          `n${idx}: client(id: "${id}") { id firstName lastName name emails { address } phones { number } }`
      )
      .join("\n");
    try {
      const data = await jobberGraphql<Record<string, JobberClient | null>>(`query { ${fields} }`);
      chunk.forEach((id, idx) => {
        const c = data[`n${idx}`];
        if (!c) {
          out.push({
            provider: "jobber",
            entity_type: "client",
            entity_id: id,
            title: "",
            extra: {},
            lookup_ok: false,
          });
          return;
        }
        const title = clientTitle(c);
        out.push({
          provider: "jobber",
          entity_type: "client",
          entity_id: id,
          title,
          extra: {
            email: c.emails?.[0]?.address ?? null,
            phone: c.phones?.[0]?.number ?? null,
          },
          lookup_ok: Boolean(title),
        });
      });
    } catch {
      for (const id of chunk) {
        try {
          const c = await fetchJobberClient(id);
          const title = c ? clientTitle(c) : "";
          out.push({
            provider: "jobber",
            entity_type: "client",
            entity_id: id,
            title,
            extra: {
              email: c?.emails?.[0]?.address ?? null,
              phone: c?.phones?.[0]?.number ?? null,
            },
            lookup_ok: Boolean(c && title),
          });
        } catch {
          out.push({
            provider: "jobber",
            entity_type: "client",
            entity_id: id,
            title: "",
            extra: {},
            lookup_ok: false,
          });
        }
      }
    }
  }
  return out;
}

async function liveFetch(key: LabelKey): Promise<EntityLabel> {
  try {
    if (key.provider === "jobber" && key.entity_type === "job") {
      const j = await fetchJobberJob(key.entity_id);
      const title = j?.title || (j?.jobNumber ? `Job ${j.jobNumber}` : "");
      return {
        ...key,
        title,
        extra: { jobNumber: j?.jobNumber ?? null, jobStatus: j?.jobStatus ?? null, clientId: j?.client?.id ?? null },
        lookup_ok: Boolean(j),
      };
    }
    if (key.provider === "jobber" && key.entity_type === "quote") {
      const q = await fetchJobberQuote(key.entity_id);
      return {
        ...key,
        title: q?.quoteNumber ? `Quote ${q.quoteNumber}` : "",
        extra: { quoteNumber: q?.quoteNumber ?? null, quoteStatus: q?.quoteStatus ?? null, clientId: q?.client?.id ?? null },
        lookup_ok: Boolean(q),
      };
    }
    if (key.provider === "jobber" && key.entity_type === "invoice") {
      const inv = await fetchJobberInvoice(key.entity_id);
      return {
        ...key,
        title: inv?.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : "",
        extra: {
          invoiceNumber: inv?.invoiceNumber ?? null,
          invoiceStatus: inv?.invoiceStatus ?? null,
          clientId: inv?.client?.id ?? null,
        },
        lookup_ok: Boolean(inv),
      };
    }
    if (key.provider === "ghl" && key.entity_type === "contact") {
      const c = await getGhlContact(key.entity_id);
      const title = displayName([c?.firstName, c?.lastName, c?.contactName], "");
      return {
        ...key,
        title,
        extra: { email: c?.email ?? null, phone: c?.phone ?? null },
        lookup_ok: Boolean(c),
      };
    }
    if (key.provider === "ghl" && key.entity_type === "opportunity") {
      const o = await getGhlOpportunity(key.entity_id);
      return {
        ...key,
        title: o?.name || "",
        extra: { pipelineStageId: o?.pipelineStageId ?? null, contactId: o?.contactId ?? null },
        lookup_ok: Boolean(o),
      };
    }
  } catch {
    return { ...key, title: "", extra: {}, lookup_ok: false };
  }
  return { ...key, title: "", extra: {}, lookup_ok: false };
}

export async function hydrateLabels(keys: LabelKey[]): Promise<Map<string, EntityLabel>> {
  const unique = new Map<string, LabelKey>();
  for (const k of keys) {
    if (!k.entity_id) continue;
    unique.set(`${k.provider}:${k.entity_type}:${k.entity_id}`, k);
  }
  const wanted = [...unique.values()];
  const cached = await readCachedLabels(wanted);
  const missing = wanted.filter((k) => !cached.has(`${k.provider}:${k.entity_type}:${k.entity_id}`));
  const jobberClients = missing.filter((k) => k.provider === "jobber" && k.entity_type === "client");
  const others = missing.filter((k) => !(k.provider === "jobber" && k.entity_type === "client"));
  const toLive = others.slice(0, LIVE_CAP);
  const fresh: EntityLabel[] = [];
  if (jobberClients.length) {
    fresh.push(...(await batchJobberClients(jobberClients.map((k) => k.entity_id).slice(0, LIVE_CAP))));
  }
  const concurrency = 4;
  for (let i = 0; i < toLive.length; i += concurrency) {
    const chunk = toLive.slice(i, i + concurrency);
    const part = await Promise.all(chunk.map(liveFetch));
    fresh.push(...part);
  }
  await writeLabels(fresh);
  for (const row of fresh) {
    cached.set(`${row.provider}:${row.entity_type}:${row.entity_id}`, row);
  }
  return cached;
}

export function labelOf(
  map: Map<string, EntityLabel>,
  provider: LabelKey["provider"],
  entity_type: LabelKey["entity_type"],
  entity_id?: string | null
): EntityLabel | null {
  if (!entity_id) return null;
  return map.get(`${provider}:${entity_type}:${entity_id}`) ?? null;
}
