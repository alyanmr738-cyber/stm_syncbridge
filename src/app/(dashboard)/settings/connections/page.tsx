import Link from "next/link";
import { AdminShell, Panel, SettingsSubnav } from "@/components/admin/shell";
import { getEnv } from "@/lib/config/env";
import { checkSupabaseConnection } from "@/lib/db/supabase-admin";
import { getJobberConnectionSummary } from "@/lib/db/sync-connections";
import { verifyGhlConnection } from "@/lib/ghl/connection";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = getEnv();
  const jobberConfigured = Boolean(
    env.JOBBER_CLIENT_ID &&
      env.JOBBER_CLIENT_SECRET &&
      env.JOBBER_OAUTH_CALLBACK_URL
  );
  const ghlConfigured = Boolean(env.GHL_PRIVATE_INTEGRATION_TOKEN && env.GHL_LOCATION_ID);
  const supabase = await checkSupabaseConnection();
  const ghl = await verifyGhlConnection();
  const jobber = await getJobberConnectionSummary();

  const jobberBanner = (() => {
    if (params.jobber === "connected") {
      return {
        tone: "ok" as const,
        text: `Jobber connected${params.account ? `: ${params.account}` : ""}.`,
      };
    }
    if (params.jobber === "error") {
      return {
        tone: "error" as const,
        text: `Jobber connection failed: ${params.reason ?? "unknown"}`,
      };
    }
    return null;
  })();

  return (
    <AdminShell
      title="Connections"
      subtitle="Jobber OAuth and GoHighLevel private integration — read-only until Phase 0 audit completes."
    >
      <SettingsSubnav />
      {jobberBanner ? (
        <p
          className={`mb-4 rounded-[10px] border p-3 text-sm ${
            jobberBanner.tone === "ok"
              ? "border-[#c8e6d4] bg-[#e9f5ef] text-[#267651]"
              : "border-[#f6e2b0] bg-[#fff8e9] text-[#685020]"
          }`}
        >
          {jobberBanner.text}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel heading="Supabase">
          <p className="text-sm">
            Database:{" "}
            <span
              className={
                supabase.ok
                  ? "font-semibold text-[#267651]"
                  : "font-semibold text-[#b45309]"
              }
            >
              {supabase.ok ? "connected · schema applied" : "not ready"}
            </span>
          </p>
          {!supabase.ok && supabase.error ? (
            <p className="mt-2 text-xs text-[#657683]">{supabase.error}</p>
          ) : null}
        </Panel>
        <Panel heading="Jobber">
          {jobber.connected ? (
            <>
              <p className="text-sm font-semibold text-[#267651]">OAuth connected</p>
              <ul className="mt-2 space-y-1 text-xs text-[#657683]">
                <li>{jobber.accountName}</li>
                <li>Account ID: {jobber.accountId}</li>
                {jobber.expiresAt ? (
                  <li>Token expires: {jobber.expiresAt}</li>
                ) : null}
              </ul>
              <Link
                href="/api/oauth/jobber/connect"
                className="mt-4 inline-block text-xs font-medium text-[#1d4654] underline"
              >
                Reconnect Jobber
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm">
                App credentials:{" "}
                {jobberConfigured ? (
                  <span className="text-[#267651]">ready in env</span>
                ) : (
                  <span className="text-[#b45309]">missing env vars</span>
                )}
              </p>
              <p className="mt-2 text-xs text-[#657683]">
                Septic Tank Man Jobber admin must approve access. No writes until
                gates are enabled.
              </p>
              {jobberConfigured ? (
                <Link
                  href="/api/oauth/jobber/connect"
                  className="mt-4 inline-block rounded-lg bg-[#1c4454] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163a47]"
                >
                  Connect Jobber
                </Link>
              ) : null}
            </>
          )}
        </Panel>
        <Panel heading="GoHighLevel">
          <p className="text-sm">
            Private integration:{" "}
            {ghl.ok ? (
              <span className="font-semibold text-[#267651]">connected</span>
            ) : ghlConfigured ? (
              <span className="font-semibold text-[#b45309]">configured · not verified</span>
            ) : (
              "missing env"
            )}
          </p>
          {ghl.ok ? (
            <ul className="mt-2 space-y-1 text-xs text-[#657683]">
              <li>
                <span className="text-[#192b36]">{ghl.name}</span>
              </li>
              <li>Location ID: {ghl.locationId}</li>
              <li>Timezone: {ghl.timezone ?? "—"}</li>
            </ul>
          ) : ghl.error ? (
            <p className="mt-2 text-xs text-[#657683]">{ghl.error}</p>
          ) : null}
        </Panel>
      </div>
    </AdminShell>
  );
}
