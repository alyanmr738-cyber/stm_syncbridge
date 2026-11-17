#!/usr/bin/env node
/**
 * READ-ONLY Jobber GraphQL schema probe using production encrypted token from Supabase.
 * Does not open Developer Center GraphiQL or run mutations.
 */
import { createDecipheriv } from "crypto";
import { readFileSync, writeFileSync } from "fs";
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
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
}

loadEnv();

const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SECRET_KEY;
const version =
  process.env.JOBBER_GRAPHQL_VERSION?.trim() || "2026-11-03";

async function sbGet(path) {
  const res = await fetch(`${sbUrl}/rest/v1/${path}`, {
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
  });
  return res.json();
}

const credRow = (
  await sbGet(
    "sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials,granted_scopes,provider_account_id"
  )
)[0];

if (!credRow?.encrypted_credentials) {
  console.error("No connected Jobber row");
  process.exit(1);
}

const creds = decryptJson(parseBytea(credRow.encrypted_credentials));
const token = creds.access_token;

async function gql(query, variables) {
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

const mutations = await gql(`query { __schema { mutationType { fields { name } } } }`);
const mutationNames = mutations.data?.__schema?.mutationType?.fields?.map((f) => f.name) ?? [];

async function typeDetail(name) {
  const json = await gql(
    `query Type($name: String!) {
      __type(name: $name) {
        name
        kind
        inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
        fields { name type { kind name } }
      }
    }`,
    { name }
  );
  return json.data?.__type ?? json.errors ?? null;
}

const report = {
  probedAt: new Date().toISOString(),
  graphqlVersion: version,
  accountId: credRow.provider_account_id,
  grantedScopes: credRow.granted_scopes,
  hasJobCreate: mutationNames.includes("jobCreate"),
  hasClientCreate: mutationNames.includes("clientCreate"),
  jobCreateType: await typeDetail("JobCreatePayload"),
  clientCreateType: await typeDetail("ClientCreatePayload"),
  jobCreateInput: await typeDetail("JobCreateInput"),
  clientCreateInput: await typeDetail("ClientCreateInput"),
  implementationNote:
    "syncbridge/src/lib/jobber/ops.ts uses clientCreate(ClientCreateInput) and jobCreate(JobCreateInput) with clientId/title/propertyId",
};

const out = resolve(process.cwd(), "docs/JOBBER_CREATION_SCHEMA_PROBE.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log("Wrote", out);
console.log(
  JSON.stringify(
    {
      version,
      hasJobCreate: report.hasJobCreate,
      hasClientCreate: report.hasClientCreate,
      jobCreateInputFields: report.jobCreateInput?.inputFields?.map((f) => f.name),
      clientCreateInputFields: report.clientCreateInput?.inputFields?.map((f) => f.name),
    },
    null,
    2
  )
);