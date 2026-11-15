# OAuth recovery — production deploy and reconnect

## Deployed fixes

- Distributed refresh lock (`try_acquire_token_refresh_lock`)
- Token generation CAS + revoked vs transient refresh handling
- Queue auth backoff (no refresh retry storms)
- Outage backlog quarantine (`OAUTH_RECOVERY_QUARANTINE_*`)

## Production env (add after deploy)

```dotenv
OAUTH_RECOVERY_QUARANTINE_ENABLED=true
OAUTH_RECOVERY_QUARANTINE_SINCE=2026-11-13T20:09:00.000Z
JOBBER_AUTO_RELEASE_AUTH_BACKOFF=false
```

## Optional: Gate A pause during reconnect (requires approval)

Do **not** set silently. If you want zero GHL writes until token rotation is verified:

```dotenv
OUTBOUND_WRITES_ENABLED=false
```

Leave `SYNC_ENABLED=true` so webhooks still ingest. Re-enable `OUTBOUND_WRITES_ENABLED=true` after Phase 4 token rotation passes.

## Operator reconnect (manual only)

1. Confirm `/api/health` `gitSha` matches OAuth deploy and `tokenRefreshLockRpc` is not `false`.
2. Log into SyncBridge admin → Settings → **Connect Jobber**.
3. Authorize **Septic Tank Man** (allowlisted account only).
4. Do **not** use Jobber Developer GraphiQL for this app.
5. After reconnect, wait one access-token cycle before catch-up or lifting Gate A pause.

## Catch-up (separate approval)

- Dead-letter / retrying events with `received_at >= OAUTH_RECOVERY_QUARANTINE_SINCE` stay quarantined.
- Admin replay requires `allowQuarantineReplay: true` on POST `/api/admin/queue/retry`.
- To release parked auth failures only: set `JOBBER_AUTO_RELEASE_AUTH_BACKOFF=true` temporarily or run a one-off admin task (not default).