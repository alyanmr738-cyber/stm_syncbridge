#!/usr/bin/env node
/**
 * Read-only + token-refresh proof against live Jobber/GHL/Supabase/Vercel.
 * Does not enable gates. Writes only: Jobber token rotation persist, signed webhook inbox.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
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
  if (typeof value !== "string") throw new Error("cred type");
  const s = value.startsWith("\\x") ? value.slice(2) : value;
  return Buffer.from(s, /^[0-9a-fA-F]+$/.test(s) ? "hex" : "base64");
}

function encryptionKey() {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_BASE64, "base64");
  if (key.length !== 32) throw new Error("bad encryption key");
  return key;
}

function decryptJson(blob) {
  const key = encryptionKey();
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
}

function encryptJson(payload) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

loadEnv();
const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SECRET_KEY;
const sbHeaders = {
  apikey: sbKey,
  Authorization: `Bearer ${sbKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sbGet(path) {
  const res = await fetch(`${sbUrl}/rest/v1/${path}`, { headers: sbHeaders });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

async function sbPatch(table, query, body) {
  const res = await fetch(`${sbUrl}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

const evidence = { at: new Date().toISOString() };

const connRes = await sbGet(
  "sync_connections?provider=eq.jobber&select=id,provider,provider_account_id,provider_account_name,status,token_expires_at,last_verified_at"
);
evidence.connection = connRes.json?.[0] ?? connRes;

const credRow = (
  await sbGet(
    "sync_connections?provider=eq.jobber&status=eq.connected&select=id,provider_account_id,encrypted_credentials,token_expires_at"
  )
).json?.[0];

const beforeExpiry = credRow?.token_expires_at;
const creds = decryptJson(parseBytea(credRow.encrypted_credentials));
evidence.refresh = { beforeExpiry, hadRefreshToken: Boolean(creds.refresh_token) };

const tokenRes = await fetch("https://api.getjobber.com/api/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.JOBBER_CLIENT_ID,
    client_secret: process.env.JOBBER_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: creds.refresh_token,
  }),
});
const tokenText = await tokenRes.text();
if (!tokenRes.ok) {
  evidence.refresh.failed = { status: tokenRes.status, body: tokenText.slice(0, 200) };
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(1);
}
const tokenJson = JSON.parse(tokenText);
const next = {
  access_token: tokenJson.access_token,
  refresh_token: tokenJson.refresh_token ?? creds.refresh_token,
  token_type: tokenJson.token_type ?? "Bearer",
  expires_at: new Date(Date.now() + tokenJson.expires_in * 1000).toISOString(),
};
const rotated = next.refresh_token !== creds.refresh_token;
const persist = await sbPatch(
  "sync_connections",
  `id=eq.${credRow.id}`,
  {
    encrypted_credentials: `\\x${encryptJson(next).toString("hex")}`,
    token_expires_at: next.expires_at,
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
);
evidence.refresh.after = {
  ok: persist.ok,
  persistError: persist.ok ? undefined : persist.text.slice(0, 200),
  afterExpiry: next.expires_at,
  refreshTokenRotated: rotated,
  expiresInSec: tokenJson.expires_in,
};

async function gql(query, variables) {
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${next.access_token}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const account = await gql(`query { account { id name } }`);
evidence.jobberAccount = account;

const schema = await gql(`query {
  __schema {
    queryType { fields { name } }
    mutationType { fields { name } }
  }
}`);
const q = schema.data?.__schema?.queryType?.fields?.map((f) => f.name) ?? [];
const m = schema.data?.__schema?.mutationType?.fields?.map((f) => f.name) ?? [];
evidence.jobberApi = {
  webhookishQueries: q.filter((n) => /webhook|appDisconnect|event/i.test(n)),
  clientMutations: m.filter((n) => /client/i.test(n)),
  jobMutations: m.filter((n) => /job|visit/i.test(n)),
  noteMutations: m.filter((n) => /note/i.test(n)),
  avail: [...q, ...m].filter((n) => /avail|reserv|timeslot|openslot|schedul/i.test(n)).slice(0, 40),
};

const clients = await gql(`query { clients(first: 3) { nodes { id name } } }`);
evidence.sampleClients = clients.data?.clients?.nodes ?? clients.errors;

const ghlHeaders = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};
const locId = process.env.GHL_LOCATION_ID;
const loc = await fetch(`https://services.leadconnectorhq.com/locations/${locId}`, {
  headers: ghlHeaders,
});
const locJson = await loc.json();
const pipes = await fetch(
  `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locId}`,
  { headers: ghlHeaders }
);
const pipesJson = await pipes.json();
evidence.ghl = {
  locationStatus: loc.status,
  locationId: locJson.location?.id,
  locationName: locJson.location?.name,
  timezone: locJson.location?.timezone,
  pipeline: (pipesJson.pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    completed: (p.stages ?? []).find((s) => /job completed/i.test(s.name)),
  })),
};

const topic = "CLIENT_UPDATE";
const entityId = "phase1-probe-" + Date.now();
const payload = JSON.stringify({
  topic,
  itemId: entityId,
  occurredAt: new Date().toISOString(),
  data: { probe: true, notALiveCustomer: true },
});
const sig = createHmac("sha256", process.env.JOBBER_CLIENT_SECRET).update(payload).digest("hex");
const hook = await fetch("https://stmsyncbridge.vercel.app/api/webhooks/jobber", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-jobber-hmac-sha256": sig,
  },
  body: payload,
});
const hookBody = await hook.text();
evidence.webhookPost = { status: hook.status, body: hookBody };

const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) throw new Error("CRON_SECRET missing in env");
const worker = await fetch("https://stmsyncbridge.vercel.app/api/internal/process-queue", {
  headers: { Authorization: `Bearer ${cronSecret}` },
});
evidence.worker = { status: worker.status, body: await worker.text() };

evidence.recentEvents = (
  await sbGet(
    "sync_events?select=id,source,event_kind,provider_entity_id,status,last_error_redacted,received_at,processed_at&order=received_at.desc&limit=5"
  )
).json;
evidence.recentJobs = (
  await sbGet("queue_jobs?select=id,sync_event_id,status,attempt&order=created_at.desc&limit=5")
).json;

console.log(JSON.stringify(evidence, null, 2));
