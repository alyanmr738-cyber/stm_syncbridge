export function displayName(
  parts: Array<string | null | undefined>,
  fallback = "Name unavailable"
): string {
  const s = parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return s || fallback;
}

export function namesDiffer(a?: string | null, b?: string | null): boolean {
  const na = displayName([a], "");
  const nb = displayName([b], "");
  if (!na || !nb) return false;
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
