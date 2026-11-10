import { getEnv } from "@/lib/config/env";
import { verifyGhlSignature } from "@/lib/webhooks/ghl-verify";
import { persistAndEnqueue } from "@/services/events/inbox";

export async function POST(request: Request) {
  const env = getEnv();
  const raw = Buffer.from(await request.arrayBuffer());
  const requireSig = env.APP_ENV === "production";
  const ok = verifyGhlSignature({
    rawBody: raw,
    signatureHeader:
      request.headers.get("x-ghl-signature") ??
      request.headers.get("x-wh-signature"),
    timestampHeader: request.headers.get("x-ghl-timestamp"),
    publicKeyPem: process.env.GHL_WEBHOOK_PUBLIC_KEY,
    require: requireSig && Boolean(process.env.GHL_WEBHOOK_PUBLIC_KEY),
  });
  if (!ok) {
    return Response.json({ error: "Invalid GHL signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const location = String(payload.locationId ?? "");
  const allowed = env.GHL_LOCATION_ID;
  if (allowed && location && location !== allowed) {
    return Response.json({ error: "Unexpected location" }, { status: 403 });
  }

  const type = String(payload.type ?? payload.event ?? "unknown");
  const id = String(payload.id ?? payload.appointmentId ?? payload.contactId ?? "unknown");

  try {
    await persistAndEnqueue({
      source: "ghl",
      eventKind: type,
      providerEventKey: `ghl:${type}:${id}`,
      providerEntityId: id,
      payload,
    });
  } catch {
    return Response.json({ error: "Not durable" }, { status: 503 });
  }

  return Response.json({ received: true });
}
