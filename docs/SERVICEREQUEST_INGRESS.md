# ServiceRequest ingress readiness (not ContactUpdate)

## Current production paths

| Path | Auth | Event kinds | ServiceRequest? |
|------|------|-------------|-----------------|
| `POST /api/webhooks/ghl` | `X-GHL-Webhook-Secret` or Bearer | Parsed by `parseGhlWebhookPayload` | **Only** when body includes `serviceRequestId`, `serviceRequestKey`, or `requestId`, or explicit `type: ServiceRequest` |
| Published workflow **STM - SyncBridge Contact Updates Alyan** (`db7ba6bd-3015-4ff6-a1e6-b73eb0ec0073`) | Same secret | `ContactUpdate` | **No** — contact field changes only |

Contact Changed workflow delivery is **not** proof of ServiceRequest handling. Do not use contact updates as service requests.

## Required dedicated delivery

Before live canary, publish a **separate** workflow (recommend **draft until canary approved**) that fires **only** on the service-request trigger you choose (e.g. pipeline stage, form submit, custom object) and posts **Custom Webhook**:

```json
{
  "type": "ServiceRequest",
  "locationId": "p7HYMD0h2RScLKL68uj0",
  "contactId": "<authorized internal test contact>",
  "serviceRequestId": "<single stable id — opportunity id or form submission id>",
  "serviceKey": "pump-out",
  "intent": "new_service_request",
  "syncEventKey": "stm-sr-<stable>-v1"
}
```

## Stable request ID

| Source | Recommended field | Dedup |
|--------|-------------------|--------|
| Opportunity created for service | `opportunity.id` as `serviceRequestId` | `sync_events.provider_event_key` + `job_links.source_booking_key` |
| Form submission | GHL submission id | Same |
| Manual test | Fixed UUID in workflow body | `syncEventKey` must change only for intentional retries |

## Duplicate delivery

1. **HTTP layer:** duplicate `provider_event_key` → `409` / no re-queue (existing inbox).
2. **Business layer:** `creation_canary_ledger.service_request_key` unique + `job_links.source_booking_key`.
3. **Canary budget:** `creation_canary_global_slots` allows at most one client and one job globally.

## Verification checklist (pre-canary)

- [ ] New workflow built; **not** wired to all leads.
- [ ] Probe `scripts/ghl-webhook-delivery-probe.mjs` with `APP_BASE_URL=https://stmsyncbridge.vercel.app` and sample ServiceRequest JSON.
- [ ] Confirm `sync_events.event_kind = ServiceRequest` and handler outcome `local_state_only` while canary disabled.
- [ ] Confirm Contact Update still maps to `ContactUpdate` only (regression test `tests/ghl-inbound.test.ts`).

## Migration dependency

Apply `supabase/migrations/0008_creation_canary_ledger.sql` before enabling canary in production (durable budget enforcement).