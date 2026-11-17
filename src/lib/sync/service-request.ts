/** Pure planning for GHL service-request → Jobber job (no provider I/O). */

export type ServiceRequestIntent =
  | "new_service_request"
  | "reschedule"
  | "additional_visit";

export type ParsedServiceRequest = {
  contactId: string;
  serviceRequestKey: string;
  intent: ServiceRequestIntent;
  ghlOpportunityId?: string;
  ghlAppointmentId?: string;
  serviceKey?: string;
  propertyReference?: string;
  existingJobberJobId?: string;
  notes?: string;
};

export type ServiceRequestPlan =
  | { action: "duplicate"; priorLinkId?: string }
  | { action: "blocked_ambiguous"; reason: string; candidateIds?: string[] }
  | { action: "blocked_unverified"; reason: string }
  | { action: "pending_review"; reason: string }
  | {
      action: "reuse_existing_client";
      jobberClientId: string;
      customerLinkId?: string;
      createJob: boolean;
    }
  | {
      action: "create_client_then_job";
      createClient: true;
      createJob: boolean;
    }
  | {
      action: "additional_visit";
      jobberJobId: string;
      createJob: false;
    };

export function parseServiceRequestPayload(
  payload: Record<string, unknown>
): ParsedServiceRequest | null {
  const contactId = String(
    payload.contactId ?? payload.ghlContactId ?? payload.contact_id ?? ""
  ).trim();
  const serviceRequestKey = String(
    payload.serviceRequestId ??
      payload.serviceRequestKey ??
      payload.requestId ??
      payload.opportunityId ??
      payload.appointmentId ??
      ""
  ).trim();
  if (!contactId || !serviceRequestKey) return null;

  const rawIntent = String(payload.intent ?? payload.requestType ?? "").toLowerCase();
  let intent: ServiceRequestIntent = "new_service_request";
  if (/reschedule|resched/.test(rawIntent)) intent = "reschedule";
  else if (/additional|extra|follow.?up|visit/.test(rawIntent)) intent = "additional_visit";

  return {
    contactId,
    serviceRequestKey,
    intent,
    ghlOpportunityId: String(payload.opportunityId ?? "").trim() || undefined,
    ghlAppointmentId: String(payload.appointmentId ?? "").trim() || undefined,
    serviceKey: String(payload.serviceKey ?? payload.service ?? "").trim() || undefined,
    propertyReference:
      String(payload.propertyId ?? payload.addressId ?? "").trim() || undefined,
    existingJobberJobId:
      String(payload.jobberJobId ?? payload.existingJobId ?? "").trim() || undefined,
    notes: String(payload.notes ?? payload.description ?? "").trim() || undefined,
  };
}

export function planServiceRequest(opts: {
  parsed: ParsedServiceRequest;
  match:
    | { kind: "linked"; customerLinkId: string; verified: boolean; jobberClientId?: string }
    | { kind: "provider"; jobberClientId?: string; ghlContactId?: string }
    | { kind: "create" }
    | { kind: "ambiguous"; candidateIds: string[] };
  existingJobLinkId?: string;
  verifiedJobberClientId?: string;
}): ServiceRequestPlan {
  const { parsed } = opts;
  if (opts.existingJobLinkId) {
    return { action: "duplicate", priorLinkId: opts.existingJobLinkId };
  }

  if (opts.match.kind === "ambiguous") {
    return {
      action: "blocked_ambiguous",
      reason: "uncertain_customer_identity",
      candidateIds: opts.match.candidateIds,
    };
  }

  if (parsed.intent === "additional_visit" && parsed.existingJobberJobId) {
    return {
      action: "additional_visit",
      jobberJobId: parsed.existingJobberJobId,
      createJob: false,
    };
  }

  if (parsed.intent === "reschedule") {
    return {
      action: "pending_review",
      reason: "reschedule_requires_staff_confirmation",
    };
  }

  if (opts.match.kind === "linked") {
    if (!opts.match.verified || !opts.match.jobberClientId) {
      return { action: "blocked_unverified", reason: "customer_link_not_verified" };
    }
    return {
      action: "reuse_existing_client",
      jobberClientId: opts.match.jobberClientId,
      customerLinkId: opts.match.customerLinkId,
      createJob: parsed.intent === "new_service_request",
    };
  }

  if (opts.match.kind === "provider" && opts.match.jobberClientId) {
    if (opts.verifiedJobberClientId && opts.verifiedJobberClientId !== opts.match.jobberClientId) {
      return {
        action: "blocked_ambiguous",
        reason: "customer_exists_under_another_identity",
        candidateIds: [opts.match.jobberClientId, opts.verifiedJobberClientId],
      };
    }
    return {
      action: "reuse_existing_client",
      jobberClientId: opts.match.jobberClientId,
      createJob: parsed.intent === "new_service_request",
    };
  }

  return {
    action: "create_client_then_job",
    createClient: true,
    createJob: parsed.intent === "new_service_request",
  };
}

export const JOBBER_JOB_CREATE_LIMITATION =
  "JobCreateInput schema is account-specific and unproven in production GraphQL introspection; jobs are created with clientId/title only — no automatic visit or availability reservation.";