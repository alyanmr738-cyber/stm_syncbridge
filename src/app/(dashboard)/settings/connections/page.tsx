import { AdminShell, Panel, SettingsSubnav } from "@/components/admin/shell";
import { getEnv } from "@/lib/config/env";
import { checkSupabaseConnection } from "@/lib/db/supabase-admin";
import { verifyGhlConnection } from "@/lib/ghl/connection";

export default async function ConnectionsPage() {
  const env = getEnv();
  const jobberConfigured = Boolean(env.JOBBER_CLIENT_ID && env.JOBBER_CLIENT_SECRET);
  const ghlConfigured = Boolean(env.GHL_PRIVATE_INTEGRATION_TOKEN && env.GHL_LOCATION_ID);
  const supabase = await checkSupabaseConnection();
  const ghl = await verifyGhlConnection();

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
          ) : (
            <p className="mt-2 text-sm text-[#657683]">
              Set GHL_PRIVATE_INTEGRATION_TOKEN and GHL_LOCATION_ID in Vercel /
              .env.local (Septic Tank Man sub-account only).
            </p>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
