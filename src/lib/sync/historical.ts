import { collectIdHits, type ProviderHit } from "@/lib/sync/matching";
import { assertGate } from "@/lib/config/feature-flags";

export type DryRunPair = {
  jobberId: string;
  ghlId: string;
  via: "email" | "phone" | "both";
};

export type HistoricalDryRun = {
  jobberCount: number;
  ghlCount: number;
  exact: DryRunPair[];
  ambiguousJobber: { jobberId: string; ghlIds: string[] }[];
  unmatchedJobber: string[];
  unmatchedGhl: string[];
  messaging: false;
};

export function dryRunMatchCustomers(
  jobber: ProviderHit[],
  ghl: ProviderHit[]
): HistoricalDryRun {
  const exact: DryRunPair[] = [];
  const ambiguousJobber: { jobberId: string; ghlIds: string[] }[] = [];
  const matchedGhl = new Set<string>();
  const matchedJobber = new Set<string>();

  for (const jb of jobber) {
    const emails = jb.emails ?? [];
    const phones = jb.phones ?? [];
    const emailHits = emails.flatMap((e) => collectIdHits(ghl, e, null));
    const phoneHits = phones.flatMap((p) => collectIdHits(ghl, null, p));
    const hits = [...new Set([...emailHits, ...phoneHits])];
    if (hits.length === 1) {
      const ghlId = hits[0]!;
      const via =
        emailHits.includes(ghlId) && phoneHits.includes(ghlId)
          ? "both"
          : emailHits.includes(ghlId)
            ? "email"
            : "phone";
      exact.push({ jobberId: jb.id, ghlId, via });
      matchedGhl.add(ghlId);
      matchedJobber.add(jb.id);
    } else if (hits.length > 1) {
      ambiguousJobber.push({ jobberId: jb.id, ghlIds: hits });
      matchedJobber.add(jb.id);
    }
  }

  return {
    jobberCount: jobber.length,
    ghlCount: ghl.length,
    exact,
    ambiguousJobber,
    unmatchedJobber: jobber.filter((j) => !matchedJobber.has(j.id)).map((j) => j.id),
    unmatchedGhl: ghl.filter((g) => !matchedGhl.has(g.id)).map((g) => g.id),
    messaging: false,
  };
}

/** Live execute is blocked until Gate B. Dry-run never calls this. */
export function assertHistoricalExecute(): void {
  assertGate("historical_backfill", "historical_import_execute");
}

export function toProviderHitsFromJobber(nodes: {
  id: string;
  emails?: { address?: string }[];
  phones?: { number?: string }[];
}[]): ProviderHit[] {
  return nodes.map((n) => ({
    id: n.id,
    emails: (n.emails ?? []).map((e) => e.address).filter(Boolean) as string[],
    phones: (n.phones ?? []).map((p) => p.number).filter(Boolean) as string[],
  }));
}

export function toProviderHitsFromGhl(nodes: {
  id: string;
  email?: string | null;
  phone?: string | null;
}[]): ProviderHit[] {
  return nodes.map((n) => ({
    id: n.id,
    emails: n.email ? [n.email] : [],
    phones: n.phone ? [n.phone] : [],
  }));
}

