#!/usr/bin/env node
import { createHmac, createDecipheriv } from "crypto";
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
loadEnv();

const BASE = "https://stmsyncbridge.vercel.app";
const loc = process.env.GHL_LOCATION_ID;
const ghlHeaders = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};
const ghlV3 = { ...ghlHeaders, Version: "v3" };
const ids = {
  wf1: "2af9bb2e-b769-4c60-9eae-194a74dd0778",
  i1: "7a70e54f-dae5-438a-8ce1-dfe6bab822f0",
  z7: "c9a9f5ab-cf0e-47b3-bb61-b5e20db431cd",
  w4: "5bd94585-5540-440c-847c-cebce232b2dd",
};

const health = await (await fetch(`${BASE}/api/health`)).json();
const unsigned = await fetch(`${BASE}/api/webhooks/ghl`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "ContactUpdate", locationId: loc, id: "unauth-probe" }),
});
const unsignedBody = await unsigned.text();

const probeId = "final-verify-" + Date.now();
const payload = JSON.stringify({
  topic: "CLIENT_UPDATE",
  itemId: probeId,
  occurredAt: new Date().toISOString(),
  data: { probe: true },
});
const sig = createHmac("sha256", process.env.JOBBER_CLIENT_SECRET).update(payload).digest("hex");
const jobberWh = await fetch(`${BASE}/api/webhooks/jobber`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-jobber-hmac-sha256": sig },
  body: payload,
});
const jobberWhBody = await jobberWh.text();

const dup = await fetch(`${BASE}/api/webhooks/jobber`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-jobber-hmac-sha256": sig },
  body: payload,
});

async function ghlTry(path, version = "2021-07-28") {
  const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
    headers: { ...ghlHeaders, Version: version },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 400);
  }
  return { status: res.status, json };
}

const workflowAudit = {};
for (const [key, id] of Object.entries(ids)) {
  workflowAudit[key] = {
    get: await ghlTry(`/workflows/${id}`),
    getV3: await ghlTry(`/workflows/${id}`, "v3"),
    definition: await ghlTry(`/workflows/${id}/definition`, "v3"),
    logs: await ghlTry(`/workflows/${id}/logs?locationId=${loc}`, "v3"),
  };
}

const search = await fetch("https://services.leadconnectorhq.com/workflows/search", {
  method: "POST",
  headers: { ...ghlV3, "Content-Type": "application/json" },
  body: JSON.stringify({ locationId: loc, ids: Object.values(ids) }),
});
const searchText = await search.text();

const sbHeaders = {
  apikey: process.env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
};
async function sb(path) {
  return (await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders })).json();
}
const queueJobs = await sb(
  "queue_jobs?select=id,status,attempt,leased_until,created_at,sync_event_id&order=created_at.desc&limit=20"
);
const events = await sb(
  "sync_events?select=id,source,event_kind,status,last_error_redacted,provider_entity_id,received_at,processed_at&order=received_at.desc&limit=15"
);
const links = await sb("customer_links?select=id,jobber_client_id,ghl_contact_id,match_method&limit=20");
const jobLinks = await sb("job_links?select=id,jobber_job_id,ghl_opportunity_id,last_job_status&limit=20");
const pending = await sb("queue_jobs?status=eq.pending&select=id");
const leased = await sb("queue_jobs?status=eq.leased&select=id");
const dlq = await sb("queue_jobs?status=eq.dead_letter&select=id");

console.log(
  JSON.stringify(
    {
      health,
      unsignedGhl: { status: unsigned.status, body: unsignedBody },
      jobberWebhook: { status: jobberWh.status, body: jobberWhBody, dupStatus: dup.status, dupBody: await dup.text() },
      workflowAudit,
      workflowSearch: { status: search.status, body: searchText.slice(0, 1500) },
      queue: {
        pending: pending?.length,
        leased: leased?.length,
        deadLetter: dlq?.length,
        recentJobs: queueJobs,
      },
      recentEvents: events,
      customerLinks: links,
      jobLinks,
    },
    null,
    2
  )
);
