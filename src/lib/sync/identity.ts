export function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return v.includes("@") ? v : null;
}

export function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export type MatchDecision =
  | { kind: "linked"; customerLinkId: string }
  | { kind: "create" }
  | { kind: "ambiguous"; candidateIds: string[] };

export function decideMatch(opts: {
  existingLinkId?: string;
  exactIdHits: string[];
  emailPhoneHits: string[];
}): MatchDecision {
  if (opts.existingLinkId) {
    return { kind: "linked", customerLinkId: opts.existingLinkId };
  }
  const unique = [...new Set([...opts.exactIdHits, ...opts.emailPhoneHits])];
  if (unique.length === 1) {
    return { kind: "linked", customerLinkId: unique[0]! };
  }
  if (unique.length > 1) {
    return { kind: "ambiguous", candidateIds: unique };
  }
  return { kind: "create" };
}
