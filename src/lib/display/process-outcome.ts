export type ProcessOutcome =
  | "received"
  | "provider_write"
  | "no_change"
  | "local_state_only"
  | "suppressed_feature"
  | "blocked_unverified"
  | "retrying"
  | "failed"
  | "dead_letter"
  | "write_not_recorded";

export function classifyProcessOutcome(opts: {
  status: string;
  error?: string | null;
  recordedOutcome?: string | null;
}): ProcessOutcome {
  if (opts.recordedOutcome && isProcessOutcome(opts.recordedOutcome)) {
    return opts.recordedOutcome;
  }
  const status = opts.status.toLowerCase();
  const err = String(opts.error ?? "");
  if (status === "queued") return "received";
  if (status === "retrying") return "retrying";
  if (status === "dead_letter" || status === "failed") return "dead_letter";
  if (status === "suppressed") {
    if (/unverified|no_existing|ambiguous/i.test(err)) return "blocked_unverified";
    return "suppressed_feature";
  }
  if (status === "succeeded") {
    if (/skip|no.?op|loop|unchanged|revision/i.test(err)) return "no_change";
    return "write_not_recorded";
  }
  return "received";
}

export function isProcessOutcome(v: string): v is ProcessOutcome {
  return [
    "received",
    "provider_write",
    "no_change",
    "local_state_only",
    "suppressed_feature",
    "blocked_unverified",
    "retrying",
    "failed",
    "dead_letter",
    "write_not_recorded",
  ].includes(v);
}

export function outcomeLabel(o: ProcessOutcome): string {
  const map: Record<ProcessOutcome, string> = {
    received: "Event received",
    provider_write: "Processed with provider write",
    no_change: "Processed, no change needed",
    local_state_only: "Processed, local state only",
    suppressed_feature: "Suppressed by disabled feature",
    blocked_unverified: "Blocked by missing verified identity",
    retrying: "Retrying",
    failed: "Failed",
    dead_letter: "Dead-lettered",
    write_not_recorded: "Write outcome not recorded",
  };
  return map[o];
}

export function providerWriteOccurred(o: ProcessOutcome): boolean | null {
  if (o === "provider_write") return true;
  if (o === "write_not_recorded") return null;
  return false;
}

export function formatAdminTimestamp(iso?: string | null, timeZone = "America/New_York"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
