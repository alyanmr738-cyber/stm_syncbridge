import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { decideMatch, normalizeEmail, normalizePhone, type MatchDecision } from "@/lib/sync/identity";

export async function matchCustomer(opts: {
  jobberClientId?: string;
  ghlContactId?: string;
  email?: string | null;
  phone?: string | null;
}): Promise<MatchDecision & { link?: Record<string, unknown> }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { kind: "create" };

  if (opts.jobberClientId) {
    const { data } = await supabase
      .from("customer_links")
      .select("id")
      .eq("jobber_client_id", opts.jobberClientId)
      .maybeSingle();
    if (data?.id) return { kind: "linked", customerLinkId: data.id, link: data };
  }
  if (opts.ghlContactId) {
    const { data } = await supabase
      .from("customer_links")
      .select("id")
      .eq("ghl_contact_id", opts.ghlContactId)
      .maybeSingle();
    if (data?.id) return { kind: "linked", customerLinkId: data.id, link: data };
  }

  const email = normalizeEmail(opts.email);
  const phone = normalizePhone(opts.phone);
  const hits: string[] = [];
  const { data: all } = await supabase
    .from("customer_links")
    .select("id, jobber_client_id, ghl_contact_id, last_jobber_revision, last_ghl_revision");
  for (const row of all ?? []) {
    const blob = `${row.last_jobber_revision ?? ""} ${row.last_ghl_revision ?? ""}`;
    if (email && blob.toLowerCase().includes(email)) hits.push(row.id);
    if (phone && blob.includes(phone.replace("+", ""))) hits.push(row.id);
  }
  return decideMatch({ exactIdHits: [], emailPhoneHits: hits });
}

export async function upsertCustomerLink(row: {
  jobber_client_id?: string | null;
  ghl_contact_id?: string | null;
  match_method: string;
  verified?: boolean;
  last_jobber_revision?: string;
  last_ghl_revision?: string;
}): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("customer_links")
    .insert({
      ...row,
      verified: row.verified ?? false,
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (row.jobber_client_id) {
      const { data: existing } = await supabase
        .from("customer_links")
        .update({
          ghl_contact_id: row.ghl_contact_id,
          match_method: row.match_method,
          last_jobber_revision: row.last_jobber_revision,
          last_ghl_revision: row.last_ghl_revision,
          last_synced_at: new Date().toISOString(),
        })
        .eq("jobber_client_id", row.jobber_client_id)
        .select("id")
        .maybeSingle();
      return existing?.id ?? null;
    }
    return null;
  }
  return data.id;
}

export async function openConflict(opts: {
  eventId: string;
  entityType: string;
  entityId: string;
  reason: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase?.from("sync_conflicts").insert({
    source_event_id: opts.eventId,
    entity_type: opts.entityType,
    source_entity_id: opts.entityId,
    reason: opts.reason,
    details_redacted: opts.details ?? {},
  });
}

export async function findJobLink(opts: {
  jobberJobId?: string;
  ghlOpportunityId?: string;
  bookingKey?: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  if (opts.jobberJobId) {
    const { data } = await supabase
      .from("job_links")
      .select("*")
      .eq("jobber_job_id", opts.jobberJobId)
      .maybeSingle();
    if (data) return data;
  }
  if (opts.ghlOpportunityId) {
    const { data } = await supabase
      .from("job_links")
      .select("*")
      .eq("ghl_opportunity_id", opts.ghlOpportunityId)
      .maybeSingle();
    if (data) return data;
  }
  if (opts.bookingKey) {
    const { data } = await supabase
      .from("job_links")
      .select("*")
      .eq("source_booking_key", opts.bookingKey)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

export async function upsertJobLink(row: {
  customer_link_id?: string;
  jobber_job_id?: string;
  ghl_opportunity_id?: string;
  source_booking_key?: string;
  last_job_status?: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const existing = await findJobLink({
    jobberJobId: row.jobber_job_id,
    ghlOpportunityId: row.ghl_opportunity_id,
    bookingKey: row.source_booking_key,
  });
  if (existing) {
    await supabase
      .from("job_links")
      .update({ ...row, last_synced_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing.id as string;
  }
  const { data } = await supabase
    .from("job_links")
    .insert({ ...row, last_synced_at: new Date().toISOString() })
    .select("id")
    .single();
  return data?.id as string | undefined;
}
