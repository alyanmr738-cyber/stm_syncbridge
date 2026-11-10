import { getEnv } from "@/lib/config/env";
import { GateClosedError } from "@/lib/config/feature-flags";
import { assertPilotWrite } from "@/lib/config/pilot";
import { STM_GHL } from "@/lib/config/stm-mapping";
import {
  addGhlContactNote,
  createOpportunity,
  getGhlContact,
  moveOpportunityStage,
  searchGhlContacts,
  searchGhlOpportunities,
  upsertGhlContact,
} from "@/lib/ghl/rest";
import {
  createJobberClient,
  createJobberNote,
  editJobberClient,
  fetchJobberClient,
  fetchJobberInvoice,
  fetchJobberJob,
  fetchJobberQuote,
  isJobberEncodedId,
  searchJobberClients,
} from "@/lib/jobber/ops";
import { jobberClientToGhlPayload, jobClosed, quoteInvoiceNoteBody } from "@/lib/sync/matching";
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
  return client?.emails?.map((n) => n.address).filter(Boolean) as string[] | undefined;
}

export async function syncJobberClient(event: LoadedEvent): Promise<void> {
  const clientId = event.providerEntityId;
  if (!isJobberEncodedId(clientId)) {
    return;
  }
  const client = await fetchJobberClient(clientId);
  if (!client) return;
  const email = emailsFromClient(client)?.[0];
  const phone = client.phones?.[0]?.number;
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

  let ghlId: string | undefined;
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

  if (decision.kind === "provider" && decision.ghlContactId) {
    ghlId = decision.ghlContactId;
  }
  if (!ghlId && (email || phone)) {
    const found = [
      ...(email ? await searchGhlContacts(email) : []),
      ...(phone ? await searchGhlContacts(phone) : []),
    ];
    const ids = [...new Set(found.map((c) => c.id))];
    if (ids.length === 1) ghlId = ids[0];
    if (ids.length > 1) {
      await openConflict({
        eventId: event.id,
        entityType: "customer",
        entityId: client.id,
        reason: "ambiguous_ghl_search",
        details: { candidateIds: ids },
      });
      return;
    }
  }

  assertPilotWrite(`jobber.client:${event.eventKind}`, {
    jobberClientId: client.id,
    ghlContactId: ghlId,
    creatingGhlContact: !ghlId,
  });
  const mapped = jobberClientToGhlPayload(client);
  const contact = await upsertGhlContact({
    id: ghlId,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    email: mapped.email,
    phone: mapped.phone,
    address1: mapped.address1,
    city: mapped.city,
    postalCode: mapped.postalCode,
    jobberClientId: mapped.jobberClientId,
  });
  const linkId = await upsertCustomerLink({
    jobber_client_id: client.id,
    ghl_contact_id: contact.id,
    match_method: ghlId ? "jobber_authoritative_update" : "jobber_create",
    verified: true,
    last_jobber_revision: JSON.stringify({ email, phone, name: client.name }),
  });
  const supabaseWrite = getSupabaseAdmin();
  for (const property of client.clientProperties?.nodes ?? []) {
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
  if (!ghlId || ghlId === "unknown") return;
  const live = await getGhlContact(ghlId);
  const email = normalizeEmail(String(payload.email ?? live?.email ?? ""));
  const phone = normalizePhone(String(payload.phone ?? live?.phone ?? ""));
  const firstName = String(payload.firstName ?? payload.first_name ?? live?.firstName ?? "");
  const lastName = String(payload.lastName ?? payload.last_name ?? live?.lastName ?? "");

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
  if (decision.kind === "provider" && decision.jobberClientId) {
    jobberId = decision.jobberClientId;
  }
  if (!jobberId && (email || phone)) {
    const found = [
      ...(email ? await searchJobberClients(email) : []),
      ...(phone ? await searchJobberClients(phone.replace("+1", "")) : []),
    ];
    const ids = [...new Set(found.map((c) => c.id))];
    if (ids.length === 1) jobberId = ids[0];
    if (ids.length > 1) {
      await openConflict({
        eventId: event.id,
        entityType: "customer",
        entityId: ghlId,
        reason: "ambiguous_jobber_search",
        details: { candidateIds: ids },
      });
      return;
    }
  }
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
      phone: normalizePhone(authoritative?.phones?.[0]?.number) ?? undefined,
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
  if (!isJobberEncodedId(jobId)) return;
  const job = await fetchJobberJob(jobId);
  if (!job) return;
  const existing = await findJobLink({ jobberJobId: job.id });
  if (existing?.ghl_opportunity_id) {
    await upsertJobLink({
      jobber_job_id: job.id,
      last_job_status: job.jobStatus,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  let ghlContactId: string | undefined;
  if (job.client?.id) {
    const { data } = supabase
      ? await supabase
          .from("customer_links")
          .select("ghl_contact_id")
          .eq("jobber_client_id", job.client.id)
          .maybeSingle()
      : { data: null };
    ghlContactId = data?.ghl_contact_id ?? undefined;
  }

  const stageId = jobClosed(job.jobStatus)
    ? STM_GHL.jobCompletedStageId
    : STM_GHL.jobScheduledStageId;

  if (ghlContactId) {
    const opps = await searchGhlOpportunities(ghlContactId);
    const pipelineOpps = opps.filter((o) => o.pipelineId === STM_GHL.salesPipelineId);
    if (pipelineOpps.length > 1) {
      await openConflict({
        eventId: event.id,
        entityType: "job",
        entityId: job.id,
        reason: "ambiguous_opportunity_match",
        details: { candidateIds: pipelineOpps.map((o) => o.id) },
      });
      await upsertJobLink({
        jobber_job_id: job.id,
        last_job_status: job.jobStatus,
      });
      return;
    }
    if (pipelineOpps.length === 1) {
      await upsertJobLink({
        jobber_job_id: job.id,
        ghl_opportunity_id: pipelineOpps[0]!.id,
        last_job_status: job.jobStatus,
      });
      return;
    }
    assertPilotWrite("jobber.job.create_opportunity", {
      jobberJobId: job.id,
      ghlContactId,
      creatingGhlOpportunity: true,
    });
    const opp = await createOpportunity({
      contactId: ghlContactId,
      name: job.title || job.jobNumber || `Jobber ${job.id}`,
      stageId,
    });
    await upsertJobLink({
      jobber_job_id: job.id,
      ghl_opportunity_id: opp.id,
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
  const env = getEnv();
  const supabase = getSupabaseAdmin();
  const id = event.providerEntityId ?? event.id;
  const live =
    kind === "quote"
      ? isJobberEncodedId(id)
        ? await fetchJobberQuote(id)
        : null
      : isJobberEncodedId(id)
        ? await fetchJobberInvoice(id)
        : null;
  const status =
    (live && "quoteStatus" in live ? live.quoteStatus : undefined) ??
    (live && "invoiceStatus" in live ? live.invoiceStatus : undefined) ??
    String(event.payload.status ?? event.eventKind);
  const number =
    (live && "quoteNumber" in live ? live.quoteNumber : undefined) ??
    (live && "invoiceNumber" in live ? live.invoiceNumber : undefined);
  const table = kind === "quote" ? "quote_links" : "invoice_links";
  const col = kind === "quote" ? "jobber_quote_id" : "jobber_invoice_id";

  let ghlNoteId: string | null = null;
  const writeFlag = kind === "quote" ? env.ESTIMATE_SYNC_ENABLED : env.INVOICE_SYNC_ENABLED;
  const clientId = live?.client?.id;
  if (writeFlag && clientId) {
    const { data: link } = supabase
      ? await supabase
          .from("customer_links")
          .select("ghl_contact_id")
          .eq("jobber_client_id", clientId)
          .maybeSingle()
      : { data: null };
    if (link?.ghl_contact_id) {
      assertPilotWrite(`jobber.${kind}.ghl_note`, {
        jobberClientId: clientId,
        ghlContactId: link.ghl_contact_id,
      });
      ghlNoteId = await addGhlContactNote(
        link.ghl_contact_id,
        quoteInvoiceNoteBody(kind, { id, number, status })
      );
    }
  }

  await supabase?.from(table).upsert(
    {
      [col]: id,
      last_status: status,
      ghl_reference: ghlNoteId,
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
