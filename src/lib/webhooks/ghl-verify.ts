import { createPublicKey, createVerify, timingSafeEqual, verify } from "crypto";

/** Marketplace Ed25519 public key (not a secret). */
export const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

/** Legacy RSA public key for X-WH-Signature (deprecated 2026-09-01). */
export const GHL_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

export function constantTimeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyGhlEd25519(rawBody: Buffer, signatureHeader: string | null): boolean {
  if (!signatureHeader || signatureHeader === "N/A") return false;
  try {
    const key = createPublicKey(GHL_ED25519_PUBLIC_KEY);
    const sig = Buffer.from(signatureHeader, "base64");
    return verify(null, rawBody, key, sig);
  } catch {
    return false;
  }
}

export function verifyGhlRsaSha256(rawBody: Buffer, signatureHeader: string | null): boolean {
  if (!signatureHeader || signatureHeader === "N/A") return false;
  try {
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    return verifier.verify(GHL_RSA_PUBLIC_KEY, signatureHeader, "base64");
  } catch {
    return false;
  }
}

/**
 * Platform (marketplace) webhooks: X-GHL-Signature (Ed25519) or legacy X-WH-Signature (RSA).
 * Workflow HTTP actions: shared secret header / Bearer (GHL_WEBHOOK_SECRET).
 */
export function authorizeGhlRequest(opts: {
  rawBody: Buffer;
  ghlSignature: string | null;
  whSignature: string | null;
  workflowSecret?: string;
  presentedSecret?: string | null;
  authorization?: string | null;
}): { ok: boolean; mode: "platform_ed25519" | "platform_rsa" | "workflow_secret" | "rejected" } {
  if (opts.ghlSignature) {
    return verifyGhlEd25519(opts.rawBody, opts.ghlSignature)
      ? { ok: true, mode: "platform_ed25519" }
      : { ok: false, mode: "rejected" };
  }
  if (opts.whSignature) {
    return verifyGhlRsaSha256(opts.rawBody, opts.whSignature)
      ? { ok: true, mode: "platform_rsa" }
      : { ok: false, mode: "rejected" };
  }
  const secret = opts.workflowSecret;
  if (secret) {
    const bearer = opts.authorization?.startsWith("Bearer ")
      ? opts.authorization.slice(7)
      : "";
    const presented = opts.presentedSecret ?? "";
    if (
      (presented && constantTimeStringEqual(presented, secret)) ||
      (bearer && constantTimeStringEqual(bearer, secret))
    ) {
      return { ok: true, mode: "workflow_secret" };
    }
  }
  return { ok: false, mode: "rejected" };
}

/** @deprecated use authorizeGhlRequest */
export function verifyGhlSignature(opts: {
  rawBody: Buffer;
  signatureHeader: string | null;
  timestampHeader: string | null;
  publicKeyPem?: string;
  require: boolean;
}): boolean {
  void opts.timestampHeader;
  void opts.publicKeyPem;
  if (!opts.require) return true;
  return verifyGhlEd25519(opts.rawBody, opts.signatureHeader);
}
