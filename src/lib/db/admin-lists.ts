import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getJobberConnectionSummary } from "@/lib/db/sync-connections";
import { verifyGhlConnection } from "@/lib/ghl/connection";
import { getEventQueue } from "@/lib/queue";

export async function connectionCounts() {
  const [jobber, ghl] = await Promise.all([
    getJobberConnectionSummary(),
    verifyGhlConnection(),
  ]);
  const n = Number(jobber.connected) + Number(ghl.ok);
  return { connected: n, total: 2, jobber, ghl };
}

export async function listLinks() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { customers: [], jobs: [] };
  const { data: customers } = await supabase
    .from("customer_links")
    .select("id, jobber_client_id, ghl_contact_id, verified, match_method, last_synced_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: jobs } = await supabase
    .from("job_links")
    .select("id, jobber_job_id, ghl_opportunity_id, last_job_status, last_synced_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return { customers: customers ?? [], jobs: jobs ?? [] };
}

export async function listBookings() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("appointment_links")
    .select(
      "id, ghl_appointment_id, jobber_visit_id, booking_state, requested_start_at, confirmed_start_at"
    )
    .order("requested_start_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function listReviews() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("review_deliveries")
    .select(
      "id, jobber_job_id, status, failure_reason_redacted, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function listConflicts() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("sync_conflicts")
    .select("id, entity_type, reason, state, created_at, source_entity_id")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function listFinance() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { quotes: [], invoices: [] };
  const { data: quotes } = await supabase
    .from("quote_links")
    .select("id, jobber_quote_id, last_status, ghl_reference, last_synced_at")
    .order("last_synced_at", { ascending: false })
    .limit(50);
  const { data: invoices } = await supabase
    .from("invoice_links")
    .select("id, jobber_invoice_id, last_status, ghl_reference, last_synced_at")
    .order("last_synced_at", { ascending: false })
    .limit(50);
  return { quotes: quotes ?? [], invoices: invoices ?? [] };
}

export async function queueHealth() {
  return getEventQueue().stats();
}
