import { getEnv } from "@/lib/config/env";
import { verifyGhlConnection } from "@/lib/ghl/connection";
import { ghlMockCapabilities, ghlMockGet } from "@/mocks/ghl";

export type GhlCapabilityProbe = {
  operation: string;
  verified: boolean;
  evidence: string;
  fallback: string;
};

export class GhlReadOnlyClient {
  constructor(
    private readonly token: string | undefined,
    private readonly locationId: string | undefined,
    private readonly useMock: boolean
  ) {}

  static fromEnv(): GhlReadOnlyClient {
    const env = getEnv();
    const useMock =
      env.USE_PROVIDER_MOCKS === true ||
      !env.GHL_PRIVATE_INTEGRATION_TOKEN ||
      !env.GHL_LOCATION_ID;
    return new GhlReadOnlyClient(
      env.GHL_PRIVATE_INTEGRATION_TOKEN,
      env.GHL_LOCATION_ID,
      useMock
    );
  }

  async probeCapabilities(): Promise<GhlCapabilityProbe[]> {
    if (this.useMock) return ghlMockCapabilities();
    return ghlMockCapabilities().map((row) => ({
      ...row,
      evidence: "PIT configured but live probe not run in this build; use audit API.",
    }));
  }

  async getLocationProfile(): Promise<{ timezone: string | null; locationId: string | null }> {
    if (this.useMock) {
      const data = await ghlMockGet<{ timezone: string }>("/locations/timezone");
      return { timezone: data.timezone, locationId: this.locationId ?? "mock-location" };
    }
    const status = await verifyGhlConnection();
    if (!status.ok) {
      return { timezone: null, locationId: this.locationId ?? null };
    }
    return {
      timezone: status.timezone ?? null,
      locationId: status.locationId ?? this.locationId ?? null,
    };
  }

  async apiGet<T>(path: string, version = "2021-07-28"): Promise<T> {
    if (this.useMock) return ghlMockGet<T>(path);
    if (!this.token) throw new Error("GHL token not configured");
    const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Version: version,
      },
    });
    if (!res.ok) throw new Error(`GHL API ${res.status}`);
    return res.json() as Promise<T>;
  }
}
