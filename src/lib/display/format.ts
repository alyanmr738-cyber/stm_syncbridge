export function collapseRepeatedName(value: string): string {
  const t = value.replace(/\s+/g, " ").trim();
  const parts = t.split(" ").filter(Boolean);
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    const a = parts.slice(0, half).join(" ");
    const b = parts.slice(half).join(" ");
    if (a.toLowerCase() === b.toLowerCase()) return a;
  }
  return t;
}

export function constructProviderName(input: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  companyName?: string | null;
}): string {
  const company = collapseRepeatedName(String(input.companyName ?? "").trim());
  const first = String(input.firstName ?? "").trim();
  const last = String(input.lastName ?? "").trim();
  const person = collapseRepeatedName([first, last].filter(Boolean).join(" "));
  const rawName = collapseRepeatedName(String(input.name ?? "").trim());
  if (person && rawName && person.toLowerCase() === rawName.toLowerCase()) return person;
  if (person && rawName && rawName.toLowerCase().startsWith(person.toLowerCase())) return person;
  if (person) return person;
  if (rawName) return rawName;
  return company;
}

export function displayName(
  parts: Array<string | null | undefined>,
  fallback = "Name unavailable"
): string {
  const unique: string[] = [];
  for (const p of parts) {
    const s = collapseRepeatedName(String(p ?? "").trim());
    if (!s) continue;
    if (unique.some((u) => u.toLowerCase() === s.toLowerCase())) continue;
    if (unique.some((u) => s.toLowerCase().includes(u.toLowerCase()) && s.length > u.length)) {
      continue;
    }
    unique.push(s);
  }
  return collapseRepeatedName(unique.join(" ")) || fallback;
}

export function namesDiffer(a?: string | null, b?: string | null): boolean {
  const na = displayName([a], "");
  const nb = displayName([b], "");
  if (!na || !nb) return false;
  if (/unavailable|unlinked|unknown/i.test(na) || /unavailable|unlinked|unknown/i.test(nb)) {
    return false;
  }
  return na.toLowerCase() !== nb.toLowerCase();
}

export function maskEmail(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  const [user, domain] = email.split("@");
  if (!user || !domain) return null;
  const keep = user.slice(0, Math.min(2, user.length));
  return `${keep}•••@${domain}`;
}

export function maskPhone(phone?: string | null): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `•••-•••-${digits.slice(-4)}`;
}

export function parseRevisionBlob(raw?: string | null): {
  name?: string;
  email?: string | null;
  phone?: string | null;
} {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; email?: unknown; phone?: unknown };
    return {
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      email: typeof parsed.email === "string" ? parsed.email : null,
      phone: typeof parsed.phone === "string" ? parsed.phone : null,
    };
  } catch {
    return {};
  }
}

export function formatJobStatus(status?: string | null): string {
  const s = String(status ?? "").trim();
  if (!s) return "Unknown";
  const map: Record<string, string> = {
    requires_invoicing: "Needs invoicing",
    action_required: "Action required",
    today: "Scheduled today",
    upcoming: "Upcoming",
    archived: "Archived",
    cancelled: "Cancelled",
    late: "Late",
    active: "Active",
    closed: "Closed",
    complete: "Complete",
    completed: "Complete",
  };
  if (map[s.toLowerCase()]) return map[s.toLowerCase()]!;
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ghlSyncLabel(ghlReference?: string | null): string {
  return ghlReference ? "GHL note recorded" : "Database only — not pushed to GHL";
}

export function fallbackFromId(kind: string, id?: string | null): string {
  if (!id) return `${kind} unavailable`;
  return `${kind} (details)`;
}
