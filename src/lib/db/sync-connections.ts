import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { encryptJson } from "@/lib/crypto/token-encryption";
import { fingerprintToken } from "@/lib/jobber/auth-error";

export type JobberStoredCredentials = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
};

export async function upsertJobberConnection(input: {
  accountId: string;
  accountName: string;
  credentials: JobberStoredCredentials;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  const { data: existing } = await supabase
    .from("sync_connections")
    .select("id, token_expires_at, status, metadata")
    .eq("provider", "jobber")
    .eq("provider_account_id", input.accountId)
    .maybeSingle();
  const existingExp = existing?.token_expires_at
    ? new Date(existing.token_expires_at).getTime()
    : 0;
  const incomingExp = new Date(input.credentials.expires_at).getTime();
  if (
    existing?.status === "connected" &&
    existingExp > Date.now() + 120_000 &&
    incomingExp + 30_000 < existingExp
  ) {
    throw new Error("Refusing stale Jobber reconnect over a newer token generation");
  }
  const prevGen =
    typeof (existing?.metadata as { credential_generation?: number } | null)?.credential_generation ===
    "number"
      ? (existing?.metadata as { credential_generation: number }).credential_generation
      : 1;
  const encrypted = encryptJson(input.credentials as unknown as Record<string, unknown>);
  const expiresAt = input.credentials.expires_at;
  const byteaHex = `\\x${encrypted.toString("hex")}`;
  const { error } = await supabase.from("sync_connections").upsert(
    {
      provider: "jobber",
      provider_account_id: input.accountId,
      provider_account_name: input.accountName,
      status: "connected",
      encrypted_credentials: byteaHex,
      token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        credential_generation: prevGen + 1,
        refresh_fp: fingerprintToken(input.credentials.refresh_token),
        access_fp: fingerprintToken(input.credentials.access_token),
        source: "oauth_reconnect",
      },
    },
    { onConflict: "provider,provider_account_id" }
  );
  if (error) {
    throw new Error(error.message);
  }
}

export async function getJobberConnectionSummary(): Promise<{
  connected: boolean;
  accountId?: string;
  accountName?: string;
  status?: string;
  expiresAt?: string;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { connected: false };
  const { data, error } = await supabase
    .from("sync_connections")
    .select("provider_account_id, provider_account_name, status, token_expires_at")
    .eq("provider", "jobber")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { connected: false };
  return {
    connected: data.status === "connected",
    accountId: data.provider_account_id,
    accountName: data.provider_account_name ?? undefined,
    status: data.status,
    expiresAt: data.token_expires_at ?? undefined,
  };
}
