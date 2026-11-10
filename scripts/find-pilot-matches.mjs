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
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString());
}
function digits(p) {
  const x = (p || "").replace(/\D/g, "");
  return x.length >= 10 ? x.slice(-10) : "";
}

loadEnv();
const sbHeaders = {
  apikey: process.env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
};
const rows = await (
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials`,
    { headers: sbHeaders }
  )
).json();
const token = decryptJson(parseBytea(rows[0].encrypted_credentials)).access_token;
async function gql(query, variables) {
  return (
    await fetch("https://api.getjobber.com/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-JOBBER-GRAPHQL-VERSION": "2026-11-03",
      },
      body: JSON.stringify({ query, variables }),
    })
  ).json();
}

const jobber = await gql(`query {
  clients(first: 80) {
    nodes { id name emails { address } phones { number } }
  }
}`);
const loc = process.env.GHL_LOCATION_ID;
const h = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};
const ghl = await (
  await fetch(`https://services.leadconnectorhq.com/contacts/?locationId=${loc}&limit=100`, {
    headers: h,
  })
).json();

const ghlByPhone = new Map();
const ghlByEmail = new Map();
for (const c of ghl.contacts ?? []) {
  const p = digits(c.phone);
  if (p) {
    const arr = ghlByPhone.get(p) ?? [];
    arr.push(c);
    ghlByPhone.set(p, arr);
  }
  if (c.email) {
    const arr = ghlByEmail.get(c.email.toLowerCase()) ?? [];
    arr.push(c);
    ghlByEmail.set(c.email.toLowerCase(), arr);
  }
}

const exact = [];
const ambiguous = [];
for (const jb of jobber.data?.clients?.nodes ?? []) {
  const phones = (jb.phones ?? []).map((x) => digits(x.number)).filter(Boolean);
  const emails = (jb.emails ?? []).map((x) => x.address?.toLowerCase()).filter(Boolean);
  const hits = new Map();
  for (const p of phones) for (const c of ghlByPhone.get(p) ?? []) hits.set(c.id, c);
  for (const e of emails) for (const c of ghlByEmail.get(e) ?? []) hits.set(c.id, c);
  if (hits.size === 1) {
    const c = [...hits.values()][0];
    exact.push({
      jobberId: jb.id,
      jobberName: jb.name,
      ghlId: c.id,
      ghlName: c.contactName,
      phone: c.phone,
      email: c.email,
    });
  } else if (hits.size > 1) {
    ambiguous.push({ jobberId: jb.id, jobberName: jb.name, ghlIds: [...hits.keys()] });
  }
}

const health = await (await fetch("https://stmsyncbridge.vercel.app/api/health")).json();
const unsigned = await fetch("https://stmsyncbridge.vercel.app/api/webhooks/ghl", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});

console.log(
  JSON.stringify(
    {
      samples: { jobber: jobber.data?.clients?.nodes?.length, ghl: ghl.contacts?.length },
      exact,
      ambiguous,
      health,
      unsignedGhl: unsigned.status,
    },
    null,
    2
  )
);
