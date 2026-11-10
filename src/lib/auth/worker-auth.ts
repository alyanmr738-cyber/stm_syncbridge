import { verifyInternalAction } from "@/lib/webhooks/verify";

/** Vercel Cron GET sends Authorization: Bearer $CRON_SECRET. */
export function authorizeWorker(request: Request, raw: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true;
  }
  const hmacSecret = process.env.INTERNAL_ACTION_SIGNING_SECRET;
  const signature = request.headers.get("x-syncbridge-signature");
  if (hmacSecret && verifyInternalAction(raw, signature, hmacSecret)) {
    return true;
  }
  return false;
}
