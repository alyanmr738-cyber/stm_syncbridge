import { getEnv } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";
import { assertPilotWrite } from "@/lib/config/pilot";
import { STM_GHL } from "@/lib/config/stm-mapping";
import { createOpportunity, moveOpportunityStage, searchGhlContacts, upsertGhlContact } from "@/lib/ghl/rest";
import {
  createJobberClient,
  createJobberNote,
  editJobberClient,
  fetchJobberClient,
  fetchJobberJob,
} from "@/lib/jobber/ops";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { normalizeEmail, normalizePhone } from "@/lib/sync/identity";
import {
  findJobLink,
  matchCustomer,
  openConflict,
  upsertCustomerLink,
  upsertJobLink,
} from "@/lib/sync/match-store";

export type LoadedEvent = {
  id: string;
  source: string;
  eventKind: string;
  providerEntityId: string | null;
  payload: Record<string, unknown>;
};

function emailsFromClient(client: Awaited<ReturnType<typeof fetchJobberClient>>) {
  return client?.emails?.nodes?.map((n) => n.address).filter(Boolean) as string[] | undefined;
}

export async function syncJobberClient(event: LoadedEvent): Promise<void> {
  const clientId = event.providerEntityId;
  if (!clientId || clientId.startsWith("phase1-probe-")) {
    return;
  }
  const client = await fetchJobberClient(clientId);
  if (!client) return;
  const email = emailsFromClient(client)?.[0];
  const phone = client.phones?.nodes?.[0]?.number;
  const decision = await matchCustomer({
    jobberClientId: client.id,
    email,
    phone,
  });
  if (decision.kind === "ambiguous") {
    await openConflict({
      eventId: event.id,
      entityType: "customer",
      entityId: client.id,
      reason: "ambiguous_customer_match",
      details: { candidateIds: decision.candidateIds },
    });
    return;
  }

  let ghlId: string | undefined =
    decision.kind === "linked" ? undefined : undefined;
  const supabase = getSupabaseAdmin();
  if (decision.kind === "linked") {
    const linked = supabase
      ? await supabase
          .from("customer_links")
          .select("ghl_contact_id")
          .eq("id", decision.customerLinkId)
          .maybeSingle()
      : { data: null };
    ghlId = linked.data?.ghl_contact_id ?? undefined;
  }

  if (decision.kind === "create" && email) {
    const found = await searchGhlContacts(email);
    if (found.length === 1) ghlId = found[0]!.id;
    if (found.length > 1) {
      await openConflict({
        eventId: event.id,
        entityType: "customer",
        entityId: client.id,
        reason: "ambiguous_ghl_search",
      });
      return;
    }
  }

  assertPilotWrite(`jobber.client:${event.eventKind}`, {
    jobberClientId: client.id,
    ghlContactId: ghlId,
    creatingGhlContact: !ghlId,
  });
  const prop = client.properties?.nodes?.[0]?.address;
  const contact = await upsertGhlContact({
    id: ghlId,
    firstName: client.firstName ?? undefined,
    lastName: client.lastName ?? undefined,
    email,
    phone: normalizePhone(phone) ?? undefined,
    address1: prop?.street1,
    city: prop?.city,
    postalCode: prop?.postalCode,
  });
  const linkId = await upsertCustomerLink({
    jobber_client_id: client.id,
    ghl_contact_id: contact.id,
    match_method: ghlId ? "jobber_authoritative_update" : "jobber_create",
    verified: true,
    last_jobber_revision: JSON.stringify({ email, phone, name: client.name }),
  });
  const supabaseWrite = getSupabaseAdmin();
  for (const property of client.properties?.nodes ?? []) {
    if (!linkId || !property.id) continue;
    await supabaseWrite?.from("property_links").upsert(
      {
        customer_link_id: linkId,
        jobber_property_id: property.id,
        ghl_property_reference: [
          property.address?.street1,
          property.address?.city,
          property.address?.postalCode,
        ]
          .filter(Boolean)
          .join(", "),
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "jobber_property_id" }
    );
  }
}

export async function syncGhlContact(event: LoadedEvent): Promise<void> {
  const payload = event.payload;
  const ghlId = String(payload.contactId ?? payload.id ?? event.providerEntityId ?? "");
  const email = normalizeEmail(String(payload.email ?? ""));
  const phone = normalizePhone(String(payload.phone ?? ""));
  const firstName = String(payload.firstName ?? payload.first_name ?? "");
  const lastName = String(payload.lastName ?? payload.last_name ?? "");
  if (!ghlId) return;

  const decision = await matchCustomer({ ghlContactId: ghlId, email, phone });
  if (decision.kind === "ambiguous") {
    await openConflict({
      eventId: event.id,
      entityType: "customer",
      entityId: ghlId,
      reason: "ambiguous_customer_match",
    });
    return;
  }

  let jobberId: string | undefined;
  if (decision.kind === "linked") {
    const supabase = getSupabaseAdmin();
    const linked = supabase
      ? await supabase
          .from("customer_links")
          .select("jobber_client_id")
          .eq("id", decision.customerLinkId)
          .maybeSingle()
      : { data: null };
    jobberId = linked.data?.jobber_client_id ?? undefined;
  }

  assertPilotWrite(`ghl.contact:${event.eventKind}`, {
    ghlContactId: ghlId,
    jobberClientId: jobberId,
    creatingJobberClient: !jobberId,
  });
  if (jobberId) {
    await editJobberClient({
      id: jobberId,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
    });
    const authoritative = await fetchJobberClient(jobberId);
    const aEmail = emailsFromClient(authoritative)?.[0];
    await upsertGhlContact({
      id: ghlId,
      firstName: authoritative?.firstName ?? undefined,
      lastName: authoritative?.lastName ?? undefined,
      email: aEmail,
      phone: normalizePhone(authoritative?.phones?.nodes?.[0]?.number) ?? undefined,
    });
    await upsertCustomerLink({
      jobber_client_id: jobberId,
      ghl_contact_id: ghlId,
      match_method: "ghl_edit_then_jobber_authoritative",
      verified: true,
    });
    return;
  }

  const created = await createJobberClient({
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    email: email ?? undefined,
    phone: phone ?? undefined,
  });
  await upsertCustomerLink({
    jobber_client_id: created,
    ghl_contact_id: ghlId,
    match_method: "ghl_create_jobber_client",
    verified: true,
  });
}

export async function syncBooking(event: LoadedEvent): Promise<void> {
  const apptId = String(
    event.payload.appointmentId ?? event.payload.id ?? event.providerEntityId ?? event.id
  );
  const existing = await findJobLink({ bookingKey: apptId });
  const supabase = getSupabaseAdmin();
  if (existing) {
    await supabase?.from("appointment_links").upsert(
      {
        job_link_id: existing.id,
        ghl_appointment_id: apptId,
        booking_state: "pending_jobber_confirmation",
      },
      { onConflict: "ghl_appointment_id" }
    );
    return;
  }
  await supabase?.from("appointment_links").insert({
    ghl_appointment_id: apptId,
    booking_state: "pending_jobber_confirmation",
  });
  await openConflict({
    eventId: event.id,
    entityType: "booking",
    entityId: apptId,
    reason: "pending_jobber_confirmation",
    details: {
      note: "Jobber has visitEditSchedule/scheduledItems but no proven availability reservation API",
    },
  });
}

export async function syncJobberJob(event: LoadedEvent): Promise<void> {
  const jobId = event.providerEntityId;
  if (!jobId) return;
  const job = await fetchJobberJob(jobId);
  if (!job) return;
  const existing = await findJobLink({ jobberJobId: job.id });
  if (existing) {
    await upsertJobLink({
      jobber_job_id: job.id,
      last_job_status: job.jobStatus,
    });
    return;
  }
  await upsertJobLink({
    jobber_job_id: job.id,
    last_job_status: job.jobStatus,
  });
}

export async function syncJobClosed(event: LoadedEvent): Promise<void> {
  const env = getEnv();
  const jobId = event.providerEntityId ?? event.id;
  const existing = await findJobLink({ jobberJobId: jobId });
  const supabase = getSupabaseAdmin();

  if (existing?.ghl_opportunity_id && env.JOB_COMPLETION_SYNC_ENABLED) {
    assertPilotWrite("jobber.job_closed", {
      jobberJobId: jobId,
      ghlOpportunityId: existing.ghl_opportunity_id as string,
    });
    await moveOpportunityStage({
      opportunityId: existing.ghl_opportunity_id as string,
      stageId: STM_GHL.jobCompletedStageId,
    });
  } else if (!existing?.ghl_opportunity_id && env.JOB_COMPLETION_SYNC_ENABLED) {
    const clRes = supabase
      ? await supabase
          .from("customer_links")
          .select("ghl_contact_id")
          .eq("jobber_client_id", String(event.payload.clientId ?? ""))
          .maybeSingle()
      : { data: null };
    const cl = clRes.data;
    if (cl?.ghl_contact_id) {
      assertPilotWrite("jobber.job_closed.create_opp", {
        jobberJobId: jobId,
        ghlContactId: cl.ghl_contact_id,
        creatingGhlOpportunity: true,
      });
      const opp = await createOpportunity({
        contactId: cl.ghl_contact_id,
        name: `Job ${jobId}`,
        stageId: STM_GHL.jobCompletedStageId,
      });
      await upsertJobLink({
        jobber_job_id: jobId,
        ghl_opportunity_id: opp.id,
        last_job_status: "closed",
      });
    }
  }

  const messagingOn = env.CUSTOMER_MESSAGING_ENABLED && env.REVIEW_TRIGGER_ENABLED;
  await supabase?.from("review_deliveries").upsert(
    {
      jobber_account_id: "connected",
      jobber_job_id: jobId,
      status: messagingOn ? "eligible" : "suppressed",
      failure_reason_redacted: messagingOn
        ? null
        : "Gate C / REVIEW_TRIGGER off — no customer message",
    },
    { onConflict: "jobber_account_id,jobber_job_id,review_kind" }
  );
}

export async function syncQuoteOrInvoice(event: LoadedEvent, kind: "quote" | "invoice"): Promise<void> {
  const supabase = getSupabaseAdmin();
  const id = event.providerEntityId ?? event.id;
  const table = kind === "quote" ? "quote_links" : "invoice_links";
  const col = kind === "quote" ? "jobber_quote_id" : "jobber_invoice_id";
  await supabase?.from(table).upsert(
    {
      [col]: id,
      last_status: String(event.payload.status ?? event.eventKind),
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: col }
  );
}

export async function syncAiSummary(event: LoadedEvent): Promise<void> {
  const env = getEnv();
  if (!env.AI_SUMMARY_SYNC_ENABLED) return;
  const text = String(event.payload.summary ?? event.payload.body ?? "");
  if (!text) return;
  const hash = Buffer.from(text).toString("base64").slice(0, 64);
  const supabase = getSupabaseAdmin();
  const key = String(event.payload.eventKey ?? event.id);
  const existingRes = supabase
    ? await supabase
        .from("note_deliveries")
        .select("id, summary_hash")
        .eq("ghl_summary_event_key", key)
        .maybeSingle()
    : { data: null };
  if (existingRes.data?.summary_hash === hash) return;
  const clientId = String(event.payload.jobberClientId ?? "");
  const jobId = String(event.payload.jobberJobId ?? "");
  assertPilotWrite("ai.summary_note", {
    jobberClientId: clientId || null,
    jobberJobId: jobId || null,
  });
  const noteId = await createJobberNote({
    clientId: clientId || undefined,
    jobId: jobId || undefined,
    message: text.slice(0, 4000),
  });
  await supabase?.from("note_deliveries").upsert({
    ghl_summary_event_key: key,
    summary_hash: hash,
    jobber_note_id: noteId,
    jobber_client_id: clientId || null,
    jobber_job_id: jobId || null,
    status: "delivered",
  });
}

export { GateClosedError };
