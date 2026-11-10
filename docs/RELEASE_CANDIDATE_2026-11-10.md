# Production release candidate — 2026-11-10

**Overall: CONDITIONAL GO for infrastructure. NO-GO for Gate A (unrestricted), Gate B, Gate C, and for a contact-creating pilot until GHL New Lead workflows are constrained.**

Code successor of `41e6302` (this change). Confirm Vercel Ready on the new commit after push. Health on `41e6302` did not yet include `jobberApiVersion` / `queueScheduler`.

## Deployed evidence (pre-this-commit production)

- App Ready at `https://stmsyncbridge.vercel.app`
- Cron GET with secret: previously **200** `processed` + stats
- Hobby: minute cron **not** a valid automatic schedule — see `SCHEDULING_AND_CRON.md`

## Jobber API version

Live probe of `account { id name }`:

| Header | Result |
|--------|--------|
| 2026-11-03 | **ok**, no warning |
| 2026-09-25 | ok, no warning |
| 2025-04-16 | ok, no warning |
| 2025-01-20 (old pin) | unsupported warning |

App now pins **`2026-11-03`**.

## Webhooks

- Jobber HMAC required (unchanged).
- **Created via API** `webhookEndpointCreate`:
  - `CLIENT_CREATE` → `https://stmsyncbridge.vercel.app/api/webhooks/jobber` (userErrors [])
  - `CLIENT_UPDATE` → same URL (userErrors [])
- GHL: fail-closed. Platform Ed25519 / legacy RSA **or** `GHL_WEBHOOK_SECRET` (workflow HTTP). Unsigned POST must **401** after this deploy (still 200 on `41e6302`).

## Sync (gated)

Handlers: Jobber client → GHL (with property address), GHL contact → Jobber then Jobber-authoritative GHL update, jobs reuse links, completion → Sales Pipeline / Job Completed, quotes/invoices persisted, AI notes hashed, bookings pending.

Typed pilot env: `PILOT_JOBBER_CLIENT_IDS`, `PILOT_JOBBER_JOB_IDS`, `PILOT_GHL_CONTACT_IDS`, `PILOT_GHL_OPPORTUNITY_IDS`. Creating a child requires an approved parent; unlisted destinations are blocked.

## Booking

**pending_jobber_confirmation.** No availability API. New requests ≠ duplicate jobs when `job_links` / booking key exists.

## Automations

See `GHL_AUTOMATION_AUDIT_2026-11-10.md`. Published **Workflow 1 — New Lead**, **STM – I1**, **Z7 Contact Update to Zapier**, **Workflow 4 — Service Completed** block a create-heavy pilot.

## Historical dry-run

See `HISTORICAL_DRY_RUN_2026-11-10.md`. Jobber 7140 clients / 8068 jobs vs GHL 1032 contacts. Gate B off.

## Tests

27 automated tests passed (HMAC, GHL fail-closed, pilot typed lists, queues, gates).

Authorized real-record writes: **not executed** (no approved IDs; automation risk).

## Gate GO/NO-GO

| Gate | Verdict | Authorization still required |
|------|---------|------------------------------|
| A unrestricted writes | **NO-GO** | Written approval after workflow pause/filter |
| Pilot allowlist updates of **existing** linked records | **CONDITIONAL GO** after named IDs + UI confirm Z7 will not SMS | Typed `PILOT_*` env only |
| B historical import | **NO-GO** | Separate plan + approval |
| C customer messaging | **NO-GO** | Consent, opt-out, workflow review |

## Rollback

Promote previous Ready. Keep all write flags false. Clear `PILOT_*`. Jobber `webhookEndpointDelete` if a topic must be removed.

## Defects / leftovers

- Confirm this commit Ready on Vercel; unsigned GHL 401.
- Daily cron log after 14:00 UTC (or Pro upgrade).
- GHL workflow trigger bodies still UI-only.
- Quote/invoice GHL custom fields unmapped.
- GraphQL `webHookEvent` cannot list all endpoints; create payload was the confirmation for CLIENT_*.
- Dashboard browser login not automated in CI (session cookie).
