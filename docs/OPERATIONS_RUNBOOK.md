# Operations runbook — SyncBridge

## URLs

- App: https://stmsyncbridge.vercel.app
- Login: `/login`
- Jobber callback: `/api/oauth/jobber/callback`
- Jobber webhooks: `/api/webhooks/jobber`
- Queue worker: `GET/POST /api/internal/process-queue` (Bearer `CRON_SECRET` or HMAC)

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

## Rollback

Vercel → previous Ready deployment → Promote. Keep gates A/B/C false.

## Webhooks

HMAC `X-Jobber-Hmac-SHA256` over raw body. URL must match production exactly. Add CLIENT_CREATE/UPDATE if missing.
