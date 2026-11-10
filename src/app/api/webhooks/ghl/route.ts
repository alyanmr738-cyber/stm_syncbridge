import { after } from "next/server";
import { getEnv } from "@/lib/config/env";
import { authorizeGhlRequest } from "@/lib/webhooks/ghl-verify";
import { persistAndEnqueue } from "@/services/events/inbox";
import { drainQueue } from "@/lib/queue/drain";

export async function POST(request: Request) {
  const env = getEnv();
  const raw = Buffer.from(await request.arrayBuffer());
  const authz = authorizeGhlRequest({
    rawBody: raw,
    ghlSignature: request.headers.get("x-ghl-signature"),
    whSignature: request.headers.get("x-wh-signature"),
    workflowSecret: env.GHL_WEBHOOK_SECRET,
    presentedSecret:
      request.headers.get("x-ghl-webhook-secret") ??
      request.headers.get("x-webhook-secret"),
    authorization: request.headers.get("authorization"),
  });
  if (!authz.ok) {
    return Response.json({ error: "Unauthorized GHL webhook" }, { status: 401 });
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

  after(async () => {
    await drainQueue(10);
  });

  return Response.json({ received: true, auth: authz.mode });
}
