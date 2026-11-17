import { getCreationCanaryConfig, creationCanaryMatchesRequest, creationCanaryWindowOpen } from "@/lib/config/creation-canary";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";

export type CanaryWriteState =
  | "none"
  | "reserved"
  | "creating"
  | "created"
  | "reconciliation_required"
  | "failed_before_provider_write";

export type CanaryRunState =
  | "reserved"
  | "creating"
  | "created"
  | "reconciliation_required"
  | "failed_before_provider_write"
  | "completed";

export type LedgerRow = {
  id: string;
  ghl_contact_id: string;
  service_request_key: string;
  run_state: CanaryRunState;
  jobber_client_id: string | null;
  jobber_job_id: string | null;
  client_write_state: CanaryWriteState;
  job_write_state: CanaryWriteState;
};

type MemorySlot = {
  write_state: string;
  ledger_id: string | null;
  jobber_provider_id: string | null;
  lock_owner: string | null;
};

type MemoryStore = {
  ledgers: Map<string, LedgerRow>;
  slots: Record<"client" | "job", MemorySlot>;
};

let memory: MemoryStore | null = null;

export function resetCreationLedgerForTests(): void {
  memory = {
    ledgers: new Map(),
    slots: {
      client: { write_state: "available", ledger_id: null, jobber_provider_id: null, lock_owner: null },
      job: { write_state: "available", ledger_id: null, jobber_provider_id: null, lock_owner: null },
    },
  };
}

function useMemory(): boolean {
  return !getSupabaseAdmin() || process.env.CREATION_LEDGER_MEMORY === "true";
}

function mem(): MemoryStore {
  if (!memory) resetCreationLedgerForTests();
  return memory!;
}

export function canaryConfigAuthorizes(opts: {
  ghlContactId: string;
  serviceRequestKey: string;
}): boolean {
  const cfg = getCreationCanaryConfig();
  if (!cfg.enabled || !creationCanaryWindowOpen()) return false;
  if (cfg.ghlContactId && cfg.ghlContactId !== opts.ghlContactId) return false;
  if (cfg.serviceRequestKeys.length !== 1) return false;
  if (cfg.serviceRequestKeys[0] !== opts.serviceRequestKey) return false;
  return creationCanaryMatchesRequest(opts);
}

/** Env-only check for sync pilot gate; budget enforced in DB/memory below. */
export function canaryEnvAllowsAttempt(opts: {
  ghlContactId?: string | null;
  serviceRequestKey?: string | null;
  kind: "client" | "job";
}): boolean {
  if (!opts.ghlContactId || !opts.serviceRequestKey) return false;
  if (!canaryConfigAuthorizes({
    ghlContactId: opts.ghlContactId,
    serviceRequestKey: opts.serviceRequestKey,
  })) {
    return false;
  }
  const cfg = getCreationCanaryConfig();
  if (opts.kind === "client" && !cfg.allowNewClient) return false;
  return true;
}

export async function getOrCreateCanaryLedger(opts: {
  ghlContactId: string;
  serviceRequestKey: string;
  syncEventId?: string;
}): Promise<LedgerRow | null> {
  if (!canaryConfigAuthorizes(opts)) return null;

  if (useMemory()) {
    const m = mem();
    const existing = m.ledgers.get(opts.serviceRequestKey);
    if (existing) return existing;
    const row: LedgerRow = {
      id: `mem-${opts.serviceRequestKey}`,
      ghl_contact_id: opts.ghlContactId,
      service_request_key: opts.serviceRequestKey,
      run_state: "reserved",
      jobber_client_id: null,
      jobber_job_id: null,
      client_write_state: "none",
      job_write_state: "none",
    };
    m.ledgers.set(opts.serviceRequestKey, row);
    return row;
  }

  const supabase = getSupabaseAdmin()!;
  const { data: existing } = await supabase
    .from("creation_canary_ledger")
    .select("*")
    .eq("service_request_key", opts.serviceRequestKey)
    .maybeSingle();
  if (existing) return existing as LedgerRow;

  const { data, error } = await supabase
    .from("creation_canary_ledger")
    .insert({
      ghl_contact_id: opts.ghlContactId,
      service_request_key: opts.serviceRequestKey,
      sync_event_id: opts.syncEventId,
      run_state: "reserved",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("creation_canary_ledger")
        .select("*")
        .eq("service_request_key", opts.serviceRequestKey)
        .maybeSingle();
      return (again as LedgerRow) ?? null;
    }
    return null;
  }
  return data as LedgerRow;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[creation-ledger] rpc ${fn}:`, error.message);
    return null;
  }
  return data as T;
}

export async function reserveCanarySlot(opts: {
  kind: "client" | "job";
  ledgerId: string;
  owner: string;
}): Promise<boolean> {
  if (useMemory()) {
    const m = mem();
    const slot = m.slots[opts.kind];
    if (slot.jobber_provider_id) return false;
    if (
      slot.write_state === "reserved" &&
      slot.ledger_id === opts.ledgerId &&
      slot.lock_owner === opts.owner
    ) {
      return true;
    }
    if (slot.write_state !== "available") return false;
    slot.write_state = "reserved";
    slot.ledger_id = opts.ledgerId;
    slot.lock_owner = opts.owner;
    const row = [...m.ledgers.values()].find((r) => r.id === opts.ledgerId);
    if (row) {
      if (opts.kind === "client") row.client_write_state = "reserved";
      else row.job_write_state = "reserved";
      row.run_state = "reserved";
    }
    return true;
  }
  const ok = await rpc<boolean>("try_acquire_creation_slot", {
    p_slot: opts.kind,
    p_ledger_id: opts.ledgerId,
    p_owner: opts.owner,
    p_ttl_seconds: 120,
  });
  return ok === true;
}

export async function markSlotCreating(opts: {
  kind: "client" | "job";
  ledgerId: string;
  owner: string;
}): Promise<boolean> {
  if (useMemory()) {
    const m = mem();
    const slot = m.slots[opts.kind];
    if (slot.ledger_id !== opts.ledgerId) return false;
    slot.write_state = "creating";
    const row = [...m.ledgers.values()].find((r) => r.id === opts.ledgerId);
    if (row) {
      if (opts.kind === "client") row.client_write_state = "creating";
      else row.job_write_state = "creating";
      row.run_state = "creating";
    }
    return true;
  }
  return (await rpc<boolean>("mark_creation_slot_creating", {
    p_slot: opts.kind,
    p_ledger_id: opts.ledgerId,
    p_owner: opts.owner,
  })) === true;
}

export async function completeCanarySlot(opts: {
  kind: "client" | "job";
  ledgerId: string;
  providerId: string;
}): Promise<boolean> {
  if (useMemory()) {
    const m = mem();
    const slot = m.slots[opts.kind];
    slot.write_state = "created";
    slot.jobber_provider_id = opts.providerId;
    const row = [...m.ledgers.values()].find((r) => r.id === opts.ledgerId);
    if (row) {
      if (opts.kind === "client") {
        row.client_write_state = "created";
        row.jobber_client_id = opts.providerId;
      } else {
        row.job_write_state = "created";
        row.jobber_job_id = opts.providerId;
      }
      row.run_state =
        row.client_write_state === "created" && row.job_write_state === "created"
          ? "completed"
          : "created";
    }
    return true;
  }
  return (await rpc<boolean>("complete_creation_slot", {
    p_slot: opts.kind,
    p_ledger_id: opts.ledgerId,
    p_provider_id: opts.providerId,
  })) === true;
}

export async function markCanaryReconciliation(opts: {
  kind: "client" | "job";
  ledgerId: string;
  message: string;
}): Promise<void> {
  const state: CanaryWriteState = "reconciliation_required";
  if (useMemory()) {
    const m = mem();
    m.slots[opts.kind].write_state = state;
    const row = [...m.ledgers.values()].find((r) => r.id === opts.ledgerId);
    if (row) {
      if (opts.kind === "client") row.client_write_state = state;
      else row.job_write_state = state;
      row.run_state = "reconciliation_required";
    }
    return;
  }
  const supabase = getSupabaseAdmin()!;
  const col = opts.kind === "client" ? "client_write_state" : "job_write_state";
  await supabase
    .from("creation_canary_ledger")
    .update({
      [col]: state,
      run_state: "reconciliation_required",
      last_error_redacted: opts.message.slice(0, 240),
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.ledgerId);
  await supabase
    .from("creation_canary_global_slots")
    .update({
      write_state: state,
      updated_at: new Date().toISOString(),
    })
    .eq("slot", opts.kind)
    .eq("ledger_id", opts.ledgerId);
}

export async function slotAllowsCreate(opts: {
  kind: "client" | "job";
  ledgerId: string;
}): Promise<boolean> {
  if (useMemory()) {
    const slot = mem().slots[opts.kind];
    return (
      slot.ledger_id === opts.ledgerId &&
      (slot.write_state === "reserved" || slot.write_state === "creating") &&
      !slot.jobber_provider_id
    );
  }
  const supabase = getSupabaseAdmin()!;
  const { data } = await supabase
    .from("creation_canary_global_slots")
    .select("write_state, ledger_id, jobber_provider_id")
    .eq("slot", opts.kind)
    .maybeSingle();
  if (!data) return false;
  return (
    data.ledger_id === opts.ledgerId &&
    !data.jobber_provider_id &&
    (data.write_state === "reserved" || data.write_state === "creating")
  );
}

export async function getLedgerByRequestKey(
  serviceRequestKey: string
): Promise<LedgerRow | null> {
  if (useMemory()) {
    return mem().ledgers.get(serviceRequestKey) ?? null;
  }
  const supabase = getSupabaseAdmin()!;
  const { data } = await supabase
    .from("creation_canary_ledger")
    .select("*")
    .eq("service_request_key", serviceRequestKey)
    .maybeSingle();
  return (data as LedgerRow) ?? null;
}

export async function canaryBudgetAvailable(kind: "client" | "job"): Promise<boolean> {
  if (useMemory()) {
    const slot = mem().slots[kind];
    return !slot.jobber_provider_id && slot.write_state === "available";
  }
  const supabase = getSupabaseAdmin()!;
  const { data } = await supabase
    .from("creation_canary_global_slots")
    .select("write_state, jobber_provider_id")
    .eq("slot", kind)
    .maybeSingle();
  return (
    Boolean(data) &&
    !data?.jobber_provider_id &&
    (data?.write_state === "available" || data?.write_state === "reserved")
  );
}