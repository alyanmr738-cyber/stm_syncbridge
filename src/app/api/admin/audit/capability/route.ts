import { runCapabilityAudit } from "@/services/audit/capability-audit";

export async function GET() {
  const report = await runCapabilityAudit();
  return Response.json(report);
}
