import { createHash } from "crypto";

export type JobberAuthKind = "revoked" | "transient" | "lock";

export class JobberAuthError extends Error {
  readonly kind: JobberAuthKind;

  constructor(kind: JobberAuthKind, message: string) {
    super(message);
    this.name = "JobberAuthError";
    this.kind = kind;
  }
}

export function classifyJobberTokenHttp(status: number, body: string): JobberAuthKind {
  const text = body.toLowerCase();
  if (
    status === 401 ||
    /not valid|invalid_grant|revoked|invalid_token|unauthorized/.test(text)
  ) {
    return "revoked";
  }
  return "transient";
}

export function fingerprintToken(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
