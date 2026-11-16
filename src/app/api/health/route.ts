import { featureFlagsSnapshot } from "@/lib/config/feature-flags";
import { getJobberConnectionSummary } from "@/lib/db/sync-connections";
import { JOBBER_SUPPORTED_API_VERSION } from "@/lib/jobber/version";
import {
  oauthRecoveryQuarantineActive,
  oauthRecoveryQuarantineSince,
  oauthRecoveryQuarantineUntil,
} from "@/lib/jobber/recovery-quarantine";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export async function GET() {
  const jobber = await getJobberConnectionSummary();
  const supabase = getSupabaseAdmin();
  let tokenRefreshLockRpc: boolean | null = null;
  if (supabase) {
    const rpc = await supabase.rpc("try_acquire_token_refresh_lock", {
      p_provider: "jobber",
      p_account: jobber.accountId ?? "__health_probe__",
      p_owner: "health_probe",
      p_ttl_seconds: 1,
    });
    tokenRefreshLockRpc = rpc.error ? false : rpc.data === true || rpc.data === false;
    if (jobber.accountId) {
      await supabase
        .from("token_refresh_locks")
        .delete()
        .eq("provider", "jobber")
        .eq("provider_account_id", jobber.accountId)
        .eq("owner", "health_probe");
    }
  }
  return Response.json({
    ok: true,
    service: "syncbridge",
    jobberApiVersion: JOBBER_SUPPORTED_API_VERSION,
    queueScheduler: "webhook-drain+minute-cron",
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    oauthRecovery: {
      quarantineActive: oauthRecoveryQuarantineActive(),
      quarantineSince: oauthRecoveryQuarantineSince(),
      quarantineUntil: oauthRecoveryQuarantineUntil(),
      autoReleaseAuthBackoff: process.env.JOBBER_AUTO_RELEASE_AUTH_BACKOFF === "true",
    },
    jobberConnection: jobber,
    tokenRefreshLockRpc,
    flags: featureFlagsSnapshot(),
  });
}
