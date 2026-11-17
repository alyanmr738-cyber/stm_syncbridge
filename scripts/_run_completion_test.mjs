import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const envPath = new URL("../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const JOB_GID = "Z2lkOi8vSm9iYmVyL0pvYi8xNjI3MjQ2NDI=";
const OLD_GID = "Z2lkOi8vSm9iYmVyL0pvYi8xNjI3MTYxMTE=";
const OPP = "WzfYXayDHWd48HFEQYR9";
const STAGE = "1724dc1d-02f1-422c-825f-bebb9d427e71";
const EVENT = "a2ccf37d-586e-4968-a920-56d160cee4e0";
const NEW_LINK = "f2ca7487-374e-414d-8955-b3bc97b5cc4c";
const OLD_LINK = "a1410225-032b-40f0-b6d5-74e77884170f";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const step = process.argv[2] ?? "check";

function parseBytea(value) {
  const s = String(value).startsWith("\\x") ? String(value).slice(2) : String(value);
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return Buffer.from(s, "hex");
  return Buffer.from(s, "base64");
}

async function sb(method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`supabase ${method} ${path} ${res.status} ${text}`);
  return json;
}

async function jobberGraphql(query, variables) {
  const { createDecipheriv } = await import("node:crypto");
  const rows = await sb(
    "GET",
    "sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials&order=updated_at.desc&limit=1"
  );
  const blob = parseBytea(rows[0].encrypted_credentials);
  const encKey = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_BASE64, "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
  decipher.setAuthTag(tag);
  const creds = JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"));
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION || "2026-11-03",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

async function ghl(path, method = "GET", body) {
  const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function snapshot(label) {
  const job = await jobberGraphql(
    `query J($id: EncodedId!) { job(id: $id) { id jobNumber jobStatus } }`,
    { id: JOB_GID }
  );
  const opp = await ghl(`/opportunities/${OPP}`);
  const wf = await ghl(`/workflows/?locationId=p7HYMD0h2RScLKL68uj0`);
  const w4 = (wf.json?.workflows ?? []).find((w) => w.id === "5bd94585-5540-440c-847c-cebce232b2dd");
  const links = await sb(
    "GET",
    `job_links?id=in.(${NEW_LINK},${OLD_LINK})&select=id,jobber_job_id,ghl_opportunity_id,last_job_status,last_synced_at`
  );
  const ev = await sb(
    "GET",
    `sync_events?id=eq.${EVENT}&select=id,status,processed_at,last_error_redacted,attempts`
  );
  const pending = await sb(
    "GET",
    "queue_jobs?status=eq.pending&select=id,sync_event_id,created_at&order=created_at.asc&limit=20"
  );
  const o = opp.json?.opportunity ?? opp.json;
  return {
    label,
    jobber: job.job,
    ghl: { id: o?.id, stage: o?.pipelineStageId, status: o?.status, http: opp.status },
    workflow4: w4 ? { status: w4.status, version: w4.version } : null,
    links,
    event: ev[0],
    pendingQueue: pending,
  };
}

async function drain() {
  const secret = process.env.INTERNAL_ACTION_SIGNING_SECRET;
  const raw = "";
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  const res = await fetch("https://stmsyncbridge.vercel.app/api/internal/process-queue", {
    method: "POST",
    headers: { "x-syncbridge-signature": sig },
    body: raw,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function requeue() {
  const jobs = await sb("GET", `queue_jobs?sync_event_id=eq.${EVENT}&select=id,status,attempt`);
  if (jobs[0]) {
    await sb("PATCH", `queue_jobs?id=eq.${jobs[0].id}`, {
      status: "pending",
      attempt: 0,
      lease_owner: null,
      leased_until: null,
    });
  } else {
    await sb("POST", "queue_jobs", {
      sync_event_id: EVENT,
      status: "pending",
      attempt: 0,
      max_attempts: 8,
    });
  }
  await sb("PATCH", `sync_events?id=eq.${EVENT}`, { status: "queued", last_error_redacted: null });
  return jobs;
}

if (step === "check") {
  console.log(JSON.stringify(await snapshot("before"), null, 2));
} else if (step === "map") {
  const before = await snapshot("pre-map");
  if (before.jobber?.jobStatus !== "requires_invoicing") {
    throw new Error(`abort: live Jobber status ${before.jobber?.jobStatus}`);
  }
  if (before.ghl.stage === STAGE) throw new Error("abort: GHL already Job Completed");
  if (before.workflow4?.status === "published") throw new Error("abort: Workflow 4 still published");
  await sb("PATCH", `job_links?id=eq.${OLD_LINK}`, { ghl_opportunity_id: null });
  await sb("PATCH", `job_links?id=eq.${NEW_LINK}`, { ghl_opportunity_id: OPP });
  const after = await snapshot("post-map");
  console.log(JSON.stringify({ before, after }, null, 2));
} else if (step === "run") {
  const live = await snapshot("pre-put");
  if (live.jobber?.jobStatus !== "requires_invoicing") throw new Error("abort: Jobber not requires_invoicing");
  if (live.ghl.stage === STAGE) throw new Error("abort: already completed");
  const q = await requeue();
  const drain1 = await drain();
  const mid = await snapshot("post-put");
  const q2 = await requeue();
  const drain2 = await drain();
  const end = await snapshot("post-replay");
  console.log(JSON.stringify({ live, queueBefore: q, drain1, mid, drain2, end }, null, 2));
} else {
  throw new Error(step);
}
