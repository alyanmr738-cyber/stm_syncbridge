import { getEnv } from "@/lib/config/env";
import { verifyGhlConnection } from "@/lib/ghl/connection";
import {
  jobberGraphql,
  jobberMutationNames,
  jobberQueryNames,
} from "@/lib/jobber/graphql";
import { getJobberConnectionSummary } from "@/lib/db/sync-connections";

export type LiveDiscovery = {
  generatedAt: string;
  jobber: {
    connected: boolean;
    accountName?: string;
    accountId?: string;
    timezone?: string | null;
    queryHits: string[];
    mutationHits: string[];
    availabilityLikely: boolean;
    error?: string;
  };
  ghl: {
    connected: boolean;
    locationId?: string;
    name?: string;
    timezone?: string | null;
    pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
    calendars: { id: string; name: string }[];
    error?: string;
  };
};

function pickNames(all: string[], needles: string[]): string[] {
  const lower = needles.map((n) => n.toLowerCase());
  return all.filter((n) => lower.some((k) => n.toLowerCase().includes(k)));
}

export async function runLiveDiscovery(): Promise<LiveDiscovery> {
  const generatedAt = new Date().toISOString();
  const jobberSummary = await getJobberConnectionSummary();
  const ghl = await verifyGhlConnection();
  const env = getEnv();

  const result: LiveDiscovery = {
    generatedAt,
    jobber: {
      connected: jobberSummary.connected,
      accountName: jobberSummary.accountName,
      accountId: jobberSummary.accountId,
      timezone: null,
      queryHits: [],
      mutationHits: [],
      availabilityLikely: false,
    },
    ghl: {
      connected: ghl.ok,
      locationId: ghl.locationId,
      name: ghl.name,
      timezone: ghl.timezone ?? null,
      pipelines: [],
      calendars: [],
      error: ghl.ok ? undefined : ghl.error,
    },
  };

  if (jobberSummary.connected && env.JOBBER_GRAPHQL_VERSION) {
    try {
      const account = await jobberGraphql<{
        account: { id: string; name: string; timezone?: string };
      }>(`query { account { id name } }`);
      result.jobber.accountId = account.account.id;
      result.jobber.accountName = account.account.name;
      const queries = await jobberQueryNames();
      const mutations = await jobberMutationNames();
      result.jobber.queryHits = pickNames(queries, [
        "client",
        "job",
        "visit",
        "quote",
        "invoice",
        "property",
        "product",
        "service",
        "avail",
        "schedul",
        "note",
      ]);
      result.jobber.mutationHits = pickNames(mutations, [
        "client",
        "job",
        "visit",
        "quote",
        "invoice",
        "property",
        "note",
        "avail",
        "schedul",
      ]);
      result.jobber.availabilityLikely = [...queries, ...mutations].some((n) =>
        /avail|reserv|timeslot|openslot/i.test(n)
      );
    } catch (e) {
      result.jobber.error = e instanceof Error ? e.message : "jobber_discovery_failed";
    }
  }

  if (ghl.ok && env.GHL_PRIVATE_INTEGRATION_TOKEN && env.GHL_LOCATION_ID) {
    const headers = {
      Authorization: `Bearer ${env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
      Version: "2021-07-28",
      Accept: "application/json",
    };
    try {
      const pipes = await fetch(
        `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${env.GHL_LOCATION_ID}`,
        { headers }
      );
      if (pipes.ok) {
        const json = (await pipes.json()) as {
          pipelines?: {
            id: string;
            name: string;
            stages?: { id: string; name: string }[];
          }[];
        };
        result.ghl.pipelines = (json.pipelines ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          stages: (p.stages ?? []).map((s) => ({ id: s.id, name: s.name })),
        }));
      }
      const cals = await fetch(
        `https://services.leadconnectorhq.com/calendars/?locationId=${env.GHL_LOCATION_ID}`,
        { headers }
      );
      if (cals.ok) {
        const json = (await cals.json()) as {
          calendars?: { id: string; name: string }[];
        };
        result.ghl.calendars = (json.calendars ?? []).map((c) => ({
          id: c.id,
          name: c.name,
        }));
      }
    } catch (e) {
      result.ghl.error = e instanceof Error ? e.message : "ghl_discovery_failed";
    }
  }

  return result;
}
