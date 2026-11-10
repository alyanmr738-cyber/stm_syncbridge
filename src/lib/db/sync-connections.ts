import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { encryptJson } from "@/lib/crypto/token-encryption";

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
