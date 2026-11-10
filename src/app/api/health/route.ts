import { featureFlagsSnapshot } from "@/lib/config/feature-flags";

export async function GET() {
  return Response.json({
    ok: true,
    service: "syncbridge",
    flags: featureFlagsSnapshot(),
  });
}
