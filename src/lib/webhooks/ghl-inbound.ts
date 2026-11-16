/** Normalize GHL workflow Custom Webhook bodies (distinct from Marketplace signed webhooks). */

export type ParsedGhlWebhook = {
  eventKind: string;
  contactId: string | null;
  locationId: string | null;
  providerEventKey: string;
  normalizedPayload: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseGhlWebhookPayload(raw: Record<string, unknown>): ParsedGhlWebhook {
  const contact = asRecord(raw.contact);
  const contactId =
    String(raw.contactId ?? contact?.id ?? raw.id ?? "").trim() || null;
  const locationId =
    String(raw.locationId ?? raw.location_id ?? contact?.locationId ?? "").trim() ||
    null;

  let eventKind = String(raw.type ?? raw.event ?? "").trim();
  if (!eventKind || eventKind === "unknown") {
    const trigger = String(raw.trigger ?? raw.triggerName ?? "").toLowerCase();
    if (/contact/.test(trigger) || contactId) {
      eventKind = "ContactUpdate";
    } else {
      eventKind = "unknown";
    }
  }

  const explicitKey = String(
    raw.syncEventKey ?? raw.eventKey ?? raw.webhookId ?? ""
  ).trim();
  const executionId = String(raw.executionId ?? raw.workflowExecutionId ?? "").trim();
  const providerEventKey =
    explicitKey ||
    (executionId && contactId
      ? `ghl:${eventKind}:${contactId}:${executionId}`
      : `ghl:${eventKind}:${contactId ?? "unknown"}`);

  const normalizedPayload: Record<string, unknown> = {
    ...raw,
    type: eventKind,
    ...(contactId ? { contactId, id: contactId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(contact ? { contact } : {}),
  };

  return {
    eventKind,
    contactId,
    locationId,
    providerEventKey,
    normalizedPayload,
  };
}