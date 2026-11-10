import { createHmac, timingSafeEqual } from "crypto";

function hmacEquals(
  rawBody: Buffer,
  signatureHeader: string,
  clientSecret: string,
  encoding: "hex" | "base64"
): boolean {
  const digest = createHmac("sha256", clientSecret).update(rawBody).digest(encoding);
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signatureHeader, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Jobber signs with HMAC-SHA256 of the raw body; header is base64 (docs). Hex is accepted for internal tests. */
export function verifyJobberWebhook(
  rawBody: Buffer,
  signatureHeader: string | null,
  clientSecret: string
): boolean {
  if (!signatureHeader) return false;
  const header = signatureHeader.trim();
  return (
    hmacEquals(rawBody, header, clientSecret, "base64") ||
    hmacEquals(rawBody, header, clientSecret, "hex")
  );
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
