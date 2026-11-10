#!/usr/bin/env node
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
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
}

function parseBytea(value) {
  const s = value.startsWith("\\x") ? value.slice(2) : value;
  return Buffer.from(s, "hex");
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

loadEnv();
const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SECRET_KEY;
const sbHeaders = {
  apikey: sbKey,
  Authorization: `Bearer ${sbKey}`,
};

async function sbGet(path) {
  const res = await fetch(`${sbUrl}/rest/v1/${path}`, { headers: sbHeaders });
  return res.json();
}

const credRow = (
  await sbGet(
    "sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials,token_expires_at,provider_account_id,provider_account_name"
  )
)[0];
const creds = decryptJson(parseBytea(credRow.encrypted_credentials));
const token = creds.access_token;

async function gql(version, query, variables) {
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": version,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const versions = ["2026-09-25", "2026-11-03", "2025-04-16"];
const versionProbe = {};
for (const v of versions) {
  const json = await gql(v, `query { account { id name } }`);
  versionProbe[v] = {
    ok: Boolean(json.data?.account?.id),
    warning: json.extensions?.versioning?.warning ?? null,
    resolved: json.extensions?.versioning?.version ?? null,
    errors: json.errors?.map((e) => e.message) ?? null,
  };
}

const v = versionProbe["2026-09-25"].ok ? "2026-09-25" : "2025-04-16";
const schema = await gql(
  v,
  `query { __schema { queryType { fields { name } } mutationType { fields { name } } } }`
);
const q = schema.data?.__schema?.queryType?.fields?.map((f) => f.name) ?? [];
const m = schema.data?.__schema?.mutationType?.fields?.map((f) => f.name) ?? [];
const scheduling = [...q, ...m].filter((n) =>
  /avail|reserv|timeslot|openslot|schedul|visit|appointment/i.test(n)
);

const webhookFields = q.filter((n) => /webhook/i.test(n));
const webhookMut = m.filter((n) => /webhook/i.test(n));

async function countConn(query) {
  const json = await gql(v, query);
  return json.data;
}

const inventory = await countConn(`query {
  clients { totalCount }
  jobs { totalCount }
  quotes { totalCount }
  invoices { totalCount }
}`);

const ghlHeaders = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};
const locId = process.env.GHL_LOCATION_ID;
const [pipes, cals, wfs, contacts] = await Promise.all([
  fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locId}`, {
    headers: ghlHeaders,
  }).then((r) => r.json()),
  fetch(`https://services.leadconnectorhq.com/calendars/?locationId=${locId}`, {
    headers: ghlHeaders,
  }).then((r) => r.json()),
  fetch(`https://services.leadconnectorhq.com/workflows/?locationId=${locId}`, {
    headers: ghlHeaders,
  }).then(async (r) => ({ status: r.status, body: await r.json() })),
  fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${locId}&limit=1`, {
    headers: ghlHeaders,
  }).then(async (r) => ({ status: r.status, body: await r.json() })),
]);

const unsigned = await fetch("https://stmsyncbridge.vercel.app/api/webhooks/ghl", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "ContactUpdate", locationId: locId, id: "should-401" }),
});
const health = await fetch("https://stmsyncbridge.vercel.app/api/health").then((r) => r.json());

const out = {
  at: new Date().toISOString(),
  jobberAccount: { id: credRow.provider_account_id, name: credRow.provider_account_name },
  versionProbe,
  schedulingOps: scheduling,
  webhookQueries: webhookFields,
  webhookMutations: webhookMut,
  inventory,
  ghl: {
    locationId: locId,
    pipelines: (pipes.pipelines ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      jobCompleted: (p.stages ?? []).find((s) => s.id === "1724dc1d-02f1-422c-825f-bebb9d427e71"),
    })),
    calendars: (cals.calendars ?? []).map((c) => ({ id: c.id, name: c.name })),
    workflows: wfs,
    contactsMeta: { status: contacts.status, total: contacts.body?.meta?.total },
  },
  production: {
    health,
    unsignedGhlStatus: unsigned.status,
    unsignedGhlBody: await unsigned.text(),
  },
};
console.log(JSON.stringify(out, null, 2));
