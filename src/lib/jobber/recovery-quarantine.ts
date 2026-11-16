import { getEnv } from "@/lib/config/env";

/** Outage window start (UTC): first unrecovered Jobber refresh 401 after token expiry. */
export const OAUTH_OUTAGE_QUARANTINE_SINCE = "2026-11-13T20:09:00.000Z";
/** Exclusive end: Jobber reconnect persisted tokens. */
export const OAUTH_OUTAGE_QUARANTINE_UNTIL = "2026-11-15T13:06:08.000Z";

export class OAuthRecoveryQuarantineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthRecoveryQuarantineError";
  }
}

export function oauthRecoveryQuarantineActive(): boolean {
  return getEnv().OAUTH_RECOVERY_QUARANTINE_ENABLED === true;
}

export function oauthRecoveryQuarantineSince(): string {
  return getEnv().OAUTH_RECOVERY_QUARANTINE_SINCE ?? OAUTH_OUTAGE_QUARANTINE_SINCE;
}

export function oauthRecoveryQuarantineUntil(): string {
  return getEnv().OAUTH_RECOVERY_QUARANTINE_UNTIL ?? OAUTH_OUTAGE_QUARANTINE_UNTIL;
}

export function isEventInOAuthRecoveryQuarantine(
  receivedAt: string | null | undefined,
  status?: string | null
): boolean {
  if (!oauthRecoveryQuarantineActive() || !receivedAt) return false;
  const since = new Date(oauthRecoveryQuarantineSince()).getTime();
  const until = new Date(oauthRecoveryQuarantineUntil()).getTime();
  const t = new Date(receivedAt).getTime();
  if (!Number.isFinite(since) || !Number.isFinite(until) || !Number.isFinite(t)) return false;
  if (t < since || t >= until) return false;
  const s = (status ?? "").toLowerCase();
  return s === "dead_letter" || s === "retrying";
}

export function assertNotOAuthRecoveryQuarantine(
  receivedAt: string | null | undefined,
  operation: string,
  status?: string | null
): void {
  if (!isEventInOAuthRecoveryQuarantine(receivedAt, status)) return;
  throw new OAuthRecoveryQuarantineError(
    `Quarantined (${operation}): event in OAuth outage window — manual catch-up approval required`
  );
}
