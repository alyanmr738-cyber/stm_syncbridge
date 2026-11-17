# STM — ServiceRequest to SyncBridge (DRAFT — do not publish)

Separate from published **STM - SyncBridge Contact Updates Alyan** (`db7ba6bd-3015-4ff6-a1e6-b73eb0ec0073`). This workflow must remain **Draft** until canary authorization.

## Trigger (operator chooses one stable source)

| Option | When to use | Stable `serviceRequestId` |
|--------|-------------|---------------------------|
| **A. Opportunity created** | Service intake creates a Sales Pipeline opportunity | `{{opportunity.id}}` |
| **B. Form submitted** | Dedicated “Service Request” form | Form submission id token from GHL builder |
| **C. Manual test** | One internal canary only | Fixed UUID in workflow body (single use) |

**Do not** use Contact Changed / Contact Update triggers for this workflow.

## Workflow steps

1. **Name:** `STM — ServiceRequest to SyncBridge`
2. **Trigger:** per table above — scoped to test pipeline/form only.
3. **Action:** Custom Webhook — POST `https://stmsyncbridge.vercel.app/api/webhooks/ghl`
4. **Headers:** `Content-Type: application/json`, `X-GHL-Webhook-Secret: <GHL_WEBHOOK_SECRET from Vercel>`
5. **Body (raw JSON):**

```json
{
  "type": "ServiceRequest",
  "locationId": "p7HYMD0h2RScLKL68uj0",
  "contactId": "{{contact.id}}",
  "serviceRequestId": "<SINGLE_STABLE_ID — opportunity.id or form submission id>",
  "serviceKey": "pump-out",
  "intent": "new_service_request",
  "syncEventKey": "sr:{{contact.id}}:<execution-or-submission-id>"
}
```

Replace merge fields via GHL variable picker. **`serviceRequestId`** must match the single value in `CREATION_CANARY_SERVICE_REQUEST_KEYS` at canary time.

## Duplicate prevention

- Unique `syncEventKey` per workflow execution (include execution id when available).
- Business dedupe: `creation_canary_ledger.service_request_key` + `job_links.source_booking_key`.

## Pre-publish checklist

- [ ] SyncBridge production SHA ≥ `c91d09e` (lint fix: `594ba59`).
- [ ] Supabase migration `0008` applied on `bevweuqllbvpombsqqzu`.
- [ ] Delivery probe: `APP_BASE_URL=https://stmsyncbridge.vercel.app node scripts/ghl-webhook-delivery-probe.mjs` with ServiceRequest JSON (`process_outcome` = `local_state_only` while canary off).
- [ ] Workflow saved as **Draft** only.

## Published workflow status

**Not published.** Contact Updates workflow unchanged.