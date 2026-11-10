import { AdminShell, Panel, SettingsSubnav } from "@/components/admin/shell";
import { getEnv } from "@/lib/config/env";
import { checkSupabaseConnection } from "@/lib/db/supabase-admin";

export default async function ConnectionsPage() {
  const env = getEnv();
  const jobberConfigured = Boolean(env.JOBBER_CLIENT_ID && env.JOBBER_CLIENT_SECRET);
  const ghlConfigured = Boolean(env.GHL_PRIVATE_INTEGRATION_TOKEN && env.GHL_LOCATION_ID);
  const supabase = await checkSupabaseConnection();

  return (
    <AdminShell title="Connections" subtitle="Jobber OAuth and GoHighLevel private integration — read-only until Phase 0 audit completes.">
      <SettingsSubnav />
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
          <p className="mt-2 text-sm text-[#657683]">
            Project URL configured in{" "}
            <code className="text-xs">.env.local</code>. Migrations live in{" "}
            <code className="text-xs">supabase/migrations/</code>.
          </p>
        </Panel>
        <Panel heading="Jobber">
          <p className="text-sm">
            App credentials: {jobberConfigured ? "configured" : "missing"}
          </p>
          <p className="mt-2 text-sm text-[#657683]">
            OAuth connect and token storage activate in Phase 1 after callback
            verification. Live authorization must be performed by a Septic Tank
            Man Jobber admin.
          </p>
        </Panel>
        <Panel heading="GoHighLevel">
          <p className="text-sm">
            Private integration: {ghlConfigured ? "configured" : "missing"}
          </p>
          <p className="mt-2 text-sm text-[#657683]">
            Use Septic Tank Man sub-account only. Pipeline and stage IDs are
            discovered read-only into docs/ACCOUNT_MAPPING.md.
          </p>
        </Panel>
      </div>
    </AdminShell>
  );
}
