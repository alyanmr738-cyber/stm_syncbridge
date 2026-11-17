import type { LedgerRow } from "@/lib/sync/creation-ledger";
import { getLedgerByRequestKey } from "@/lib/sync/creation-ledger";
import { searchJobberClients } from "@/lib/jobber/ops";
import { getGhlContact } from "@/lib/ghl/rest";

export type RecoveryPlan =
  | { action: "no_ledger"; serviceRequestKey: string }
  | { action: "resume_job"; ledger: LedgerRow; jobberClientId: string }
  | { action: "reconcile_client"; ledger: LedgerRow; hint: string }
  | { action: "reconcile_job"; ledger: LedgerRow; jobberClientId: string }
  | { action: "halt_ambiguous"; ledger: LedgerRow; reason: string }
  | { action: "completed"; ledger: LedgerRow }
  | { action: "awaiting_provider_archive_approval"; ledger: LedgerRow; ids: string[] };

/**
 * Read-only recovery guidance. Never deletes links or archives Jobber records automatically.
 */
export async function planCanaryRecovery(serviceRequestKey: string): Promise<RecoveryPlan> {
  const ledger = await getLedgerByRequestKey(serviceRequestKey);
  if (!ledger) return { action: "no_ledger", serviceRequestKey };

  if (ledger.run_state === "completed" && ledger.jobber_client_id && ledger.jobber_job_id) {
    return { action: "completed", ledger };
  }

  if (ledger.run_state === "reconciliation_required") {
    if (ledger.jobber_client_id && !ledger.jobber_job_id) {
      return {
        action: "resume_job",
        ledger,
        jobberClientId: ledger.jobber_client_id,
      };
    }
    if (!ledger.jobber_client_id) {
      return {
        action: "reconcile_client",
        ledger,
        hint: "Search Jobber by GHL contact email/phone before any new clientCreate",
      };
    }
    if (ledger.jobber_client_id && ledger.jobber_job_id) {
      return { action: "completed", ledger };
    }
    return {
      action: "reconcile_job",
      ledger,
      jobberClientId: ledger.jobber_client_id,
    };
  }

  if (ledger.client_write_state === "reconciliation_required" && !ledger.jobber_client_id) {
    const row = await getGhlContact(ledger.ghl_contact_id);
    const hits = await searchJobberClients(row?.email ?? row?.phone ?? "");
    if (hits.length > 1) {
      return { action: "halt_ambiguous", ledger, reason: "multiple_jobber_clients_match_contact" };
    }
    if (hits.length === 1) {
      return {
        action: "reconcile_client",
        ledger,
        hint: `Provider candidate ${hits[0]!.id} — manual verify before persisting to ledger`,
      };
    }
  }

  const ids = [ledger.jobber_client_id, ledger.jobber_job_id].filter(Boolean) as string[];
  if (ids.length > 0 && ledger.run_state !== "completed") {
    return { action: "awaiting_provider_archive_approval", ledger, ids };
  }

  return { action: "halt_ambiguous", ledger, reason: "manual_review" };
}