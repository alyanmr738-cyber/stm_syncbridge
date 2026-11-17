# Service request → Jobber job — one-contact canary (NOT ACTIVE)

**Do not set `CREATION_CANARY_ENABLED=true` until explicit operator authorization.**

Production baseline SHA: deploy this doc’s commit with creation **still disabled**.

## Designated test records (placeholders — set at activation)

| Role | ID | Notes |
|------|-----|--------|
| GHL contact | `_REPLACE_WITH_INTERNAL_TEST_CONTACT_` | Internal-only; not Evan production fixture unless re-approved |
| Service request key | `_REPLACE_WITH_SINGLE_OPPORTUNITY_OR_FORM_ID_` | Stable id sent as `serviceRequestId` in webhook JSON |
| Jobber client | Reuse if verified link exists; else **one** create if `CREATION_CANARY_ALLOW_NEW_CLIENT=true` |
| Jobber job | **One** new job titled `GHL: <serviceKey>` — status **not** auto-confirmed |

## GHL event source

1. **Trigger:** New workflow (draft until canary authorized) or manual Custom Webhook step on the **single** test opportunity/form submission.
2. **URL:** `POST https://stmsyncbridge.vercel.app/api/webhooks/ghl`
3. **Header:** `X-GHL-Webhook-Secret: <GHL_WEBHOOK_SECRET>`
4. **Body (minimum):**

```json
{
  "type": "ServiceRequest",
  "contactId": "_REPLACE_WITH_INTERNAL_TEST_CONTACT_",
  "serviceRequestId": "_REPLACE_WITH_SINGLE_OPPORTUNITY_OR_FORM_ID_",
  "serviceKey": "pump-out",
  "intent": "new_service_request",
  "syncEventKey": "canary-req-001-v1"
}
```

Use a **new** `syncEventKey` per deliberate retry; duplicates with the same key dedupe at `sync_events (source, provider_event_key)`.

## Required contact / request fields

- Contact: `firstName`, `lastName`, `email` or `phone`, location `p7HYMD0h2RScLKL68uj0`
- Request: `serviceRequestId`, `serviceKey`, `intent` = `new_service_request`
- Optional: `opportunityId` for `job_links.ghl_opportunity_id` audit only (no new opp create)

## Expected Jobber behavior

- **Client:** Reuse encoded client id from verified `customer_links` when present; otherwise at most **one** `clientCreate` inside the canary window.
- **Job:** At most **one** `jobCreate` with `clientId` + title — **no** visit schedule, **no** technician assignment, **no** customer SMS.
- **State:** `job_links.last_job_status` = `pending_jobber_confirmation` until staff schedules in Jobber UI.

## Production env (canary block — copy verbatim, leave DISABLED)

```bash
ALLOW_RECORD_CREATION=false
BOOKING_SYNC_ENABLED=false
CREATION_CANARY_ENABLED=false
CREATION_CANARY_GHL_CONTACT_ID=_REPLACE_WITH_INTERNAL_TEST_CONTACT_
CREATION_CANARY_SERVICE_REQUEST_KEYS=_REPLACE_WITH_SINGLE_OPPORTUNITY_OR_FORM_ID_
CREATION_CANARY_NOT_BEFORE=2099-01-01T00:00:00Z
CREATION_CANARY_NOT_AFTER=2099-01-02T23:59:59Z
CREATION_CANARY_MAX_CLIENTS=1
CREATION_CANARY_MAX_JOBS=1
CREATION_CANARY_ALLOW_NEW_CLIENT=true
```

Activation requires setting `CREATION_CANARY_ENABLED=true` and a **short** `NOT_BEFORE` / `NOT_AFTER` window (e.g. 30 minutes).

## Allowed provider writes (when canary ON)

| Call site | Max count |
|-----------|-----------|
| `createJobberClient` | 1 |
| `createJobberJob` | 1 |
| `upsertGhlContact` | jobberClientId field only on success |

All other contacts/requests: `local_state_only` or `suppressed_feature` — zero Jobber creates.

## GHL reconciliation

- On success: Jobber Client ID custom field updated on the test contact only.
- No opportunity stage changes, no calendar confirmations, no review workflows.

## Duplicate detection

1. Inbound: `provider_event_key` from `syncEventKey` / workflow execution id.
2. Business: `job_links.source_booking_key` = `serviceRequestId` — second delivery returns `no_change` if `jobber_job_id` already set.

## Recovery (no blind deletes)

1. Set `CREATION_CANARY_ENABLED=false` (canary off independent of reconciliation).
2. Inspect `creation_canary_ledger` for `service_request_key` and states `reconciliation_required` / `creating`.
3. Run recovery planner (`planCanaryRecovery` / admin UI when wired): reconcile against Jobber **search** before any retry.
4. **Preserve** `jobber_client_id` / `jobber_job_id` on the ledger; resume job step only when client id is confirmed.
5. **Do not** delete `customer_links` / `job_links` or archive Jobber records without explicit operator approval.
6. See `docs/JOBBER_CREATION_SCHEMA.md` if job create fails for missing `propertyId`.

## Safe cleanup (only after explicit approval)

Archive Jobber entities only after confirming ids from ledger + Jobber UI match. Then remove test `job_links` / optional `customer_links` (`match_method=service_request_canary_create`). Evan fixture and quarantined OAuth events stay untouched.

## Rollback

- Disable canary env vars; redeploy prior SHA `5c1a375` if needed.
- No migration required for canary ledger (in-process counters; persistence via `job_links` + `sync_conflicts`).