import { getEnv } from "@/lib/config/env";
import { STM_GHL } from "@/lib/config/stm-mapping";

const STATIC_NAMES: Record<string, string> = {
  [STM_GHL.jobCompletedStageId]: "Job Completed",
  [STM_GHL.jobScheduledStageId]: "Job Scheduled",
};

let cachedAt = 0;
let cachedMap: Map<string, string> | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function getGhlPipelineStageMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedMap && now - cachedAt < CACHE_MS) return cachedMap;

  const map = new Map<string, string>(Object.entries(STATIC_NAMES));
  const env = getEnv();
  if (env.GHL_PRIVATE_INTEGRATION_TOKEN && env.GHL_LOCATION_ID) {
    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${encodeURIComponent(
          env.GHL_LOCATION_ID
        )}`,
        {
          headers: {
            Authorization: `Bearer ${env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
            Version: "2021-07-28",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          pipelines?: { stages?: { id: string; name: string }[] }[];
        };
        for (const pipe of json.pipelines ?? []) {
          for (const stage of pipe.stages ?? []) {
            if (stage.id && stage.name) map.set(stage.id, stage.name);
          }
        }
      }
    } catch {
      /* fall back to STM static ids */
    }
  }

  cachedMap = map;
  cachedAt = now;
  return map;
}

export function resolveGhlStageName(
  stageId: string | null | undefined,
  map: Map<string, string>
): string {
  if (!stageId) return "—";
  return map.get(stageId) ?? `Stage ${stageId.slice(0, 8)}…`;
}