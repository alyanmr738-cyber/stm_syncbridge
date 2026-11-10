import { featureFlagsSnapshot } from "@/lib/config/feature-flags";
import { JOBBER_SUPPORTED_API_VERSION } from "@/lib/jobber/version";

export async function GET() {
  return Response.json({
    ok: true,
    service: "syncbridge",
    jobberApiVersion: JOBBER_SUPPORTED_API_VERSION,
    queueScheduler: "webhook-drain+minute-cron",
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    flags: featureFlagsSnapshot(),
  });
}
