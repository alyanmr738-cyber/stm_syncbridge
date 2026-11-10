import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config/env";

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getEnv().SUPABASE_URL;
  const key = getEnv().SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export async function checkSupabaseConnection(): Promise<{
  ok: boolean;
  error?: string;
  tableCount?: number;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, error: "SUPABASE_URL or SUPABASE_SECRET_KEY not set" };
  }
  const { error } = await client.from("sync_connections").select("id").limit(1);
  if (error) {
    if (error.code === "PGRST205" || error.message.includes("does not exist")) {
      return { ok: false, error: "Connected but schema not applied (run migration)" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, tableCount: 1 };
}
