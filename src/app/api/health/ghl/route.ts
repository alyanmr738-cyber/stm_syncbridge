import { verifyGhlConnection } from "@/lib/ghl/connection";

export async function GET() {
  const result = await verifyGhlConnection();
  return Response.json(result, { status: result.ok ? 200 : 503 });
}
