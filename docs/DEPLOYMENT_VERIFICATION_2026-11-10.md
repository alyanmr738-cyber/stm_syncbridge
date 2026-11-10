# Deployment verification — 2026-11-10

**Verdict: CONDITIONAL GO for production code + connections. NO-GO for live two-way sync (gates A/B/C off; worker was blocked by middleware until this follow-up).**

Do not call the integration fully live.

## 1. Deployment ID and commit

| Item | Evidence |
|------|----------|
| Git `main` HEAD at verification start | `b61dd42bd2a56b3a126dbf05f09eb674687d9bab` |
| Production URL | `https://stmsyncbridge.vercel.app` |
| `GET /api/health` | HTTP 200 JSON `ok: true`, all gates `false` |
| `GET /login` | HTTP 200 HTML |
| Vercel dashboard SHA | Confirm after this follow-up deploy (worker-auth fix) |

**Follow-up commit** (this verification): middleware allows GET `/api/internal/process-queue`; `CRON_SECRET` required on GET; queue claim is compare-and-swap `pending` only.

## 2. Queue execution evidence

| Check | Result |
|-------|--------|
| `vercel.json` cron | GET `/api/internal/process-queue` every `* * * * *` |
| Production GET unauthenticated | **307 → `/login`** on `b61dd42` (middleware). **Vercel Cron could not run.** Fixed in this change. |
| GET without `CRON_SECRET` | Route now **503** `CRON_SECRET is required` |
| GET with wrong bearer | **401** |
| GET with `Authorization: Bearer $CRON_SECRET` | Authorized (unit-tested) |
| Hobby vs Pro cron | **Vercel Hobby: cron typically once/day, not every minute.** If this project is Hobby, minute schedule is **unsupported**. Use Pro or external GET with bearer. |
| Persist / claim / DLQ | Unit tests: idempotent enqueue, overlapping `processNext`, 8-failure dead-letter. Postgres claim uses `status=pending` CAS + expired-lease reclaim. |
| Cross-deployment recovery | Leased jobs with `leased_until` in the past return to `pending` on next worker tick. **Not proven on Vercel logs** until cron actually fires. |

**Operator:** set Vercel env `CRON_SECRET`, redeploy, then `curl -H "Authorization: Bearer $CRON_SECRET" https://stmsyncbridge.vercel.app/api/internal/process-queue`

## 3. Connection and token-refresh evidence

| Check | Result |
|-------|--------|
| Jobber DB row | `connected`, name **Septic Tank Man** |
| `token_expires_at` | `2026-11-10T17:18:58Z` (refresh path must run before then) |
| Refresh rotation code | Implemented (`src/lib/jobber/tokens.ts`) + lock table `token_refresh_locks` |
| Forced expiry / concurrent refresh | Lock + re-read after wait. **Not soak-tested against live Jobber in this session** (would rotate production refresh token). |
| Revoked credentials | `markJobberDisconnected` on GraphQL 401 |
| Reconnect | Settings → Connect Jobber (existing) |
| Account identity | Matches UI: Septic Tank Man |

## 4. Verified Jobber / GHL mappings

See `docs/ACCOUNT_MAPPING.md` (live GHL 200s).

- Pipeline `UMelQ0AisTqWdPl1XHK6` **Sales Pipeline**
- Completion stage **Job Completed** `1724dc1d-02f1-422c-825f-bebb9d427e71` (not the string "Completed Job")
- Calendars listed; RETIRED pumping calendar must not be used
- GHL tz `America/New_York`; Jobber tz still **unverified**
- Jobber **CLIENT_CREATE / CLIENT_UPDATE** webhooks: **not inspected in Developer Center this session** — operator must confirm they exist (earlier screenshot lacked them)

## 5. Test results

Local: `npm test` after this change (worker auth, queue overlap, gates, HMAC, identity).

Live integration scenarios (writes **not** executed — gate A off):

| Scenario | Result |
|----------|--------|
| New GHL customer → Jobber create | **Not run live** (would be a write). Code: unmatched → create only if A on; else suppressed. |
| Jobber customer → GHL | **Not run live**. |
| Booking → pending | **Pass** (unit + engine pending path) |
| Reschedule no duplicate job | **Pass by policy** (`source_booking_key` unique); **not live-fired** |
| Job completed + review off | **Pass** (C off / suppressed) |
| Duplicate webhook | Unique `(source, provider_event_key)` |
| DB outage | Webhook **503** no ack |
| Dashboard failures/pending/conflicts | Pages read Supabase lists |

## 6. Remaining blockers

1. Worker was not reachable on production GET until this deploy; confirm 200 JSON after promote.
2. `CRON_SECRET` must be set on Vercel (was not verified present).
3. Plan may not support `* * * * *`.
4. Jobber CLIENT_* webhooks unconfirmed.
5. GHL nurture/review automations not audited in GHL UI — risk if A enabled.
6. Jobber timezone / availability GraphQL still unproven → **pending_jobber_confirmation** only.
7. Token refresh not soak-tested live this hour.
8. Approvals A/B/C empty.

## 7. What each gate would enable

| Gate | Env | Would allow |
|------|-----|-------------|
| A | `OUTBOUND_WRITES_ENABLED=true` (+ usually `SYNC_ENABLED`, `BOOKING_SYNC_ENABLED`) | Jobber client/job/visit creates & updates; GHL contact/opportunity writes; **not** customer SMS |
| B | `HISTORICAL_IMPORT_ENABLED=true` | Bulk historical mapping/upserts; still no reviews if C off |
| C | `CUSTOMER_MESSAGING_ENABLED=true` (+ `REVIEW_TRIGGER_ENABLED`) | Review workflow dispatch, quote/invoice reminder sends |

Deployment ≠ permission. `docs/PRODUCTION_APPROVALS.md` still empty.

## 8. Rollback and monitoring

- Vercel → Promote previous Ready (`b61dd42` if this follow-up misbehaves).
- Set all write/message flags `false`.
- Health: `/api/health` flags object.
- Queue: GET process-queue with bearer; Activity + dead_letter.
- Jobber disconnect: Connections status `reauthorization_required`.
- Webhooks: Jobber retries on non-2xx; we return 401 bad HMAC, 503 if not durable.

---

**GO:** keep production serving, connections up, gates off, pending bookings, HMAC webhooks.  
**NO-GO:** automatic Jobber scheduling confirmation, live writes, backfill, reviews.  
**Next operator actions:** set `CRON_SECRET`, redeploy this commit, confirm GET worker 200, add CLIENT webhooks, confirm Vercel plan for cron, then optional A on a **test** Jobber record only after written approval.
