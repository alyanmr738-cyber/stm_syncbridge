import { getEnv } from "@/lib/config/env";
import { verifyJobberWebhook } from "@/lib/webhooks/verify";
import { persistAndEnqueue } from "@/services/events/inbox";

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-jobber-hmac-sha256");
  const secret = getEnv().JOBBER_CLIENT_SECRET;

  if (!secret) {
    return Response.json({ error: "Webhook secret not configured" }, { status: 503 });
  }
  if (!verifyJobberWebhook(raw, signature, secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = String(payload.topic ?? payload.event ?? "unknown");
  const entityId = String(
    payload.itemId ?? payload.id ?? payload.data ?? "unknown"
  );

  try {
    await persistAndEnqueue({
      source: "jobber",
      eventKind: topic,
      providerEventKey: `${topic}:${entityId}:${String(payload.occurredAt ?? payload.time ?? "")}`,
      providerEntityId: entityId,
      payload,
    });
  } catch {
    return Response.json({ error: "Not durable" }, { status: 503 });
  }

  return Response.json({ received: true });
}
