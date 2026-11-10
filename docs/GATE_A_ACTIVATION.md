# Gate A activation sheet (not executed)

Gates **A / B / C remain OFF**. Do not apply the env block below until you explicitly approve activation. Z7 stays running until you authorize a pause.

## 1. Job completion integrity

`syncJobClosed` reads the live Jobber job when the id is an encoded Jobber GID. GHL stage **Job Completed** (`1724dc1d-02f1-422c-825f-bebb9d427e71`) runs only if that live `jobStatus` matches `closed` / `complete` / `done` **and** `JOB_COMPLETION_SYNC_ENABLED=true`.

A `JOB_CLOSED` webhook while Jobber still reports `today` is a no-op (link `last_job_status` only). If Jobber fetch returns nothing, payload `jobStatus` is ignored.

Evan Test moved opportunity `WzfYXayDHWd48HFEQYR9` with a synthetic event. Jobber job **8128** (`162716111`) was **`today`**, not closed.

## 2. Webhook deduplication

The HTTP **409** during Evan tests was **PostgREST** on a unique `sync_events` key (internal insert path), **not** `POST /api/webhooks/jobber`.

Public Jobber webhook: HMAC → `persistAndEnqueue` → always **200** `{ received: true }` if the row is durable. Duplicates: existing row or `23505` race → `queued: false`, no second enqueue, no 409/503. Invalid HMAC is 401; undurable insert is 503.

## 3. Current production posture (until you approve Gate A)

Keep all of these **false** (or unset):

```
SYNC_ENABLED=false
OUTBOUND_WRITES_ENABLED=false
ALLOW_RECORD_CREATION=false
HISTORICAL_IMPORT_ENABLED=false
CUSTOMER_MESSAGING_ENABLED=false
REVIEW_TRIGGER_ENABLED=false
BOOKING_SYNC_ENABLED=false
ESTIMATE_SYNC_ENABLED=false
INVOICE_SYNC_ENABLED=false
AI_SUMMARY_SYNC_ENABLED=false
JOB_COMPLETION_SYNC_ENABLED=false
EMERGENCY_AUTO_BOOK_ENABLED=false
PILOT_EXISTING_RECORDS_ONLY=true
```

Pilot lists may remain from Evan tests; they do **not** turn Gate A on.

## 4. Intended first Gate A env (apply only after approval)

Event-driven, existing matches only. No backfill, no bulk creates, no messages, no auto booking confirm. Quote / invoice / review / AI notes stay off until separate validation.

```
SYNC_ENABLED=true
OUTBOUND_WRITES_ENABLED=true
ALLOW_RECORD_CREATION=false
HISTORICAL_IMPORT_ENABLED=false
CUSTOMER_MESSAGING_ENABLED=false
REVIEW_TRIGGER_ENABLED=false
BOOKING_SYNC_ENABLED=false
ESTIMATE_SYNC_ENABLED=false
INVOICE_SYNC_ENABLED=false
AI_SUMMARY_SYNC_ENABLED=false
JOB_COMPLETION_SYNC_ENABLED=true
EMERGENCY_AUTO_BOOK_ENABLED=false
PILOT_EXISTING_RECORDS_ONLY=true
PILOT_GHL_ALLOWED_FIELDS=jobberClientId
```

Optional short soak: keep typed `PILOT_*` to Evan Test only, then clear to run all uniquely matched existing records.

Vercel: team **allaccessdigital**, project **stm_syncbridge**, Production env, then Redeploy Production. `APP_BASE_URL=https://stmsyncbridge.vercel.app`. Cron already `* * * * *` → `/api/internal/process-queue` with `CRON_SECRET`.

## 5. Expected record changes after Gate A (not now)

- Unique Jobber CLIENT_UPDATE → GHL PUT identity + Jobber Client ID field `saS3lqgdYaw8RPz95NZd`.
- Linked GHL ContactUpdate → Jobber `clientEdit` → GHL from Jobber.
- Jobber JOB_UPDATE → attach existing opportunity; no create while `ALLOW_RECORD_CREATION=false`.
- Live Jobber closed/complete/done → GHL Job Completed.
- Unmatched / ambiguous → `conflicts`, no create.
- Bookings stay `pending_jobber_confirmation`.

## 6. Z7 cutover (authorized separately)

Pause **STM – Z7 – Contact Update to Zapier** in GHL UI only when you say so. Rollback: republish Z7. **Keep Workflow 1 — New Lead.** Do not pause Z7 under this sheet.

## 7. Monitor after deploy (integrity build) and after Gate A

- `GET https://stmsyncbridge.vercel.app/api/health` — `ok`, `queueScheduler: webhook-drain+minute-cron`, gates false until activation; after activation `outboundWrites` true, `jobCompletionSync` true, historical/messaging/estimate/invoice/review false.
- `/activity` — no new unexplained dead letters.
- `customer_links` / `job_links` — Evan pair only until Gate A; then only uniquely matched existing ids.
- GHL identity fields unchanged except Jobber Client ID unless Gate A + identity writes are in scope.
- `review_deliveries.status` must not become `sent`.

## 8. Rollback

1. Vercel Production: `OUTBOUND_WRITES_ENABLED=false` (and `SYNC_ENABLED=false` if needed). Redeploy.
2. Previous Ready git deploy on `stm_syncbridge`.
3. If Z7 was paused, republish Z7.
4. Do not reverse Evan Test opportunity stage unless you authorize it.

## 9. Evan Test leftover (do not change without authorization)

| Record | Id | Status |
|--------|----|--------|
| GHL contact | `Oz6ZOxZUXGs48oAqKxE2` | evan@allaccessdigital.net · +17728122183 |
| GHL opportunity | `WzfYXayDHWd48HFEQYR9` | Stage **Job Completed** (`1724dc1d-02f1-422c-825f-bebb9d427e71`) from synthetic test — **leave it** |
| Jobber client (canonical) | GID `Z2lkOi8vSm9iYmVyL0NsaWVudC8xNTg5Nzg4MzY=` · UI `158978836` | Keep |
| Jobber job 8128 | GID `Z2lkOi8vSm9iYmVyL0pvYi8xNjI3MTYxMTE=` · UI `162716111` | Status **today** (not closed) |
| Duplicate Jobber client | UI `158979457` | **Do not archive** |
| Alex contact (earlier field test) | `6fphEggI2IDws4TlmD6Q` | Custom field only; `verified=false` |

## 10. Approvals still required

1. Deploy this integrity build (job-close live-status + webhook 2xx duplicates) if not already on Production.
2. Gate A env set in section 4 + Production redeploy.
3. Pause Z7 (recommended with Gate A, not required by this instruction).
4. `ALLOW_RECORD_CREATION=true` later.
5. Gate B historical.
6. Gate C / reviews.
7. Quote / invoice / AI notes.
8. Archive duplicate Jobber client `158979457`.
9. Restore or leave Evan opportunity stage.
