# Data model, ownership, and matching

## Entity mapping

| GHL | Jobber | Internal mapping |
|---|---|---|
| Location | Account | connected_account |
| Contact | Client | customer_link |
| Contact service address / custom fields | Property | property_link |
| Opportunity (one per service job) | Job | job_link |
| Calendar appointment | Visit | appointment_link |
| Quote status custom field / triggers | Quote | quote_link |
| Invoice status custom field / triggers | Invoice | invoice_link |
| AI call or conversation summary | Client/job note | note_delivery |

Use `spec/field_mapping.csv` as working mapping document. Every field has source-of-truth, transform, direction, exact API field, and permission verification.

## Match order

1. Existing verified native mapping (highest confidence).
2. Provider cross-reference ID retained in a custom field when provider actually supports it.
3. Exact normalized unique email and phone plus compatible property/address when relevant; handle multiple emails/phones.
4. If no plausible match, create separate entity and store mapping. **If multiple plausible matches, do not auto-create a third copy**; queue for admin review.
5. Never merge customer records solely on name; never assume primary billing address equals property serviced.

Jobber is master for verified customer and property values. GHL is master for lead source, communication preferences and automation stages, except where Jobber has relevant opt-out preferences that must be honored.

## Update conflict strategy

- Compare last fetched provider revisions/`updatedAt` or stable fingerprints.
- Per-field authority applies even when GHL event is newer. When Jobber rejects updates, preserve Jobber and surface exception.
- Outbound writes record an origin/fingerprint and expected target state to avoid reflected webhook loops.
- Treat null carefully: absent in GHL must not erase valid Jobber data without explicit authorized clear operation.

## Security

- Dedicated Supabase project; DB primary keys are internal UUIDs. Provider IDs stored as opaque TEXT (Jobber `EncodedId` is not a decimal).
- Credentials stored in encrypted server-only table; never returned to admin browser.
- In a future multi-client version, separate deployments/DBs are preferred; never inadvertently share a customer's data across businesses.
