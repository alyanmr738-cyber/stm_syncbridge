import { JobberAuthError } from "@/lib/jobber/auth-error";
import type { JobberStoredCredentials } from "@/lib/db/sync-connections";

export type TokenRow = {
  generation: number;
  credentials: JobberStoredCredentials;
  accountId: string;
  accountName: string | null;
};

export type RefreshDeps = {
  load: () => Promise<TokenRow>;
  acquireLock: (owner: string) => Promise<boolean>;
  releaseLock: (owner: string) => Promise<void>;
  exchangeRefresh: (refreshToken: string) => Promise<JobberStoredCredentials>;
  persistIfGeneration: (
    expectedGeneration: number,
    next: JobberStoredCredentials
  ) => Promise<boolean>;
  markRevoked: (reason: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  skewMs?: number;
  lockWaitMs?: number;
  lockRetries?: number;
};

const DEFAULT_SKEW_MS = 120_000;

export async function getValidAccessToken(
  deps: RefreshDeps
): Promise<{ accessToken: string; accountId: string; accountName: string | null; generation: number }> {
  const skew = deps.skewMs ?? DEFAULT_SKEW_MS;
  const row = await deps.load();
  if (isFresh(row.credentials.expires_at, deps.now(), skew)) {
    return result(row);
  }

  const owner = crypto.randomUUID();
  const retries = deps.lockRetries ?? 6;
  const wait = deps.lockWaitMs ?? 400;

  let locked = await deps.acquireLock(owner);
  for (let i = 0; !locked && i < retries; i++) {
    await deps.sleep(wait * (i + 1));
    const latest = await deps.load();
    if (isFresh(latest.credentials.expires_at, deps.now(), skew)) {
      return result(latest);
    }
    locked = await deps.acquireLock(owner);
  }
  if (!locked) {
    const latest = await deps.load();
    if (isFresh(latest.credentials.expires_at, deps.now(), skew)) {
      return result(latest);
    }
    throw new JobberAuthError("lock", "Could not acquire Jobber refresh lock");
  }

  try {
    const latest = await deps.load();
    if (isFresh(latest.credentials.expires_at, deps.now(), skew)) {
      return result(latest);
    }
    let next: JobberStoredCredentials;
    try {
      next = await deps.exchangeRefresh(latest.credentials.refresh_token);
    } catch (e) {
      if (e instanceof JobberAuthError && e.kind === "revoked") {
        await deps.markRevoked(e.message.slice(0, 180));
      }
      throw e;
    }
    const saved = await deps.persistIfGeneration(latest.generation, next);
    if (!saved) {
      const raced = await deps.load();
      if (isFresh(raced.credentials.expires_at, deps.now(), skew)) {
        return result(raced);
      }
      throw new JobberAuthError(
        "lock",
        "Jobber token persist lost a newer generation — reloading"
      );
    }
    return {
      accessToken: next.access_token,
      accountId: latest.accountId,
      accountName: latest.accountName,
      generation: latest.generation + 1,
    };
  } finally {
    await deps.releaseLock(owner);
  }
}

function isFresh(expiresAt: string, now: number, skewMs: number): boolean {
  const exp = new Date(expiresAt).getTime();
  return Number.isFinite(exp) && exp - skewMs > now;
}

function result(row: TokenRow) {
  return {
    accessToken: row.credentials.access_token,
    accountId: row.accountId,
    accountName: row.accountName,
    generation: row.generation,
  };
}
