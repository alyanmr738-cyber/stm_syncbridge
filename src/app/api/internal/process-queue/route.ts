import { getEventQueue } from "@/lib/queue";
import { verifyInternalAction } from "@/lib/webhooks/verify";
import { processSyncEvent } from "@/services/events/processor";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-syncbridge-signature");
  const secret = process.env.INTERNAL_ACTION_SIGNING_SECRET;
  if (secret && !verifyInternalAction(raw, signature, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = getEventQueue();
  let processed = 0;
  while (await queue.processNext(processSyncEvent)) {
    processed += 1;
    if (processed >= 25) break;
  }
  const stats = await queue.stats();
  return Response.json({ processed, stats });
}
