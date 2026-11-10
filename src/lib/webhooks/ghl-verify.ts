import { createPublicKey, verify, timingSafeEqual } from "crypto";

/**
 * GHL marketplace docs: Ed25519 signature over timestamp + raw body when
 * X-GHL-Signature / X-GHL-Timestamp present.
 */
export function verifyGhlSignature(opts: {
  rawBody: Buffer;
  signatureHeader: string | null;
  timestampHeader: string | null;
  publicKeyPem?: string;
  require: boolean;
}): boolean {
  if (!opts.require) {
    return true;
  }
  if (!opts.publicKeyPem || !opts.signatureHeader || !opts.timestampHeader) {
    return false;
  }
  const ts = Number(opts.timestampHeader);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  try {
    const key = createPublicKey(opts.publicKeyPem);
    const msg = Buffer.concat([
      Buffer.from(String(opts.timestampHeader), "utf8"),
      opts.rawBody,
    ]);
    const sig = Buffer.from(opts.signatureHeader, "base64");
    return verify(null, msg, key, sig);
  } catch {
    return false;
  }
}

export function constantTimeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
