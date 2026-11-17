import { readFileSync } from "node:fs";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

function fp(s) {
  return createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
}
function parseBytea(value) {
  const s = String(value).startsWith("\\x") ? String(value).slice(2) : String(value);
  return /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0 ? Buffer.from(s, "hex") : Buffer.from(s, "base64");
}
function decryptJson(blob) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_BASE64, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
}
function encryptJson(payload) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_BASE64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload), "utf8")), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const sbH = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
async function sb(method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: sbH,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function rotateOnce(label) {
  const row = (await sb("GET", "sync_connections?provider=eq.jobber&status=eq.connected&select=*&limit=1"))[0];
  const creds = decryptJson(parseBytea(row.encrypted_credentials));
  const skew = 120_000;
  if (new Date(creds.expires_at).getTime() - skew > Date.now()) {
    return { label, path: "fresh", accessFp: fp(creds.access_token), gen: row.metadata?.credential_generation };
  }
  const owner = `${label}-${crypto.randomUUID()}`;
  const rpc = await fetch(`${url}/rest/v1/rpc/try_acquire_token_refresh_lock`, {
    method: "POST",
    headers: sbH,
    body: JSON.stringify({
      p_provider: "jobber",
      p_account: row.provider_account_id,
      p_owner: owner,
      p_ttl_seconds: 25,
    }),
  });
  const locked = await rpc.json();
  if (locked !== true) {
    await new Promise((r) => setTimeout(r, 800));
    const again = (await sb("GET", "sync_connections?provider=eq.jobber&select=*&limit=1"))[0];
    const c2 = decryptJson(parseBytea(again.encrypted_credentials));
    return { label, path: "reload", locked, accessFp: fp(c2.access_token), gen: again.metadata?.credential_generation, exp: c2.expires_at };
  }
  const latest = (await sb("GET", "sync_connections?provider=eq.jobber&select=*&limit=1"))[0];
  const latestCreds = decryptJson(parseBytea(latest.encrypted_credentials));
  if (new Date(latestCreds.expires_at).getTime() - skew > Date.now()) {
    await sb("PATCH", `token_refresh_locks?provider=eq.jobber&provider_account_id=eq.${encodeURIComponent(row.provider_account_id)}&owner=eq.${owner}`, {
      locked_until: new Date(0).toISOString(),
    });
    return { label, path: "won-lock-already-fresh", accessFp: fp(latestCreds.access_token), gen: latest.metadata?.credential_generation };
  }
  const tok = await fetch("https://api.getjobber.com/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: latestCreds.refresh_token,
    }),
  });
  const text = await tok.text();
  if (!tok.ok) {
    await sb("PATCH", `token_refresh_locks?provider=eq.jobber&provider_account_id=eq.${encodeURIComponent(row.provider_account_id)}&owner=eq.${owner}`, {
      locked_until: new Date(0).toISOString(),
    });
    return { label, path: "exchange_failed", status: tok.status, body: text.slice(0, 160) };
  }
  const json = JSON.parse(text);
  const next = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? latestCreds.refresh_token,
    token_type: json.token_type ?? "Bearer",
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
  const gen = (latest.metadata?.credential_generation ?? 1) + 1;
  const patch = await fetch(
    `${url}/rest/v1/sync_connections?id=eq.${latest.id}&status=eq.connected&token_expires_at=eq.${encodeURIComponent(latest.token_expires_at)}`,
    {
      method: "PATCH",
      headers: sbH,
      body: JSON.stringify({
        encrypted_credentials: `\\x${encryptJson(next).toString("hex")}`,
        token_expires_at: next.expires_at,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          credential_generation: gen,
          refresh_fp: fp(next.refresh_token),
          access_fp: fp(next.access_token),
          source: "rotation_probe",
          rotated_at: new Date().toISOString(),
        },
      }),
    }
  );
  const saved = await patch.text();
  await sb("PATCH", `token_refresh_locks?provider=eq.jobber&provider_account_id=eq.${encodeURIComponent(row.provider_account_id)}&owner=eq.${owner}`, {
    locked_until: new Date(0).toISOString(),
  });
  return {
    label,
    path: "exchanged",
    persistStatus: patch.status,
    saved: Boolean(saved && saved !== "[]"),
    accessFp: fp(next.access_token),
    refreshFp: fp(next.refresh_token),
    gen,
    exp: next.expires_at,
  };
}

const started = Date.now();
const [a, b] = await Promise.all([rotateOnce("A"), rotateOnce("B")]);
const row = (await sb("GET", "sync_connections?provider=eq.jobber&select=status,token_expires_at,metadata,encrypted_credentials"))[0];
const creds = decryptJson(parseBytea(row.encrypted_credentials));
const gql = await fetch("https://api.getjobber.com/api/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
    "X-JOBBER-GRAPHQL-VERSION": "2026-11-03",
  },
  body: JSON.stringify({ query: "query { account { id name } }" }),
});
console.log(
  JSON.stringify(
    {
      ms: Date.now() - started,
      a,
      b,
      stored: { status: row.status, exp: row.token_expires_at, meta: row.metadata, accessFp: fp(creds.access_token) },
      graphql: { status: gql.status, body: await gql.json() },
    },
    null,
    2
  )
);
