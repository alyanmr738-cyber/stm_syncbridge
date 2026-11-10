import { getEventQueue } from "@/lib/queue";
import { verifyInternalAction } from "@/lib/webhooks/verify";
import { processSyncEvent } from "@/services/events/processor";

async function authorized(request: Request, raw: string): Promise<boolean> {
  const cron = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cron === `Bearer ${cronSecret}`) return true;
  const signature = request.headers.get("x-syncbridge-signature");
  const secret = process.env.INTERNAL_ACTION_SIGNING_SECRET;
  if (secret && verifyInternalAction(raw, signature, secret)) return true;
  if (!cronSecret && !secret && process.env.NODE_ENV !== "production") return true;
  return false;
}

async function run() {
  const queue = getEventQueue();
  let processed = 0;
  while (await queue.processNext(processSyncEvent)) {
    processed += 1;
    if (processed >= 25) break;
  }
  const stats = await queue.stats();
  return { processed, stats };
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await authorized(request, raw))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await run());
}

export async function GET(request: Request) {
  if (!(await authorized(request, ""))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await run());
}
