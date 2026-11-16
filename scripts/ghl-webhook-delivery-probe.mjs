/**
 * Production-safe GHL workflow webhook probes. Requires env GHL_WEBHOOK_SECRET (never log).
 * Uses fictitious contact id; must not mutate verified customers if contact is absent in GHL.
 */
const BASE = process.env.APP_BASE_URL ?? "https://stmsyncbridge.vercel.app";
const LOC = process.env.GHL_LOCATION_ID ?? "p7HYMD0h2RScLKL68uj0";
const SECRET = process.env.GHL_WEBHOOK_SECRET;
const PROBE_CONTACT = "syncbridge-delivery-probe-not-a-customer";

if (!SECRET) {
  console.error("Set GHL_WEBHOOK_SECRET in env (from Vercel Production).");
  process.exit(2);
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const key = `delivery-probe-${Date.now()}`;
const goodBody = {
  type: "ContactUpdate",
  locationId: LOC,
  contactId: PROBE_CONTACT,
  syncEventKey: key,
};

const results = [];

results.push({
  case: "unsigned",
  ...(await post("/api/webhooks/ghl", goodBody)),
});

results.push({
  case: "wrong_secret",
  ...(await post("/api/webhooks/ghl", goodBody, { "X-GHL-Webhook-Secret": "wrong-secret" })),
});

results.push({
  case: "wrong_location",
  ...(await post(
    "/api/webhooks/ghl",
    { ...goodBody, locationId: "wrong-location-id" },
    { "X-GHL-Webhook-Secret": SECRET }
  )),
});

results.push({
  case: "missing_contact",
  ...(await post(
    "/api/webhooks/ghl",
    { type: "ContactUpdate", locationId: LOC },
    { "X-GHL-Webhook-Secret": SECRET }
  )),
});

results.push({
  case: "authenticated_accept",
  ...(await post("/api/webhooks/ghl", goodBody, { "X-GHL-Webhook-Secret": SECRET })),
});

results.push({
  case: "duplicate_same_key",
  ...(await post("/api/webhooks/ghl", goodBody, { "X-GHL-Webhook-Secret": SECRET })),
});

console.log(JSON.stringify({ base: BASE, syncEventKey: key, results }, null, 2));