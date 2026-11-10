import { getEnv } from "@/lib/config/env";
import { verifyJobberWebhook } from "@/lib/webhooks/verify";
import { persistAndEnqueue } from "@/services/events/inbox";

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-jobber-hmac-sha256");
  const secret = getEnv().JOBBER_CLIENT_SECRET;

  if (secret && !verifyJobberWebhook(raw, signature, secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = String(payload.topic ?? payload.event ?? "unknown");
  const entityId = String(payload.itemId ?? payload.id ?? "unknown");

  await persistAndEnqueue({
    source: "jobber",
    eventKind: topic,
    providerEventKey: `${topic}:${entityId}:${payload.occurredAt ?? Date.now()}`,
    providerEntityId: entityId,
    payload,
  });

  return Response.json({ received: true });
}
