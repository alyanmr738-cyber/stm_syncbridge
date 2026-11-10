# SyncBridge GO / NO-GO — 2026-11-10

**Verdict: CONDITIONAL GO for infrastructure. NO-GO for unrestricted live sync (Gates A/B/C remain OFF).**

Authorized live writes were **not** run. A record-scoped `PILOT_ENTITY_IDS` control exists so Gate A does not need to be flipped for a future named-record pilot.

## 1. Deployment

| Item | Evidence |
|------|----------|
| Production URL | `https://stmsyncbridge.vercel.app` |
| Health | `GET /api/health` **200**, all flags and gates **false** |
| Git at this work | successor of `8d6eb3d` (cron GET + CRON_SECRET) |
| Worker | `GET /api/internal/process-queue` without auth **401**; with Bearer `CRON_SECRET` **200** |
| Worker body (after signed webhook) | `{"processed":1,"stats":{"pending":0,"leased":0,"deadLetter":0}}` |

Hobby cron still may not fire `* * * * *`. Manual GET with the bearer proved execution. Confirm Vercel plan if you need automatic every-minute runs.

## 2. Queue execution evidence

Signed Jobber HMAC POST to production:

- Route **200** `{ received: true }`
- `sync_events` id `5b3c8640-d541-498d-a890-8abef85c7d83`
- Kind `CLIENT_UPDATE`, entity `phase1-probe-1794328178772` (synthetic probe, not a customer)
- `queue_jobs` id `ebe01275-2be5-4337-bcda-6213fc285cc6` **completed**, attempt 0
- Event processed; writes blocked by Gate A (expected)

Dashboard reads the same `sync_events` / `queue_jobs` / `sync_conflicts` tables.

## 3. Connection and token refresh

| Item | Evidence |
|------|----------|
| Jobber account | `Z2lkOi8vSm9iYmVyL0FjY291bnQvMjQ1MDQ1` **Septic Tank Man** |
| Status | `connected` |
| Refresh | `grant_type=refresh_token` succeeded; **refresh token rotated**; new expiry `2026-11-10T17:29:36.811Z`; persist to `sync_connections` **ok** |
| GraphQL | `account { id name }` matches DB |
| API version | App pinned `2025-01-20`. Jobber warns this version is unsupported; latest cited `2026-11-03`. Do not bump in this change without a mutation re-audit. |
| GHL | Location `p7HYMD0h2RScLKL68uj0` **Septic Tank Man**, tz `America/New_York` |

`CLIENT_CREATE` / `CLIENT_UPDATE` **App Center subscriptions** are still not visible via API (`webHookEvent` query exists; subscription list not proven). Our URL accepts Jobber HMAC. Operator must confirm both topics in Jobber Developer Center.

## 4. Verified Jobber / GHL mappings (revalidated live)

- GHL location `p7HYMD0h2RScLKL68uj0`
- Sales Pipeline `UMelQ0AisTqWdPl1XHK6`
- Job Completed `1724dc1d-02f1-422c-825f-bebb9d427e71`
- Job Scheduled `c6fb20fd-a318-450c-97ce-d1a067f3d6c9`
- Do not use calendar `Xys7KBfpx40InGkeACLX` (Pumping - RETIRED)
- Not Arizona Sign Company

Jobber availability: schema has `scheduledItems`, `visitEditSchedule`, `appointmentEditSchedule`. **No proven slot-reservation API.** Bookings stay `pending_jobber_confirmation`.

## 5. Tests and live checks

Automated: worker auth, overlap, DLQ, identity, gates, booking pending, pilot allowlist.

Live:

| Test | Result |
|------|--------|
| Cron GET auth | Pass (401 / 200) |
| Signed Jobber webhook → inbox → claim → process | Pass |
| Token refresh + persist + GraphQL | Pass |
| GHL pipelines/stages revalidate | Pass |
| GHL webhook unsigned | **200** — `GHL_WEBHOOK_SECRET` / public key **not set**; fail-open until configured |
| Real customer/job provider writes | **Not run** (no named pilot ids, Gate A off) |
| Duplicate Jobber jobs / merges | Code: reuse `job_links`; ambiguous match → conflict. Not soak-tested live. |
| Customer messages | Gate C off; completion writes `review_deliveries` as `suppressed` |

## 6. Remaining blockers

1. Named pilot customer/job IDs (written approval). Then set `PILOT_ENTITY_IDS` only — **do not** set `OUTBOUND_WRITES_ENABLED=true`.
2. Confirm Jobber App Center `CLIENT_CREATE` and `CLIENT_UPDATE`.
3. Set `GHL_WEBHOOK_SECRET` (or Ed25519 public key) and GHL workflow URL to send it.
4. GHL UI automation audit (nurture / review stages).
5. Vercel plan vs minute cron.
6. Jobber GraphQL version upgrade plan.
7. Voice AI calendar choice among the three active calendars.

## 7. What each gate enables

| Gate | Env | Enables | Does not enable |
|------|-----|---------|-----------------|
| **A** | `SYNC_ENABLED=true` and `OUTBOUND_WRITES_ENABLED=true` | Unrestricted Jobber/GHL record writes (clients, jobs, opportunities, notes) for **all** events | Backfill; customer SMS/email/review send |
| **Pilot (not a gate)** | `PILOT_ENTITY_IDS=id1,id2` | Writes **only** when every entity id on the event is listed | Does not turn on A/B/C |
| **B** | `HISTORICAL_IMPORT_ENABLED=true` | Bulk historical import | Ongoing sync, messaging |
| **C** | `CUSTOMER_MESSAGING_ENABLED=true` plus `REVIEW_TRIGGER_ENABLED=true` | One review authorization row per Jobber job may dispatch | Creating/updating CRM records |

Keep B and C **OFF** for any technical pilot.

## 8. Rollback and monitoring

- **Rollback writes:** set `OUTBOUND_WRITES_ENABLED=false`, `PILOT_ENTITY_IDS=` empty, `SYNC_ENABLED=false`; redeploy. Promote previous Ready deployment if needed.
- **Rollback tokens:** reconnect Jobber OAuth in admin if refresh fails (`reauthorization_required`).
- **Monitor:** `/api/health` flags; Overview queue pending/leased/dead; Activity `suppressed` vs `dead_letter`; Conflicts `pending_jobber_confirmation`; Reviews `suppressed`.

**Not fully live:** production processed a signed probe event and **did not** write Jobber or GHL customer records. Synchronization code is in-repo and gated.
