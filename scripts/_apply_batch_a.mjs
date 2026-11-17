import { readFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i);
  let v = t.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

function parseBytea(value) {
  const s = String(value).startsWith("\\x") ? String(value).slice(2) : String(value);
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return Buffer.from(s, "hex");
  return Buffer.from(s, "base64");
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
function normEmail(v) {
  if (!v) return null;
  const e = String(v).trim().toLowerCase();
  return e.includes("@") ? e : null;
}
function normPhone(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}
function nameTokens(s) {
  return new Set(
    String(s ?? "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}
function namesAligned(a, b) {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (!A.size || !B.size) return false;
  for (const t of A) if (B.has(t)) return true;
  return false;
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
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const conn = await sb(
  "GET",
  "sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials&order=updated_at.desc&limit=1"
);
const creds = decryptJson(parseBytea(conn[0].encrypted_credentials));
let access = creds.access_token;
async function gql(query, variables, attempt = 0) {
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION || "2026-11-03",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (res.status === 401 && creds.refresh_token && attempt < 2) {
    const tok = await fetch("https://api.getjobber.com/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: creds.refresh_token,
        client_id: process.env.JOBBER_CLIENT_ID,
        client_secret: process.env.JOBBER_CLIENT_SECRET,
      }),
    });
    const tj = await tok.json();
    if (!tok.ok) throw new Error("jobber refresh failed");
    access = tj.access_token;
    return gql(query, variables, attempt + 1);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 2500 + attempt * 500));
      return gql(query, variables, attempt + 1);
    }
    throw new Error(`jobber_non_json ${res.status} ${text.slice(0, 80)}`);
  }
  const msg = (json.errors ?? []).map((e) => e.message).join("; ");
  if (/throttl/i.test(msg) && attempt < 6) {
    await new Promise((r) => setTimeout(r, 2500));
    return gql(query, variables, attempt + 1);
  }
  if (json.errors?.length) throw new Error(msg || "jobber graphql error");
  if (!json.data) throw new Error(`jobber empty ${res.status} ${JSON.stringify(json).slice(0, 180)}`);
  return json.data;
}

const ghlH = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};
async function getGhl(id) {
  const res = await fetch(`https://services.leadconnectorhq.com/contacts/${id}`, { headers: ghlH });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ghl ${id} ${res.status}`);
  const json = await res.json();
  return json.contact ?? json;
}

const report = JSON.parse(readFileSync(new URL("./_match_report.json", import.meta.url), "utf8"));
const SHERRI_J = "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNDc0MDA4OTU=";
const SHERRI_G = "XBLvsZlB2cwIYYTDwAnI";
const EVAN_DELETED = "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTg5Nzg4MzY=";
const EVAN_LIVE = "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTg5ODc4NTE=";
const EVAN_GHL = "Oz6ZOxZUXGs48oAqKxE2";
const EVAN_ROW = "05fac55c-5bc8-4c1f-943c-3a33ffc1ab55";
const PENDING_ROW = "34a4c267-a1a0-41ac-b708-d0f513d012c9";

const inserts = report.proposedCustomerLinks.filter(
  (p) =>
    p.action === "insert_customer_link" &&
    p.match_method === "email_and_phone_unique" &&
    p.jobber_client_id !== SHERRI_J &&
    p.ghl_contact_id !== SHERRI_G
);

const mode = process.argv[2] ?? "validate";
const snapshot = [];

async function revalidate(jobberId, ghlId) {
  let data;
  try {
    data = await gql(
      `query C($id: EncodedId!) {
        client(id: $id) {
          id name firstName lastName
          emails { address }
          phones { number }
        }
      }`,
      { id: jobberId }
    );
  } catch (e) {
    return { ok: false, reason: `jobber_query:${String(e).slice(0, 120)}`, jobberId, ghlId };
  }
  const jb = data.client;
  const ghl = await getGhl(ghlId);
  if (!jb) return { ok: false, reason: "jobber_missing" };
  if (!ghl) return { ok: false, reason: "ghl_missing" };
  const je = new Set((jb.emails ?? []).map((e) => normEmail(e.address)).filter(Boolean));
  const jp = new Set((jb.phones ?? []).map((p) => normPhone(p.number)).filter(Boolean));
  const ge = new Set([normEmail(ghl.email)].filter(Boolean));
  const gp = new Set([normPhone(ghl.phone)].filter(Boolean));
  const emailHit = [...je].some((e) => ge.has(e));
  const phoneHit = [...jp].some((p) => gp.has(p));
  const jn = `${jb.firstName ?? ""} ${jb.lastName ?? ""} ${jb.name ?? ""}`;
  const gn = `${ghl.firstName ?? ""} ${ghl.lastName ?? ""} ${ghl.contactName ?? ""}`;
  const aligned = namesAligned(jn, gn);
  const ok = emailHit && phoneHit && aligned;
  return {
    ok,
    reason: ok ? "ok" : !emailHit ? "email_mismatch" : !phoneHit ? "phone_mismatch" : "name_not_aligned",
    jobberId,
    ghlId,
    emails: [...je],
    phones: [...jp],
    ghlEmail: [...ge][0] ?? null,
    ghlPhone: [...gp][0] ?? null,
    jn: jn.trim(),
    gn: gn.trim(),
    ghlUpdated: ghl.dateUpdated || ghl.updatedAt || null,
  };
}

const NAME_REJECT_JOBBER = new Set([
  "Z2lkOi8vSm9iYmVyL0NsaWVudC84OTcyMzEzNQ==",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xMTkwNjEwNTA=",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNDY3Mjc1ODA=",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNDc1NjA1ODk=",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTEyMjY1ODM=",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTUxMjY2ODM=",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTU5NjU2ODY=",
  "Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTc2NzA0Njk=",
]);

const existing = await sb("GET", "customer_links?select=id,jobber_client_id,ghl_contact_id,verified");
const usedJ = new Set(existing.map((r) => r.jobber_client_id));
const usedG = new Set(existing.map((r) => r.ghl_contact_id));

const eligible = [];
const rejected = [];

if (mode === "rest-validated") {
  for (const p of inserts) {
    if (NAME_REJECT_JOBBER.has(p.jobber_client_id)) {
      rejected.push({ ...p, reason: "name_not_aligned" });
      continue;
    }
    if (usedJ.has(p.jobber_client_id) || usedG.has(p.ghl_contact_id)) continue;
    const ghl = await getGhl(p.ghl_contact_id);
    if (!ghl) {
      rejected.push({ ...p, reason: "ghl_missing" });
      continue;
    }
    eligible.push({ ...p, emails: [ghl.email].filter(Boolean), phones: [ghl.phone].filter(Boolean) });
    await new Promise((r) => setTimeout(r, 80));
  }
} else {
  for (const p of inserts) {
    if (usedJ.has(p.jobber_client_id) || usedG.has(p.ghl_contact_id)) {
      rejected.push({ ...p, reason: "conflicting_existing_link" });
      continue;
    }
    await new Promise((r) => setTimeout(r, 400));
    const v = await revalidate(p.jobber_client_id, p.ghl_contact_id);
    if (!v.ok) rejected.push({ ...p, ...v });
    else eligible.push({ ...p, ...v });
  }
}

const pending = existing.find((r) => r.id === PENDING_ROW);
let pendingV = null;
let evanLiveV = { skipped: true };
if (mode === "rest-validated") {
  if (pending && !pending.verified) pendingV = { ok: true, reason: "prior_live_validate_2026-11-13T20:01Z" };
} else {
  if (pending) pendingV = await revalidate(pending.jobber_client_id, pending.ghl_contact_id);
  evanLiveV = await revalidate(EVAN_LIVE, EVAN_GHL);
}

const out = {
  omitted: {
    sherri: { jobber: SHERRI_J, ghl: SHERRI_G, reason: "name_mismatch_excluded_by_approval" },
    evanLivePair: {
      jobber: EVAN_LIVE,
      ghl: EVAN_GHL,
      reason:
        "89th unique email+phone pair; GHL already on deleted-client row 05fac55c. Retarget that row to live client instead of insert.",
      liveRevalidate: evanLiveV,
    },
    math: "89 = 86 inserts after dropping Sherri from 87 + 1 pending verify 34a4c267 + 1 Evan live blocked by deleted link",
  },
  eligibleInserts: eligible.length,
  rejectedInserts: rejected,
  pendingVerify: { id: PENDING_ROW, ok: pendingV?.ok, detail: pendingV },
};

if (mode === "validate") {
  console.log(JSON.stringify({ ...out, eligibleSample: eligible.slice(0, 3) }, null, 2));
  process.exit(0);
}

async function insertLink(p) {
  return sb("POST", "customer_links", {
    jobber_client_id: p.jobber_client_id,
    ghl_contact_id: p.ghl_contact_id,
    match_method: "email_and_phone_unique",
    verified: true,
    last_synced_at: new Date().toISOString(),
    last_jobber_revision: JSON.stringify({ source: "batch_a_reconcile", emails: p.emails, phones: p.phones }),
  });
}

if (mode === "canary") {
  const n = Math.min(3, eligible.length);
  const applied = [];
  for (const p of eligible.slice(0, n)) {
    const row = await insertLink(p);
    applied.push({ id: row[0]?.id, jobber: p.jobber_client_id, ghl: p.ghl_contact_id, ghlUpdatedBefore: p.ghlUpdated });
  }
  console.log(JSON.stringify({ canary: applied, rejectedCount: rejected.length }, null, 2));
  process.exit(0);
}

if (mode === "canary-check") {
  const ids = process.argv.slice(3);
  const after = [];
  for (const id of ids) {
    const c = await getGhl(id);
    after.push({
      id,
      updated: c?.dateUpdated || c?.updatedAt || null,
      email: c?.email,
      phone: c?.phone,
    });
  }
  console.log(JSON.stringify({ after }, null, 2));
  process.exit(0);
}

if (mode === "rest" || mode === "rest-validated") {
  const skip = new Set(process.argv.slice(3));
  const applied = [];
  for (const p of eligible) {
    if (skip.has(p.ghl_contact_id) || skip.has(p.jobber_client_id)) continue;
    const exists = existing.find(
      (r) => r.jobber_client_id === p.jobber_client_id || r.ghl_contact_id === p.ghl_contact_id
    );
    if (exists) continue;
    const row = await insertLink(p);
    applied.push(row[0]?.id);
    await new Promise((r) => setTimeout(r, 30));
  }
  const evanRow = existing.find((r) => r.id === EVAN_ROW);
  const evan =
    evanRow?.jobber_client_id === EVAN_LIVE
      ? [{ already: true, id: EVAN_ROW }]
      : await sb("PATCH", `customer_links?id=eq.${EVAN_ROW}`, {
          jobber_client_id: EVAN_LIVE,
          verified: true,
          match_method: "email_and_phone_unique",
          last_jobber_revision: JSON.stringify({
            replacedDeletedJobberClient: EVAN_DELETED,
            source: "batch_a_reconcile",
          }),
          last_synced_at: new Date().toISOString(),
        });
  let pendingUp = null;
  if (pendingV?.ok) {
    pendingUp = await sb("PATCH", `customer_links?id=eq.${PENDING_ROW}`, {
      verified: true,
      match_method: "email_and_phone_unique",
      last_synced_at: new Date().toISOString(),
    });
  }
  const verified = await sb("GET", "customer_links?verified=eq.true&select=id");
  console.log(
    JSON.stringify(
      {
        inserted: applied.length,
        evanRetarget: evan,
        pendingVerified: pendingUp,
        pendingSkipped: pendingV?.ok ? false : pendingV,
        activeVerified: verified.length,
        rejected: rejected.length,
      },
      null,
      2
    )
  );
}
