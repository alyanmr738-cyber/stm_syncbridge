import { readFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";

const envPath = new URL("../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!process.env[k]) process.env[k] = v;
}

function gid(kind, n) {
  return Buffer.from(`gid://Jobber/${kind}/${n}`).toString("base64");
}

function parseBytea(value) {
  if (typeof value !== "string") throw new Error("blob");
  const s = value.startsWith("\\x") ? value.slice(2) : value;
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return Buffer.from(s, "hex");
  return Buffer.from(s, "base64");
}

function decryptJson(blob) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_BASE64, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
}

function jobClosed(status) {
  const s = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return false;
  if (s === "requires_invoicing") return true;
  return /^(closed?|complete[d]?|done)$/.test(s);
}

async function sb(path) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`supabase ${path} ${res.status} ${await res.text()}`);
  return res.json();
}

async function jobberGraphql(query, variables) {
  const rows = await sb(
    "sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials&order=updated_at.desc&limit=1"
  );
  const creds = decryptJson(parseBytea(rows[0].encrypted_credentials));
  let access = creds.access_token;
  if (creds.expires_at && Date.parse(creds.expires_at) < Date.now() + 60_000 && creds.refresh_token) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
    });
    const tok = await fetch("https://api.getjobber.com/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await tok.json();
    if (!tok.ok) throw new Error(`jobber refresh ${tok.status}`);
    access = json.access_token;
  }
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION || "2026-11-03",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

async function ghl(path) {
  const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const ids = {
  jobNew: "162724642",
  jobOld: "162716111",
  clientNew: "158987851",
  clientOld: "158978836",
  opp: "WzfYXayDHWd48HFEQYR9",
  contact: "Oz6ZOxZUXGs48oAqKxE2",
};
const gids = {
  jobNew: gid("Job", ids.jobNew),
  jobOld: gid("Job", ids.jobOld),
  clientNew: gid("Client", ids.clientNew),
  clientOld: gid("Client", ids.clientOld),
};

const clientQ = `query C($id: EncodedId!) {
  client(id: $id) { id name firstName lastName emails { address } phones { number } }
}`;
const jobQ = `query J($id: EncodedId!) {
  job(id: $id) { id jobNumber jobStatus title client { id name } }
}`;

const search = await jobberGraphql(
  `query S($q: String!) { clients(searchTerm: $q, first: 10) { nodes { id name emails { address } phones { number } } } }`,
  { q: "evan@allaccessdigital.net" }
);
const [cNew, cOld, jNew, jOld, contact, opp, wf, jobLinks, custLinks, events, reviews] =
  await Promise.all([
    jobberGraphql(clientQ, { id: gids.clientNew }),
    jobberGraphql(clientQ, { id: gids.clientOld }),
    jobberGraphql(jobQ, { id: gids.jobNew }),
    jobberGraphql(jobQ, { id: gids.jobOld }),
    ghl(`/contacts/${ids.contact}`),
    ghl(`/opportunities/${ids.opp}`),
    ghl(`/workflows/?locationId=p7HYMD0h2RScLKL68uj0`),
    sb(
      `job_links?or=(jobber_job_id.eq.${ids.jobNew},jobber_job_id.eq."${gids.jobNew}",jobber_job_id.eq.${ids.jobOld},jobber_job_id.eq."${gids.jobOld}",ghl_opportunity_id.eq.${ids.opp})&select=*`
    ),
    sb(
      `customer_links?or=(jobber_client_id.eq.${ids.clientNew},jobber_client_id.eq."${gids.clientNew}",jobber_client_id.eq.${ids.clientOld},jobber_client_id.eq."${gids.clientOld}",ghl_contact_id.eq.${ids.contact})&select=*`
    ),
    sb(
      `sync_events?or=(provider_entity_id.eq.${ids.jobNew},provider_entity_id.eq."${gids.jobNew}",provider_entity_id.eq.${ids.jobOld},provider_entity_id.eq."${gids.jobOld}")&select=id,source,event_kind,provider_entity_id,status,provider_event_key,processed_at,received_at,payload,last_error_redacted&order=received_at.desc&limit=40`
    ),
    sb(`review_deliveries?or=(jobber_job_id.eq.${ids.jobNew},jobber_job_id.eq."${gids.jobNew}")&select=*`),
  ]);

function slimClient(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
    emails: (c.emails ?? []).map((e) => e.address?.toLowerCase()),
    phones: (c.phones ?? []).map((p) => (p.number ?? "").replace(/\D/g, "").slice(-10)),
  };
}

const wf4 = (wf.json?.workflows ?? wf.json ?? []).find?.((w) =>
  /workflow 4|service completed/i.test(w.name ?? "")
) ?? (Array.isArray(wf.json?.workflows) ? wf.json.workflows.find((w) => w.id === "5bd94585-5540-440c-847c-cebce232b2dd") : null);

const o = opp.json?.opportunity ?? opp.json;
const ct = contact.json?.contact ?? contact.json;

console.log(
  JSON.stringify(
    {
      jobberClients: { new: slimClient(cNew.client), old: slimClient(cOld.client) },
      evanClientSearch: (search.clients?.nodes ?? []).map(slimClient),
      sameIdentity: {
        email:
          slimClient(cNew.client)?.emails?.includes("evan@allaccessdigital.net") &&
          slimClient(cOld.client)?.emails?.includes("evan@allaccessdigital.net"),
        phoneLast10:
          slimClient(cNew.client)?.phones?.includes("7728122183") &&
          slimClient(cOld.client)?.phones?.includes("7728122183"),
      },
      jobNew: { ...jNew.job, jobClosed: jobClosed(jNew.job?.jobStatus) },
      jobOld: jOld.job,
      ghlContact: ct
        ? { id: ct.id, name: ct.contactName || `${ct.firstName} ${ct.lastName}`, email: ct.email, phone: ct.phone }
        : { status: contact.status },
      ghlOpp: o
        ? {
            id: o.id,
            name: o.name,
            contactId: o.contactId,
            pipelineId: o.pipelineId,
            pipelineStageId: o.pipelineStageId,
            status: o.status,
          }
        : { http: opp.status, body: opp.json },
      workflow4: wf4 ?? { listed: Array.isArray(wf.json?.workflows), count: wf.json?.workflows?.length, http: wf.status },
      jobLinks,
      custLinks,
      events: events.map((e) => ({
        id: e.id,
        kind: e.event_kind,
        entity: e.provider_entity_id,
        status: e.status,
        key: e.provider_event_key,
        created: e.received_at,
        processed: e.processed_at,
        err: e.last_error_redacted,
        payloadKeys: e.payload && typeof e.payload === "object" ? Object.keys(e.payload) : [],
        jobStatus: e.payload?.jobStatus ?? e.payload?.data?.webHookEvent?.topic,
      })),
      reviews,
      gids,
    },
    null,
    2
  )
);
