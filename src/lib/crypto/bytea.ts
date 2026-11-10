export function parseStoredBytea(value: unknown): Buffer {
  if (!value) throw new Error("empty credential blob");
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    const s = value.startsWith("\\x") ? value.slice(2) : value;
    if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
      return Buffer.from(s, "hex");
    }
    return Buffer.from(s, "base64");
  }
  throw new Error("unsupported credential blob type");
}

export function toByteaHex(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}
