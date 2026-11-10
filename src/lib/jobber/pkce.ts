import { createHash, randomBytes } from "crypto";

const UNRESERVED =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function generateCodeVerifier(): string {
  const bytes = randomBytes(64);
  let out = "";
  for (let i = 0; i < 64; i++) {
    out += UNRESERVED[bytes[i]! % UNRESERVED.length];
  }
  return out;
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}
