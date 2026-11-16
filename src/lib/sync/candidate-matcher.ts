import { normalizeEmail, normalizePhone } from "@/lib/sync/identity";

export const EXCLUDED_NAME_PAIRS = [
  { jobber: "sherri", ghl: "sherry" },
  { jobber: "waldren", ghl: "waldron" },
];

export type CandidateBucket =
  | "email_and_phone_unique"
  | "email_only"
  | "phone_only"
  | "ambiguous"
  | "name_not_aligned"
  | "excluded"
  | "already_linked";

export type CandidateRecord = {
  id: string;
  emails?: string[];
  phones?: string[];
  name?: string | null;
};

export function nameTokens(s: string | null | undefined): Set<string> {
  return new Set(
    String(s ?? "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

export function namesAligned(a?: string | null, b?: string | null): boolean {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (!A.size || !B.size) return false;
  for (const t of A) if (B.has(t)) return true;
  return false;
}

export function isExcludedIdentity(jobberName?: string | null, ghlName?: string | null): boolean {
  const j = String(jobberName ?? "").toLowerCase();
  const g = String(ghlName ?? "").toLowerCase();
  if (j.includes("sherri") && g.includes("sherry")) return true;
  if (j.includes("waldren") && g.includes("waldron")) return true;
  if (g.includes("sherri") && j.includes("sherry")) return true;
  return false;
}

export function identityRevision(opts: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}): string {
  return JSON.stringify({
    email: normalizeEmail(opts.email) ?? null,
    phone: normalizePhone(opts.phone) ?? null,
    name: String(opts.name ?? "").trim(),
  });
}

export function classifyCustomerPair(opts: {
  jobber: CandidateRecord;
  ghl: CandidateRecord;
  emailUnique: boolean;
  phoneUnique: boolean;
  alreadyLinked?: boolean;
  collidingIds?: string[];
}): { bucket: CandidateBucket; reason: string; canAutoVerify: boolean } {
  if (opts.alreadyLinked) {
    return { bucket: "already_linked", reason: "pair_already_in_customer_links", canAutoVerify: false };
  }
  if (opts.collidingIds && opts.collidingIds.length > 1) {
    return { bucket: "ambiguous", reason: "multiple_plausible_ids", canAutoVerify: false };
  }
  if (isExcludedIdentity(opts.jobber.name, opts.ghl.name)) {
    return { bucket: "excluded", reason: "excluded_identity_collision", canAutoVerify: false };
  }
  const je = new Set((opts.jobber.emails ?? []).map(normalizeEmail).filter(Boolean) as string[]);
  const jp = new Set((opts.jobber.phones ?? []).map(normalizePhone).filter(Boolean) as string[]);
  const ge = new Set((opts.ghl.emails ?? []).map(normalizeEmail).filter(Boolean) as string[]);
  const gp = new Set((opts.ghl.phones ?? []).map(normalizePhone).filter(Boolean) as string[]);
  const emailHit = [...je].some((e) => ge.has(e));
  const phoneHit = [...jp].some((p) => gp.has(p));
  const aligned = namesAligned(opts.jobber.name, opts.ghl.name);

  if (emailHit && phoneHit && opts.emailUnique && opts.phoneUnique) {
    if (!aligned) {
      return { bucket: "name_not_aligned", reason: "email_phone_unique_but_names_do_not_overlap", canAutoVerify: false };
    }
    return {
      bucket: "email_and_phone_unique",
      reason: "unique_email_and_phone_and_name_token_overlap",
      canAutoVerify: false,
    };
  }
  if (emailHit && opts.emailUnique && !phoneHit) {
    return { bucket: "email_only", reason: "unique_email_without_matching_phone", canAutoVerify: false };
  }
  if (phoneHit && opts.phoneUnique && !emailHit) {
    return { bucket: "phone_only", reason: "unique_phone_without_matching_email", canAutoVerify: false };
  }
  if (emailHit || phoneHit) {
    return { bucket: "ambiguous", reason: "shared_email_or_phone", canAutoVerify: false };
  }
  return { bucket: "ambiguous", reason: "insufficient_identity", canAutoVerify: false };
}

export function canAcceptVerifiedLink(bucket: CandidateBucket): boolean {
  return bucket === "email_and_phone_unique";
}
