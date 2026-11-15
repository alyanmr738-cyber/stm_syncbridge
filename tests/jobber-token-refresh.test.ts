import { describe, expect, it, vi } from "vitest";
import {
  JobberAuthError,
  classifyJobberTokenHttp,
} from "@/lib/jobber/auth-error";
import { getValidAccessToken, type RefreshDeps, type TokenRow } from "@/lib/jobber/refresh-coordinator";
import type { JobberStoredCredentials } from "@/lib/db/sync-connections";

function creds(n: number, expOffsetMs: number): JobberStoredCredentials {
  return {
    access_token: `access-${n}`,
    refresh_token: `refresh-${n}`,
    token_type: "Bearer",
    expires_at: new Date(Date.now() + expOffsetMs).toISOString(),
  };
}

function makeStore(initial: TokenRow) {
  let row = { ...initial, credentials: { ...initial.credentials } };
  let lockOwner: string | null = null;
  const exchange = vi.fn(async (rt: string) => {
    if (rt !== row.credentials.refresh_token) {
      throw new JobberAuthError("revoked", "stale refresh");
    }
    const next = creds(row.generation + 1, 3_600_000);
    return next;
  });
  const deps: RefreshDeps = {
    load: async () => ({ ...row, credentials: { ...row.credentials } }),
    acquireLock: async (owner) => {
      if (lockOwner && lockOwner !== owner) return false;
      lockOwner = owner;
      return true;
    },
    releaseLock: async (owner) => {
      if (lockOwner === owner) lockOwner = null;
    },
    exchangeRefresh: exchange,
    persistIfGeneration: async (expected, next) => {
      if (row.generation !== expected) return false;
      row = {
        ...row,
        generation: expected + 1,
        credentials: next,
      };
      return true;
    },
    markRevoked: vi.fn(async () => {}),
    sleep: async () => {},
    now: () => Date.now(),
    lockWaitMs: 1,
    lockRetries: 4,
  };
  return { deps, exchange, getRow: () => row, setLock: (o: string | null) => (lockOwner = o) };
}

describe("Jobber refresh coordinator", () => {
  it("returns current access token when still fresh", async () => {
    const { deps, exchange } = makeStore({
      generation: 3,
      credentials: creds(3, 10 * 60_000),
      accountId: "acct",
      accountName: "Septic Tank Man",
    });
    const t = await getValidAccessToken(deps);
    expect(t.accessToken).toBe("access-3");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("only one concurrent refresher exchanges the token", async () => {
    let lock: string | null = null;
    let row: TokenRow = {
      generation: 1,
      credentials: creds(1, -1_000),
      accountId: "acct",
      accountName: "STM",
    };
    let exchanges = 0;
    const waiters: Array<() => void> = [];
    const depsFor = (): RefreshDeps => ({
      load: async () => ({ ...row, credentials: { ...row.credentials } }),
      acquireLock: async (owner) => {
        if (lock && lock !== owner) return false;
        lock = owner;
        return true;
      },
      releaseLock: async (owner) => {
        if (lock === owner) lock = null;
      },
      exchangeRefresh: async (rt) => {
        exchanges += 1;
        expect(rt).toBe("refresh-1");
        await new Promise<void>((r) => waiters.push(r));
        const next = creds(2, 3_600_000);
        return next;
      },
      persistIfGeneration: async (expected, next) => {
        if (row.generation !== expected) return false;
        row = { ...row, generation: expected + 1, credentials: next };
        return true;
      },
      markRevoked: async () => {},
      sleep: async () => {
        await new Promise((r) => setTimeout(r, 5));
      },
      now: () => Date.now(),
      lockWaitMs: 5,
      lockRetries: 20,
      skewMs: 120_000,
    });
    const a = getValidAccessToken(depsFor());
    await new Promise((r) => setTimeout(r, 10));
    const b = getValidAccessToken(depsFor());
    await new Promise((r) => setTimeout(r, 15));
    waiters.forEach((w) => w());
    const [ra, rb] = await Promise.all([a, b]);
    expect(exchanges).toBe(1);
    expect(ra.accessToken).toBe("access-2");
    expect(rb.accessToken).toBe("access-2");
    expect(row.generation).toBe(2);
  });

  it("does not persist over a newer generation", async () => {
    const { deps } = makeStore({
      generation: 4,
      credentials: creds(4, -1_000),
      accountId: "acct",
      accountName: "STM",
    });
    deps.persistIfGeneration = async () => false;
    deps.load = async () => ({
      generation: 5,
      credentials: creds(5, 3_600_000),
      accountId: "acct",
      accountName: "STM",
    });
    const t = await getValidAccessToken(deps);
    expect(t.accessToken).toBe("access-5");
    expect(t.generation).toBe(5);
  });

  it("marks revoked credentials and does not treat 401 as transient", async () => {
    const { deps } = makeStore({
      generation: 1,
      credentials: creds(1, -1_000),
      accountId: "acct",
      accountName: "STM",
    });
    deps.exchangeRefresh = async () => {
      throw new JobberAuthError("revoked", "Jobber refresh failed (401): not valid");
    };
    await expect(getValidAccessToken(deps)).rejects.toMatchObject({ kind: "revoked" });
    expect(deps.markRevoked).toHaveBeenCalled();
  });

  it("does not mark disconnected on transient provider errors", async () => {
    const { deps } = makeStore({
      generation: 1,
      credentials: creds(1, -1_000),
      accountId: "acct",
      accountName: "STM",
    });
    deps.exchangeRefresh = async () => {
      throw new JobberAuthError("transient", "Jobber refresh failed (503): unavailable");
    };
    await expect(getValidAccessToken(deps)).rejects.toMatchObject({ kind: "transient" });
    expect(deps.markRevoked).not.toHaveBeenCalled();
  });
});

describe("classifyJobberTokenHttp", () => {
  it("treats invalid refresh as revoked", () => {
    expect(classifyJobberTokenHttp(401, "The provided refresh token is not valid.")).toBe(
      "revoked"
    );
  });
  it("treats 503 as transient", () => {
    expect(classifyJobberTokenHttp(503, '{"error":"temporarily_unavailable"}')).toBe(
      "transient"
    );
  });
});
