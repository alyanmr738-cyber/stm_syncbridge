import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getEnv } from "@/lib/config/env";

function encryptionKey(): Buffer {
  const raw = getEnv().TOKEN_ENCRYPTION_KEY_BASE64;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY_BASE64 is not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  }
  return key;
}

export function encryptJson(payload: Record<string, unknown>): Buffer {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptJson<T>(blob: Buffer): T {
  const key = encryptionKey();
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
