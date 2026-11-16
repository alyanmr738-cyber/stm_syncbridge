# Operations runbook — SyncBridge

## URLs

- App: https://stmsyncbridge.vercel.app
- Login: `/login`
- Jobber callback: `/api/oauth/jobber/callback`
- Jobber webhooks: `/api/webhooks/jobber`
- Queue worker: `GET/POST /api/internal/process-queue` (Bearer `CRON_SECRET` or HMAC)
- Scheduler: webhook `after()` drain + minute cron `* * * * *` (Vercel Pro). See `docs/SCHEDULING_AND_CRON.md`.

## Reconnect Jobber

1. Settings → Connections → Connect / Reconnect Jobber.
2. Septic Tank Man Jobber admin Allow.
3. Confirm account name + encoded ID.
4. If refresh failed: status `reauthorization_required`.

## Token expiry

Access tokens ~60 minutes. App refreshes with lock + rotated refresh token persist. If Jobber invalidates refresh (GraphiQL Test on same app), reconnect.

## Replay failed sync

1. Activity → dead_letter rows.
2. After fixing cause, insert is not auto-replayed; operator can POST process-queue after setting event status back to `queued` in Supabase (service role). Confirm idempotency keys.

## Conflicts

Settings not required — `/conflicts`. Ambiguous customers stay unlinked.

## Queue / DB outage

Webhook returns **503** if persist fails (Jobber will retry). Do not ack without durability.

## Credential rotation

1. Rotate Jobber Client Secret → update Vercel `JOBBER_CLIENT_SECRET` → reconnect OAuth (old refresh tokens die).
2. Rotate GHL PIT → update env → health `/api/health/ghl`.
3. Rotate `TOKEN_ENCRYPTION_KEY_BASE64` only with a migration plan (existing blobs become unreadable).
4. Rotate `ADMIN_SESSION_SECRET` logs everyone out.

## Launch gates (remain OFF until written approval)

| Gate | Env | Effect |
|------|-----|--------|
| A | `SYNC_ENABLED` + `OUTBOUND_WRITES_ENABLED` | All Jobber/GHL record writes |
| Pilot | `PILOT_JOBBER_CLIENT_IDS` / `PILOT_GHL_CONTACT_IDS` / `PILOT_JOBBER_JOB_IDS` / `PILOT_GHL_OPPORTUNITY_IDS` | Writes only for those ids; **not** Gate A |
| B | `HISTORICAL_IMPORT_ENABLED` | Historical execute (dry-run never writes) |
| C | `CUSTOMER_MESSAGING_ENABLED` + `REVIEW_TRIGGER_ENABLED` | Review/customer messages |

Booking stays `pending_jobber_confirmation` until Jobber reservation is proven.

## Rollback

Vercel → previous Ready deployment → Promote. Keep gates A/B/C false. Clear `PILOT_*`.

## Webhooks

HMAC `X-Jobber-Hmac-SHA256` over raw body. URL must match production exactly.

CLIENT_CREATE and CLIENT_UPDATE were registered 2026-11-10 via `webhookEndpointCreate` to the production Jobber webhook URL.

GHL: require `X-GHL-Signature` (Ed25519, Marketplace OAuth apps only), legacy `X-WH-Signature` (RSA), or workflow `X-GHL-Webhook-Secret` / Bearer matching `GHL_WEBHOOK_SECRET`. Unsigned requests are rejected. Private Integration tokens do **not** emit Marketplace webhooks—use workflow Custom Webhook (see below).

### GHL → SyncBridge contact updates (workflow, not Marketplace)

1. Create draft workflow **`STM — SyncBridge Contact Updates`** (do not publish without operator approval).
2. **Trigger:** Contact Changed — use filters on **Email** and/or **Phone** when possible; for **last name**-only staff edits, use Contact Changed **without** a field filter, then an **If/Else** on standard fields (Last Name / First Name changed).
3. **Only action:** Custom Webhook **POST** `https://stmsyncbridge.vercel.app/api/webhooks/ghl`, Content-Type `application/json`, header `X-GHL-Webhook-Secret` (value from Vercel `GHL_WEBHOOK_SECRET` only; never commit).
4. JSON body must include `locationId`, `contactId`, `type: ContactUpdate`, and a unique `syncEventKey` using supported picker variables (e.g. `{{contact.id}}` plus workflow run id if available in your UI). SyncBridge re-fetches the live contact; **loop suppression is revision-based in code**, not a permanent GHL custom-field filter.
6. Keep **Z7** and **Workflow 4** draft; do not add SMS/email/tags/opportunity steps.

Activity dead-letter rows: use Retry (admin session) → `POST /api/admin/queue/retry`.
