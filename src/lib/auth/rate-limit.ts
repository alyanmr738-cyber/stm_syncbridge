const windows = new Map<string, { n: number; start: number }>();

export function consumeLoginAttempt(key: string, limit = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const cur = windows.get(key);
  if (!cur || now - cur.start > windowMs) {
    windows.set(key, { n: 1, start: now });
    return true;
  }
  if (cur.n >= limit) return false;
  cur.n += 1;
  return true;
}
