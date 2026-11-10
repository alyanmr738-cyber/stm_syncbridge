import { getEnv, parseIdAllowlist } from "@/lib/config/env";

export type GhlConnectionStatus = {
  ok: boolean;
  locationId?: string;
  name?: string;
  timezone?: string;
  error?: string;
};

export async function verifyGhlConnection(): Promise<GhlConnectionStatus> {
  const env = getEnv();
  const token = env.GHL_PRIVATE_INTEGRATION_TOKEN;
  const locationId = env.GHL_LOCATION_ID;

  if (!token || !locationId) {
    return { ok: false, error: "GHL_PRIVATE_INTEGRATION_TOKEN or GHL_LOCATION_ID missing" };
  }

  const allowed = parseIdAllowlist(env.GHL_ALLOWED_LOCATION_IDS);
  if (allowed.length > 0 && !allowed.includes(locationId)) {
    return { ok: false, error: "GHL_LOCATION_ID not in GHL_ALLOWED_LOCATION_IDS" };
  }

  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/locations/${locationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `GHL API ${res.status}: ${body.slice(0, 120)}`,
      };
    }

    const json = (await res.json()) as {
      location?: { id?: string; name?: string; timezone?: string };
    };
    const loc = json.location;
    if (!loc?.id) {
      return { ok: false, error: "Unexpected GHL response (no location)" };
    }
    if (loc.id !== locationId) {
      return { ok: false, error: "GHL location id mismatch" };
    }

    return {
      ok: true,
      locationId: loc.id,
      name: loc.name,
      timezone: loc.timezone,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "GHL request failed",
    };
  }
}
