import { checkSupabaseConnection } from "@/lib/db/supabase-admin";

export async function GET() {
  const result = await checkSupabaseConnection();
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
