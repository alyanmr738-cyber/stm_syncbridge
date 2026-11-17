import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
function last10(p) {
  return (p ?? "").replace(/\D/g, "").slice(-10);
}
function nameKey(c) {
  return `${c.firstName ?? ""} ${c.lastName ?? ""} ${c.name ?? ""}`.trim().toLowerCase().replace(/\s+/g, " ");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const sbHeaders = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
async function sb(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`sb ${path} ${res.status} ${await res.text()}`);
  return res.json();
}

const conn = await sb(
  "sync_connections?provider=eq.jobber&status=eq.connected&select=encrypted_credentials&order=updated_at.desc&limit=1"
);
const creds = decryptJson(parseBytea(conn[0].encrypted_credentials));
let access = creds.access_token;

async function gql(query, variables) {
  const res = await fetch("https://api.getjobber.com/api/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": process.env.JOBBER_GRAPHQL_VERSION || "2026-11-03",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401 && creds.refresh_token) {
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
    const json = await tok.json();
    if (!tok.ok) throw new Error("jobber refresh failed");
    access = json.access_token;
    return gql(query, variables);
  }
  const json = await res.json();
  const msg = (json.errors ?? []).map((e) => e.message).join("; ");
  if (/throttl/i.test(msg)) {
    await new Promise((r) => setTimeout(r, 2500));
    return gql(query, variables);
  }
  if (json.errors?.length) throw new Error(msg);
  return json.data;
}

const ghlH = {
  Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
  Version: "2021-07-28",
  Accept: "application/json",
};
const loc = "p7HYMD0h2RScLKL68uj0";
const PIPE = "UMelQ0AisTqWdPl1XHK6";
const JOBBER_CF = "saS3lqgdYaw8RPz95NZd";

async function listGhlContacts() {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= 30; page++) {
    const q = new URLSearchParams({ locationId: loc, limit: "100", page: String(page) });
    const res = await fetch(`https://services.leadconnectorhq.com/contacts/?${q}`, { headers: ghlH });
    if (!res.ok) throw new Error(`ghl contacts ${res.status} ${await res.text()}`);
    const json = await res.json();
    const contacts = json.contacts ?? [];
    for (const c of contacts) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      all.push(c);
    }
    const total = json.meta?.total;
    process.stderr.write(`ghl contacts ${all.length}/${total ?? "?"}\n`);
    if (contacts.length < 100) break;
    if (total && all.length >= total) break;
  }
  return all;
}

async function listJobberClients() {
  const all = [];
  let after = null;
  const query = `query C($after: String) {
    clients(first: 40, after: $after) {
      nodes {
        id name firstName lastName
        emails { address }
        phones { number }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }`;
  for (let i = 0; i < 200; i++) {
    const data = await gql(query, { after });
    const nodes = data.clients.nodes ?? [];
    all.push(...nodes);
    process.stderr.write(`jobber clients ${all.length}/${data.clients.totalCount}\n`);
    if (!data.clients.pageInfo.hasNextPage) {
      return { all, totalCount: data.clients.totalCount };
    }
    after = data.clients.pageInfo.endCursor;
    await new Promise((r) => setTimeout(r, 550));
  }
  return { all, totalCount: all.length };
}

const cachePath = new URL("./_jobber_clients_cache.json", import.meta.url);
const ghlRaw = await listGhlContacts();
const links = await sb("customer_links?select=*");
const jobLinks = await sb("job_links?select=*");
let jobberPack;
if (existsSync(cachePath)) {
  jobberPack = JSON.parse(readFileSync(cachePath, "utf8"));
  process.stderr.write(`jobber cache ${jobberPack.all.length}\n`);
} else {
  jobberPack = await listJobberClients();
  writeFileSync(cachePath, JSON.stringify(jobberPack));
}
const jobberClients = jobberPack.all;

function ghlEmails(c) {
  const out = [];
  const e = normEmail(c.email);
  if (e) out.push(e);
  for (const extra of c.additionalEmails ?? []) {
    const x = normEmail(extra.email ?? extra);
    if (x) out.push(x);
  }
  return [...new Set(out)];
}
function ghlPhones(c) {
  const out = [];
  const p = normPhone(c.phone);
  if (p) out.push(p);
  for (const extra of c.additionalPhones ?? []) {
    const x = normPhone(extra.phone ?? extra);
    if (x) out.push(x);
  }
  return [...new Set(out)];
}
function jobberEmails(c) {
  return [...new Set((c.emails ?? []).map((e) => normEmail(e.address)).filter(Boolean))];
}
function jobberPhones(c) {
  return [...new Set((c.phones ?? []).map((p) => normPhone(p.number)).filter(Boolean))];
}
function cfJobberId(c) {
  const fields = c.customFields ?? c.customField ?? [];
  if (!Array.isArray(fields)) return null;
  const hit = fields.find((f) => f.id === JOBBER_CF || f.fieldKeyId === JOBBER_CF);
  return hit?.value || hit?.field_value || null;
}

const emailToJobber = new Map();
const phoneToJobber = new Map();
for (const c of jobberClients) {
  for (const e of jobberEmails(c)) {
    if (!emailToJobber.has(e)) emailToJobber.set(e, []);
    emailToJobber.get(e).push(c);
  }
  for (const p of jobberPhones(c)) {
    if (!phoneToJobber.has(p)) phoneToJobber.set(p, []);
    phoneToJobber.get(p).push(c);
  }
}
const emailToGhl = new Map();
const phoneToGhl = new Map();
for (const c of ghlRaw) {
  for (const e of ghlEmails(c)) {
    if (!emailToGhl.has(e)) emailToGhl.set(e, []);
    emailToGhl.get(e).push(c);
  }
  for (const p of ghlPhones(c)) {
    if (!phoneToGhl.has(p)) phoneToGhl.set(p, []);
    phoneToGhl.get(p).push(c);
  }
}

const pairKey = (jid, gid) => `${jid}|${gid}`;
const exact = new Map();
const ambiguous = [];
const review = [];

function addExact(jb, ghl, via, evidence) {
  const k = pairKey(jb.id, ghl.id);
  const prev = exact.get(k);
  if (prev) {
    prev.via = [...new Set([...prev.via, via])];
    Object.assign(prev.evidence, evidence);
    return;
  }
  exact.set(k, {
    jobberClientId: jb.id,
    ghlContactId: ghl.id,
    jobberName: nameKey(jb),
    ghlName: `${ghl.firstName ?? ""} ${ghl.lastName ?? ""}`.trim().toLowerCase(),
    via: [via],
    evidence,
  });
}

function uniqId(arr) {
  const m = new Map();
  for (const x of arr) m.set(x.id, x);
  return [...m.values()];
}

for (const [e, jbs0] of emailToJobber) {
  const jbs = uniqId(jbs0);
  const ghls = uniqId(emailToGhl.get(e) ?? []);
  if (jbs.length === 1 && ghls.length === 1) {
    addExact(jbs[0], ghls[0], "email", { email: e });
  } else if (jbs.length + ghls.length > 2 && ghls.length && jbs.length) {
    ambiguous.push({
      kind: "email",
      key: e,
      jobberIds: jbs.map((c) => c.id),
      ghlIds: ghls.map((c) => c.id),
    });
  }
}

for (const [p, jbs0] of phoneToJobber) {
  const jbs = uniqId(jbs0);
  const ghls = uniqId(phoneToGhl.get(p) ?? []);
  if (jbs.length === 1 && ghls.length === 1) {
    addExact(jbs[0], ghls[0], "phone", { phone: last10(p) });
  } else if (jbs.length + ghls.length > 2 && ghls.length && jbs.length) {
    ambiguous.push({
      kind: "phone",
      key: last10(p),
      jobberIds: jbs.map((c) => c.id),
      ghlIds: ghls.map((c) => c.id),
    });
  }
}

const exactList = [...exact.values()].map((row) => {
  const nameAgree =
    row.jobberName &&
    row.ghlName &&
    (row.jobberName.includes(row.ghlName.split(" ")[0] || "___") ||
      row.ghlName.includes(row.jobberName.split(" ")[0] || "___"));
  return { ...row, nameAgree };
});

const emailAndPhone = exactList.filter((r) => r.via.includes("email") && r.via.includes("phone"));
const emailOnly = exactList.filter((r) => r.via.includes("email") && !r.via.includes("phone"));
const phoneOnly = exactList.filter((r) => r.via.includes("phone") && !r.via.includes("email"));

const liveJobberIds = new Set(jobberClients.map((c) => c.id));
const linkAudit = [];
for (const L of links) {
  const live = liveJobberIds.has(L.jobber_client_id);
  const ghl = ghlRaw.find((c) => c.id === L.ghl_contact_id);
  const jb = jobberClients.find((c) => c.id === L.jobber_client_id);
  let status = "ok";
  if (!live) status = "jobber_missing";
  else if (!ghl) status = "ghl_missing";
  else {
    const emailsJ = new Set(jobberEmails(jb));
    const emailsG = new Set(ghlEmails(ghl));
    const phonesJ = new Set(jobberPhones(jb));
    const phonesG = new Set(ghlPhones(ghl));
    const emailHit = [...emailsJ].some((e) => emailsG.has(e));
    const phoneHit = [...phonesJ].some((p) => phonesG.has(p));
    if (!emailHit && !phoneHit) status = "identity_mismatch";
  }
  if (L.verified && status !== "ok") status = `verified_but_${status}`;
  linkAudit.push({
    id: L.id,
    verified: L.verified,
    jobberClientId: L.jobber_client_id,
    ghlContactId: L.ghl_contact_id,
    match_method: L.match_method,
    status,
  });
}

const proposed = [];
const existingPair = new Set(links.map((L) => pairKey(L.jobber_client_id, L.ghl_contact_id)));
const usedJ = new Set(links.map((L) => L.jobber_client_id));
const usedG = new Set(links.map((L) => L.ghl_contact_id));

for (const row of emailAndPhone) {
  if (existingPair.has(pairKey(row.jobberClientId, row.ghlContactId))) continue;
  if (usedJ.has(row.jobberClientId) || usedG.has(row.ghlContactId)) {
    review.push({ reason: "exact_email_phone_but_already_linked_elsewhere", ...row });
    continue;
  }
  proposed.push({
    action: "insert_customer_link",
    verified: true,
    match_method: "email_and_phone_unique",
    jobber_client_id: row.jobberClientId,
    ghl_contact_id: row.ghlContactId,
    jobberName: row.jobberName,
    ghlName: row.ghlName,
    nameAgree: row.nameAgree,
  });
}

for (const row of emailOnly) {
  if (existingPair.has(pairKey(row.jobberClientId, row.ghlContactId))) continue;
  if (usedJ.has(row.jobberClientId) || usedG.has(row.ghlContactId)) {
    review.push({ reason: "email_only_already_linked_elsewhere", ...row });
    continue;
  }
  if (!row.nameAgree) {
    review.push({ reason: "email_only_name_not_aligned", ...row });
    continue;
  }
  proposed.push({
    action: "insert_customer_link",
    verified: true,
    match_method: "email_unique_name_aligned",
    jobber_client_id: row.jobberClientId,
    ghl_contact_id: row.ghlContactId,
    jobberName: row.jobberName,
    ghlName: row.ghlName,
    nameAgree: true,
  });
}

for (const row of phoneOnly) {
  review.push({ reason: "phone_only_needs_manual_review", ...row });
}

const staleVerified = linkAudit.filter((L) => L.verified && L.status !== "ok");
for (const L of staleVerified) {
  proposed.push({
    action: "set_verified_false",
    id: L.id,
    reason: L.status,
    jobber_client_id: L.jobberClientId,
    ghl_contact_id: L.ghlContactId,
  });
}

const pending = links.filter((L) => !L.verified && L.match_method === "pending_verification");
for (const L of pending) {
  const jb = jobberClients.find((c) => c.id === L.jobber_client_id);
  const ghl = ghlRaw.find((c) => c.id === L.ghl_contact_id);
  if (!jb || !ghl) {
    review.push({
      reason: "pending_link_missing_live_record",
      id: L.id,
      jobberClientId: L.jobber_client_id,
      ghlContactId: L.ghl_contact_id,
    });
    continue;
  }
  const emailsJ = new Set(jobberEmails(jb));
  const emailsG = new Set(ghlEmails(ghl));
  const phonesJ = new Set(jobberPhones(jb));
  const phonesG = new Set(ghlPhones(ghl));
  const emailHit = [...emailsJ].some((e) => emailsG.has(e));
  const phoneHit = [...phonesJ].some((p) => phonesG.has(p));
  const uniqueEmail =
    emailHit &&
    [...emailsJ].every((e) => (emailToJobber.get(e)?.length ?? 0) <= 1 && (emailToGhl.get(e)?.length ?? 0) <= 1);
  const uniquePhone =
    phoneHit &&
    [...phonesJ].every((p) => (phoneToJobber.get(p)?.length ?? 0) <= 1 && (phoneToGhl.get(p)?.length ?? 0) <= 1);
  if (emailHit && phoneHit && uniqueEmail && uniquePhone) {
    proposed.push({
      action: "set_verified_true",
      id: L.id,
      match_method: "email_and_phone_unique",
      jobber_client_id: L.jobber_client_id,
      ghl_contact_id: L.ghl_contact_id,
    });
  } else {
    review.push({
      reason: "pending_not_unique_enough",
      id: L.id,
      emailHit,
      phoneHit,
      uniqueEmail,
      uniquePhone,
      jobberClientId: L.jobber_client_id,
      ghlContactId: L.ghl_contact_id,
    });
  }
}

const jobCandidates = [];
const jobReview = [];
const uniqueProposedAndExisting = [
  ...links.filter((L) => L.verified).map((L) => ({ jobber: L.jobber_client_id, ghl: L.ghl_contact_id })),
  ...proposed
    .filter((p) => p.action === "insert_customer_link" || p.action === "set_verified_true")
    .map((p) => ({ jobber: p.jobber_client_id, ghl: p.ghl_contact_id })),
];

const SAMPLE = uniqueProposedAndExisting.slice(0, 80);
for (const pair of SAMPLE) {
  if (!liveJobberIds.has(pair.jobber)) continue;
  let jobs = [];
  try {
    const data = await gql(
      `query J($id: EncodedId!) {
        client(id: $id) {
          jobs(first: 15, sort: { key: UPDATED_AT, direction: DESCENDING }) {
            nodes { id jobNumber jobStatus }
          }
        }
      }`,
      { id: pair.jobber }
    );
    jobs = data.client?.jobs?.nodes ?? [];
  } catch (e) {
    try {
      const data = await gql(
        `query J($id: EncodedId!) {
          client(id: $id) { jobs(first: 15) { nodes { id jobNumber jobStatus } } }
        }`,
        { id: pair.jobber }
      );
      jobs = data.client?.jobs?.nodes ?? [];
    } catch (e2) {
      jobReview.push({ reason: "jobber_jobs_query_failed", pair, error: String(e2).slice(0, 120) });
      continue;
    }
  }
  const res = await fetch(
    `https://services.leadconnectorhq.com/opportunities/search?location_id=${loc}&contact_id=${pair.ghl}&pipeline_id=${PIPE}&limit=20`,
    { headers: ghlH }
  );
  const oj = res.ok ? await res.json() : { opportunities: [] };
  const opps = oj.opportunities ?? [];
  const existing = jobLinks.filter(
    (jl) => jl.jobber_job_id && jobs.some((j) => j.id === jl.jobber_job_id)
  );
  if (jobs.length === 1 && opps.length === 1) {
    const already = jobLinks.find(
      (jl) => jl.jobber_job_id === jobs[0].id || jl.ghl_opportunity_id === opps[0].id
    );
    jobCandidates.push({
      jobberJobId: jobs[0].id,
      jobNumber: jobs[0].jobNumber,
      jobStatus: jobs[0].jobStatus,
      ghlOpportunityId: opps[0].id,
      stage: opps[0].pipelineStageId,
      existingJobLink: already?.id ?? null,
      pair,
    });
  } else {
    await new Promise((r) => setTimeout(r, 350));
    jobReview.push({
      reason: "not_unique_job_or_opp",
      pair,
      jobs: jobs.map((j) => ({ id: j.id, n: j.jobNumber, s: j.jobStatus })),
      opps: opps.map((o) => ({ id: o.id, stage: o.pipelineStageId, name: o.name })),
      existingLinks: existing.map((e) => e.id),
    });
  }
}

const report = {
  scanned: {
    ghlContacts: ghlRaw.length,
    jobberClients: jobberClients.length,
    jobberTotalCount: jobberPack.totalCount,
  },
  customerExact: {
    emailAndPhone: emailAndPhone.length,
    emailOnly: emailOnly.length,
    phoneOnly: phoneOnly.length,
    totalUniquePairs: exactList.length,
  },
  ambiguous: {
    count: ambiguous.length,
    sample: ambiguous.slice(0, 15),
  },
  existingLinks: {
    total: links.length,
    verified: links.filter((L) => L.verified).length,
    unverified: links.filter((L) => !L.verified).length,
    audit: linkAudit,
  },
  jobLinks: {
    total: jobLinks.length,
    withOpp: jobLinks.filter((j) => j.ghl_opportunity_id).length,
  },
  proposedCustomerLinks: proposed,
  manualReview: review.slice(0, 40),
  manualReviewCount: review.length,
  jobCandidates: jobCandidates.slice(0, 25),
  jobCandidateCount: jobCandidates.length,
  jobReviewCount: jobReview.length,
  jobReviewSample: jobReview.slice(0, 15),
};

writeFileSync(
  new URL("../scripts/_match_report.json", import.meta.url),
  JSON.stringify(report, null, 2)
);
console.log(
  JSON.stringify(
    {
      scanned: report.scanned,
      customerExact: report.customerExact,
      ambiguousCount: ambiguous.length,
      existingLinks: report.existingLinks,
      jobLinks: report.jobLinks,
      proposedCount: proposed.length,
      proposed: proposed.slice(0, 20),
      manualReviewCount: review.length,
      jobCandidateCount: jobCandidates.length,
      jobReviewCount: jobReview.length,
      staleVerified,
    },
    null,
    2
  )
);
