import { getEnv } from "@/lib/config/env";
import { decryptJson, encryptJson } from "@/lib/crypto/token-encryption";
import { parseStoredBytea, toByteaHex } from "@/lib/crypto/bytea";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { JobberStoredCredentials } from "@/lib/db/sync-connections";
import {
  JobberAuthError,
  classifyJobberTokenHttp,
  fingerprintToken,
} from "@/lib/jobber/auth-error";
import { getValidAccessToken, type TokenRow } from "@/lib/jobber/refresh-coordinator";

const JOBBER_TOKEN = "https://api.getjobber.com/api/oauth/token";

type ConnRow = {
  id: string;
  provider_account_id: string;
  provider_account_name: string | null;
  encrypted_credentials: unknown;
  token_expires_at: string | null;
  status: string;
  credential_generation?: number | null;
  metadata?: Record<string, unknown> | null;
};

async function loadJobberRow(): Promise<ConnRow> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("sync_connections")
    .select(
      "id, provider_account_id, provider_account_name, encrypted_credentials, token_expires_at, status, metadata"
    )
    .eq("provider", "jobber")
    .in("status", ["connected", "reauthorization_required"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Jobber is not connected");
  return data as ConnRow;
}

function generationOf(row: ConnRow): number {
  const meta = (row.metadata ?? {}) as { credential_generation?: number };
  if (typeof row.credential_generation === "number") return row.credential_generation;
  if (typeof meta.credential_generation === "number") return meta.credential_generation;
  return 1;
}

function decodeCreds(row: ConnRow): JobberStoredCredentials {
  return decryptJson<JobberStoredCredentials>(parseStoredBytea(row.encrypted_credentials));
}

async function persistIfGeneration(
  row: ConnRow,
  expectedGeneration: number,
  creds: JobberStoredCredentials
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");
  const nextGen = expectedGeneration + 1;
  const metadata = {
    ...((row.metadata ?? {}) as Record<string, unknown>),
    credential_generation: nextGen,
    refresh_fp: fingerprintToken(creds.refresh_token),
    access_fp: fingerprintToken(creds.access_token),
    rotated_at: new Date().toISOString(),
  };
  let q = supabase
    .from("sync_connections")
    .update({
      encrypted_credentials: toByteaHex(encryptJson(creds as unknown as Record<string, unknown>)),
      token_expires_at: creds.expires_at,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "connected",
      metadata,
    })
    .eq("id", row.id)
    .eq("status", "connected");
  if (row.token_expires_at) {
    q = q.eq("token_expires_at", row.token_expires_at);
  }
  const { data, error } = await q.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function acquireLock(accountId: string, owner: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;
  const rpc = await supabase.rpc("try_acquire_token_refresh_lock", {
    p_provider: "jobber",
    p_account: accountId,
    p_owner: owner,
    p_ttl_seconds: 25,
  });
  if (!rpc.error && typeof rpc.data === "boolean") return rpc.data;
  const now = new Date().toISOString();
  const until = new Date(Date.now() + 25_000).toISOString();
  const { data: updated } = await supabase
    .from("token_refresh_locks")
    .update({ locked_until: until, owner })
    .eq("provider", "jobber")
    .eq("provider_account_id", accountId)
    .or(`locked_until.lt.${now},owner.eq.${owner}`)
    .select("owner")
    .maybeSingle();
  if (updated?.owner === owner) return true;
  const { error } = await supabase.from("token_refresh_locks").insert({
    provider: "jobber",
    provider_account_id: accountId,
    locked_until: until,
    owner,
  });
  if (!error) return true;
  return false;
}

async function releaseLock(accountId: string, owner: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("token_refresh_locks")
    .update({ locked_until: new Date(0).toISOString() })
    .eq("provider", "jobber")
    .eq("provider_account_id", accountId)
    .eq("owner", owner);
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
  let res: Response;
  try {
    res = await fetch(JOBBER_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    throw new JobberAuthError(
      "transient",
      `Jobber refresh network error: ${e instanceof Error ? e.message : "fetch_failed"}`
    );
  }
  const text = await res.text();
  if (!res.ok) {
    const kind = classifyJobberTokenHttp(res.status, text);
    throw new JobberAuthError(
      kind,
      `Jobber refresh failed (${res.status}): ${text.slice(0, 160)}`
    );
  }
  let json: {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in: number;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new JobberAuthError("transient", `Jobber refresh non-json (${res.status})`);
  }
  if (!json.access_token) {
    throw new JobberAuthError("transient", "Jobber refresh missing access_token");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    token_type: json.token_type ?? "Bearer",
    expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

function toTokenRow(row: ConnRow): TokenRow {
  return {
    generation: generationOf(row),
    credentials: decodeCreds(row),
    accountId: row.provider_account_id,
    accountName: row.provider_account_name,
  };
}

export async function getValidJobberAccessToken(): Promise<{
  accessToken: string;
  accountId: string;
  accountName: string | null;
}> {
  const initial = await loadJobberRow();
  if (initial.status === "reauthorization_required") {
    throw new JobberAuthError("revoked", "Jobber reauthorization required");
  }
  const accountId = initial.provider_account_id;
  return getValidAccessToken({
    load: async () => toTokenRow(await loadJobberRow()),
    acquireLock: (owner) => acquireLock(accountId, owner),
    releaseLock: (owner) => releaseLock(accountId, owner),
    exchangeRefresh,
    persistIfGeneration: async (expected, next) => {
      const row = await loadJobberRow();
      if (generationOf(row) !== expected) return false;
      return persistIfGeneration(row, expected, next);
    },
    markRevoked: (reason) => markJobberDisconnected(reason),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  });
}

export async function markJobberDisconnected(reason: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("sync_connections")
    .update({
      status: "reauthorization_required",
      last_verified_at: new Date().toISOString(),
      metadata: { reason: reason.slice(0, 180), auth: "revoked" },
    })
    .eq("provider", "jobber")
    .eq("status", "connected");
}

export async function clearJobberAuthBackoffs(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("queue_jobs")
    .update({
      status: "pending",
      lease_owner: null,
      leased_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("lease_owner", "auth_backoff");
}

export { JobberAuthError };
