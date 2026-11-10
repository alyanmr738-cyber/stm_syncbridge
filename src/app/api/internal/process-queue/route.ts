import { authorizeWorker } from "@/lib/auth/worker-auth";
import { getEventQueue } from "@/lib/queue";
import { processSyncEvent } from "@/services/events/processor";

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
  if (!authorizeWorker(request, raw)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await run());
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: "CRON_SECRET is required for GET worker" },
      { status: 503 }
    );
  }
  if (!authorizeWorker(request, "")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await run());
}
