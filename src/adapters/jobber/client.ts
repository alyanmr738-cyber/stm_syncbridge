import { getEnv } from "@/lib/config/env";
import { jobberMockCapabilities, jobberMockQuery } from "@/mocks/jobber";

export type JobberCapabilityProbe = {
  operation: string;
  verified: boolean;
  evidence: string;
  fallback: string;
};

export type JobberClientConfig = {
  accessToken?: string;
  graphqlVersion?: string;
  useMock: boolean;
};

export class JobberReadOnlyClient {
  constructor(private readonly config: JobberClientConfig) {}

  static fromEnv(): JobberReadOnlyClient {
    const env = getEnv();
    const useMock =
      env.USE_PROVIDER_MOCKS === true ||
      !env.JOBBER_CLIENT_ID ||
      !env.JOBBER_CLIENT_SECRET;
    return new JobberReadOnlyClient({
      graphqlVersion: env.JOBBER_GRAPHQL_VERSION,
      useMock,
    });
  }

  async probeCapabilities(): Promise<JobberCapabilityProbe[]> {
    if (this.config.useMock) {
      return jobberMockCapabilities();
    }
    // Live probe requires OAuth token in DB — Phase 0 documents required steps.
    return jobberMockCapabilities().map((row) => ({
      ...row,
      evidence:
        "OAuth token not loaded in this runtime; connect Jobber in admin UI and re-run audit.",
    }));
  }

  async getAccountTimezone(): Promise<{ timezone: string | null; source: string }> {
    if (this.config.useMock) {
      const account = await jobberMockQuery<{ account: { timezone: string } }>(
        "GetAccountTimezone"
      );
      return { timezone: account.account.timezone, source: "mock" };
    }
    return { timezone: null, source: "unconfigured" };
  }

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (this.config.useMock) {
      return jobberMockQuery<T>(query);
    }
    const version = this.config.graphqlVersion;
    if (!this.config.accessToken || !version) {
      throw new Error("Jobber live client requires access token and GRAPHQL_VERSION");
    }
    const res = await fetch("https://api.getjobber.com/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        "X-JOBBER-GRAPHQL-VERSION": version,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: unknown[] };
    if (json.errors?.length) {
      throw new Error("Jobber GraphQL returned errors");
    }
    return json.data as T;
  }
}
