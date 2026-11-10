import { authorizeWorker } from "@/lib/auth/worker-auth";
import { drainQueue } from "@/lib/queue/drain";
import { getEventQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run() {
  const { processed } = await drainQueue(25);
  const stats = await getEventQueue().stats();
  return { processed, stats, scheduler: "webhook-drain+minute-cron" };
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
