import { createHmac, timingSafeEqual } from "crypto";

export function verifyJobberWebhook(
  rawBody: Buffer,
  signatureHeader: string | null,
  clientSecret: string
): boolean {
  if (!signatureHeader) return false;
  const digest = createHmac("sha256", clientSecret).update(rawBody).digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signatureHeader, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function verifyInternalAction(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
