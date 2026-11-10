import { getEnv } from "@/lib/config/env";
import { decryptJson, encryptJson } from "@/lib/crypto/token-encryption";
import { parseStoredBytea, toByteaHex } from "@/lib/crypto/bytea";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { JobberStoredCredentials } from "@/lib/db/sync-connections";

const JOBBER_TOKEN = "https://api.getjobber.com/api/oauth/token";

type ConnRow = {
  id: string;
  provider_account_id: string;
  provider_account_name: string | null;
  encrypted_credentials: unknown;
  token_expires_at: string | null;
  status: string;
};

async function loadJobberRow(): Promise<ConnRow> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("sync_connections")
    .select(
      "id, provider_account_id, provider_account_name, encrypted_credentials, token_expires_at, status"
    )
    .eq("provider", "jobber")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Jobber is not connected");
  return data as ConnRow;
}

function decodeCreds(row: ConnRow): JobberStoredCredentials {
  return decryptJson<JobberStoredCredentials>(parseStoredBytea(row.encrypted_credentials));
}

async function persistCreds(
  row: ConnRow,
  creds: JobberStoredCredentials
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("sync_connections")
    .update({
      encrypted_credentials: toByteaHex(encryptJson(creds as unknown as Record<string, unknown>)),
      token_expires_at: creds.expires_at,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
}

async function acquireLock(accountId: string, owner: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;
  const until = new Date(Date.now() + 20_000).toISOString();
  const { data: existing } = await supabase
    .from("token_refresh_locks")
    .select("locked_until, owner")
    .eq("provider", "jobber")
    .eq("provider_account_id", accountId)
    .maybeSingle();
  if (
    existing &&
    existing.locked_until &&
    new Date(existing.locked_until).getTime() > Date.now() &&
    existing.owner !== owner
  ) {
    return false;
  }
  const { error } = await supabase.from("token_refresh_locks").upsert({
    provider: "jobber",
    provider_account_id: accountId,
    locked_until: until,
    owner,
  });
  return !error;
}

async function releaseLock(accountId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("token_refresh_locks")
    .delete()
    .eq("provider", "jobber")
    .eq("provider_account_id", accountId);
}

async function exchangeRefresh(refreshToken: string): Promise<JobberStoredCredentials> {
  const env = getEnv();
  if (!env.JOBBER_CLIENT_ID || !env.JOBBER_CLIENT_SECRET) {
    throw new Error("Jobber app credentials missing");
  }
  const body = new URLSearchParams({
    client_id: env.JOBBER_CLIENT_ID,
    client_secret: env.JOBBER_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(JOBBER_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jobber refresh failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    token_type: json.token_type ?? "Bearer",
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

export async function getValidJobberAccessToken(): Promise<{
  accessToken: string;
  accountId: string;
  accountName: string | null;
}> {
  const row = await loadJobberRow();
  const creds = decodeCreds(row);
  const expires = creds.expires_at ? new Date(creds.expires_at).getTime() : 0;
  const skewMs = 120_000;
  if (expires - skewMs > Date.now()) {
    return {
      accessToken: creds.access_token,
      accountId: row.provider_account_id,
      accountName: row.provider_account_name,
    };
  }

  const owner = crypto.randomUUID();
  let locked = await acquireLock(row.provider_account_id, owner);
  if (!locked) {
    await new Promise((r) => setTimeout(r, 1500));
    const again = await loadJobberRow();
    const refreshed = decodeCreds(again);
    if (new Date(refreshed.expires_at).getTime() - skewMs > Date.now()) {
      return {
        accessToken: refreshed.access_token,
        accountId: again.provider_account_id,
        accountName: again.provider_account_name,
      };
    }
    locked = await acquireLock(row.provider_account_id, owner);
    if (!locked) {
      throw new Error("Could not acquire Jobber refresh lock");
    }
  }

  try {
    const latest = decodeCreds(await loadJobberRow());
    const next = await exchangeRefresh(latest.refresh_token);
    await persistCreds(row, next);
    return {
      accessToken: next.access_token,
      accountId: row.provider_account_id,
      accountName: row.provider_account_name,
    };
  } finally {
    await releaseLock(row.provider_account_id);
  }
}

export async function markJobberDisconnected(reason: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("sync_connections")
    .update({
      status: "reauthorization_required",
      last_verified_at: new Date().toISOString(),
      metadata: { reason },
    })
    .eq("provider", "jobber");
}
