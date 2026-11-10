import { persistAndEnqueue } from "@/services/events/inbox";

export async function POST(request: Request) {
  const payload = (await request.json()) as Record<string, unknown>;
  const type = String(payload.type ?? payload.event ?? "unknown");
  const id = String(payload.id ?? payload.appointmentId ?? "unknown");

  await persistAndEnqueue({
    source: "ghl",
    eventKind: type,
    providerEventKey: `ghl:${type}:${id}`,
    providerEntityId: id,
    payload,
  });

  return Response.json({ received: true });
}
