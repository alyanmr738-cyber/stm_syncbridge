# CURSOR MASTER EXECUTION PROMPT — SyncBridge Production Completion

**Date:** 2026-11-10  
**Project:** Septic Tank Man / All Access Digital — Jobber ↔ GoHighLevel SyncBridge  
**User goal:** Complete the real integration and make the *software* production-ready, not merely scaffold it.  
**Source of truth for current implementation:** `CURRENT_CURSOR_HANDOFF_SOURCE.md` supplied with this package.  
**Do not treat this prompt as permission to send customer messages, bulk-write history, or make unapproved business-record changes.**

## Instructions to Cursor (paste everything in this file into Agent/Plan mode)

You are the lead full-stack/integration engineer responsible for taking the **existing** SyncBridge repository to a verifiably production-ready state. Work in the existing repository, not a new project. Investigate and edit source, implement the missing features, add migrations and tests, conduct live **read-only** capability discovery with authorized credentials, and deploy validated code through the existing Vercel integration only when safe. Work end-to-end through the phases below rather than stopping at another scaffold or producing an architecture-only report. Deliver real changes, reproducible tests and an evidence-based release report.

### Existing project — DO NOT CONFUSE WITH ARIZONA SIGN COMPANY

- Repo: `https://github.com/alyanmr738-cyber/stm_syncbridge` branch `main`.
- Local workspace in original report: `/Users/suniya/Desktop/email/syncbridge` (check actual current path).
- Existing live URL: `https://stmsyncbridge.vercel.app`.
- Framework: Next.js 15 App Router, React 19, TypeScript, Tailwind, `iron-session`, Supabase Postgres.
- **Allowed project for this task:** Supabase project `bevweuqllbvpombsqqzu` (do not inspect or modify other projects).
- Septic Tank Man **GHL location ID**: `p7HYMD0h2RScLKL68uj0` (confirm with live account and env before use).
- Jobber connected business: **Septic Tank Man**; account ID must be read from connected account, not guessed.
- GHL timezone in handoff: `America/New_York`; validate against Jobber and business settings.
- Existing app has connected Jobber OAuth/GHL PIT, applied `supabase/migrations/0001_initial.sql`, some admin pages and mock logic.
- **Never** use Arizona Sign Company IDs, tokens, opportunities, stages, or examples.
- Preserve current working OAuth callbacks and deployments; don't reset credentials without a recovery plan.

### Nonnegotiable business decisions

1. **Jobber authoritative** for customer/property data, jobs, visits/scheduling, quotes, invoices, and completion. GHL authoritative for lead source, AI and communication, sales/nurture workflows.
2. When a new GHL service booking is received, match/create Jobber client and create Jobber job; however **GHL cannot confirm until Jobber scheduling is demonstrably confirmed**. If true API availability/reservation isn't supported, use `pending_jobber_confirmation` with actionable staff workflow; do not fake available slots or promise bookings.
3. New service → new job. Rescheduling or extra visit → reuse linked Jobber job, change/create linked visit. Never duplicate jobs on webhook retry.
4. Jobber job completion (not mere visit completion) → update correctly linked GHL opportunity to the actual **Completed Job** stage and authorize **one review request per Jobber job**, including repeat customers. Do not rely solely on pipeline-stage-change for new opportunities created directly in Completed Job.
5. Quotes/estimates and invoices **managed solely in Jobber**, status synced to GHL. Estimate follow-up timing: 1 day, 7 days, 1 month only after valid sent event and stop on resolution/opt-out.
6. AI call/text **summaries and reference/timestamps** go from GHL to appropriate Jobber internal notes; full conversation stays in GHL; don't duplicate notes.
7. Historical records: all available relevant records, matched and reconciled, but **dry-run first**; never emit historical review/reminder/nurture messages.
8. On no customer match, create a separate customer record. On **ambiguous/multiple matches**, do not auto-merge or link unrelated customers; flag for admins.
9. Only **All Access Digital admins** access SyncBridge dashboard. No customer/technician self-service portal.
10. Emergency auto-booking OFF pending separate approval. Lead-time, between-visit buffer and travel buffers are distinct unset settings; **never silently set a two-hour default**.
11. Independent production approval gates: **A `OUTBOUND_WRITES_ENABLED`**, **B `HISTORICAL_IMPORT_ENABLED`**, **C `CUSTOMER_MESSAGING_ENABLED`**. Each requires its own explicit authorized approval and recorded activation evidence. Code deployment ≠ permission to enable these gates.

### Required working method

- Start by reviewing the repo, current Vercel build/deploy state, actual database migrations and existing tests. Record a baseline, protect any uncommitted work, use a feature branch/PR where possible; do not destroy working features.
- Review **current official Jobber and HighLevel docs** and use live capability reads only where authorized. Version-pin Jobber GraphQL; discover schema operations, not speculative mutations. Check response `errors` / mutation `userErrors` even on HTTP 200.
- Never log or echo access tokens, refresh tokens, PIT, API keys, personal customer data or full webhook payloads into user-visible reports. Redact logs; keep secrets server-side.
- Don't turn production feature gates on just because the user asks for a fully built system. Implement full code and approved smoke tests. For unapproved write/message/backfill actions, show exact gate and activation checklist in final report.
- Move through phases continuously, commit/review/test as appropriate. Stop only for true external blockers (permissions, account approvals, unavailable API, missing business decision), state the precise blocker, leave safe working code and unblocked work completed.
- If official API does not support the required operation, implement an honest `pending_*`/manual-review path and label capability unsupported. Never fake success, availability, webhook events or a working historical sync.

## EXECUTION PHASES — Complete all unblocked phases

### P0 — Baseline, live read-only API capability audit, risk inventory

- Verify production/staging configs, environment variable names and host URLs (do not print values), GitHub branch, current deploy SHA, DB migrations, health checks, auth and callback accessibility.
- Verify Jobber connected account identity and GHL location; verify business timezone and permission scopes. Inspect Jobber GraphQL schema for supported client/property/job/visit/quote/invoice/note queries and mutations, relevant webhooks, service catalog, scheduling/availability/reservation features. Verify actual GHL pipelines/stages, calendars Voice AI writes to, workflow entry points, webhooks, field schemas, and potentially firing automations.
- Write `docs/API_CAPABILITY_REPORT.md` and `docs/ACCOUNT_MAPPING.md` with **verified / unsupported / gated / needs-human-decision** statuses, source evidence and timestamps. No inferred pipeline IDs.
- Explicitly flag whether real-time slot reservation is impossible. Fallback = pending Jobber confirmation; support safe staff action queue.

### P1 — Authentication and security that can survive production

- Implement Jobber OAuth **refresh-token rotation**, with encrypted persistent token updates and concurrency coordination/transaction lock. Refresh proactively or on 401, re-read after concurrent refresh; store *both* rotated access and refresh tokens before using them. Test forced expiry and multiple simultaneous callers. Handle disconnect/reconnect and revoke/clear credential state correctly.
- Harden admin session, cookie properties, CSRF protection for privileged writes, login rate limiting, auth expiry, authorization on every server action/API, least-privilege Supabase access. Ensure `ADMIN_SESSION_SECRET` fail-closed and no public admin pages.
- Validate webhook source **before** accepting events: Jobber `X-Jobber-Hmac-SHA256` over raw body with OAuth client secret, constant-time comparison; GHL current Ed25519 `X-GHL-Signature` public-key verification where applicable, correct integration-specific delivery mode and replay defenses. Reject unverified webhook data; never trust posted account/location IDs.
- Fix any permissive RLS/policies or exposed service role secrets. Use scoped account allowlist.

### P2 — Durable event ingestion, worker and operational reliability

- Replace in-memory `src/lib/queue` default. Implement `QUEUE_PROVIDER=postgres` for the already-existing Supabase `queue_jobs` table or a documented queue abstraction with persistent scheduling, leases, atomic claims, bounded retries, exponential backoff+jitter, dead-letter/quarantine, rate limits, event sequencing / concurrency for same customer/job, and replay tools.
- **Persist validated events before returning 2xx**; respond fast (<1 second for Jobber webhook); avoid performing sync inside ingress request. Database outage => do not falsely acknowledge event as durable.
- Store idempotency keys per provider event and per target side effect; stable Jobber/GHL identifiers; deal with duplicate, delayed, out-of-order and replayed events; prevent Jobber↔GHL loops via source revision/fingerprint.
- Verify chosen worker scheduling mechanism actually executes on Vercel plan and environment; add alerting for stuck/backlogged/dead-letter jobs. Use Supabase-backed queue first if operationally adequate; document queue provider cost and limitations.

### P3 — Real customer/property sync, linkage and historic import mechanism

- Implement customer and property field maps against verified schema, stable IDs and unique indexes, safe normalization of phones/emails, canonical Jobber values and non-destructive reconciliation. GHL changes: attempt authorized Jobber mutation, re-read Jobber, sync authoritative result. Permanent rejection -> conflict queue; no ping-pong.
- Add customer-links, property-links, job-links, appointment-links, quote-links and invoice-links CRUD service and secure admin inspection. New unmatched contact -> create distinct record; ambiguous matches -> manual review.
- Implement **fully resumable, paginated, dry-run historical importer** across available history; records counts, differences, conflicts, cursor checkpoints and dry-run reports. No historical customer messages. Do not execute bulk production writes/import without B approval.

### P4 — Booking and scheduling end-to-end

- Service mapping: fetch authentic Jobber service catalog and durations; provide admin mapping UI for GHL appointment intents. Missing mapping => pending admin intervention.
- GHL appointment/AI request -> exact client/address match -> no duplicate job -> verify Jobber scheduling capability; create job for new service; scheduling confirmed only after Jobber confirms recorded visit and time. Reschedule and extra visits update existing linked job/visit.
- If no reliable API-backed availability or reservation, use `pending_jobber_confirmation`; provide usable operations dashboard with requested time, alternatives when truly verified, assignment, manual confirmation, retry and communication state. **Never claim an unverified slot is available**.
- Keep emergency auto-book disabled. Timezone, lead-time, between-visit and travel buffers require configured approved values; fail closed if missing for automatic scheduling. Correct cancellation and cross-system update behavior.
- Exactly-once business effect across webhook retries, same booking replay and concurrent requests.

### P5 — Job completion, opportunities and review authorization

- Discover Septic Tank Man's GHL Sales Pipeline / Completed Job stage IDs rather than hardcoding another client's IDs.
- Link **one Jobber job to its appropriate GHL opportunity**; don't accidentally use one lifetime opportunity for all repeat jobs.
- Detect authoritative Jobber job completion, reconcile actual job state, move/update opportunity directly to Completed Job without routing through New Lead. When GHL opportunity is new and already in Completed Job, ensure review triggering does not depend on stage-changed event alone.
- Design a dedicated inbound event/verified workflow entry to GHL with Jobber job ID and idempotency ledger; stop on lack of consent/DND, do not send review twice for same job if Jobber completion event is redelivered or job reopened. Distinguish authorized, dispatched, provider accepted, sent, failed, unknown.
- Keep C OFF until explicit customer-messaging authorization. No historical review requests.

### P6 — Estimates, invoices, AI summaries and future reminders

- Jobber `quote` / estimate sent, approved, declined -> GHL states and automation inputs. Reminder schedule 1 day/7 days/1 month only when valid and authorized; cancel on response/approval/decline/suppression. Jobber manages actual financial docs and amounts.
- Invoice/job completion status -> GHL mapping for invoice reminder requests, never invent invoice/payment state or create invoices in GHL.
- GHL Voice/SMS AI summary events -> formatted Jobber internal notes appended once per source conversation/call version; preserve existing technician notes and full transcript only in GHL; don't invent source content.
- Make notification routing to staff configurable, avoid customer-facing sends without C, and honor local business hours/quiet times/consent.

### P7 — Finish actual admin UI

- Replace placeholders `/activity`, `/links`, `/bookings`, `/reviews`, `/conflicts` with **real** Supabase-backed admin views: filtering, linked details, timestamp, status, error, retry/dead letter, conflicts, booking actions and review ledger. Maintain calm existing design and accessible controls; no big animation redesign.
- `/overview`: real 2/2 connection status when verified, queue health, last sync, gate status, no misleading placeholders.
- `/settings/connections`, `/settings/mappings`, `/settings/audit`: real status and capability evidence, not mocks presented as live. Admin controls pause/resume at safe per-workflow level; dangerous actions require explicit confirmation+audit trail.
- Secrets never exposed to client props, rendered HTML or browser network responses.

### P8 — Testing, reconciliation, security and deployment

- Test unit, integration, contract and browser E2E; simulate concurrent token refresh, webhook spoofing, duplicate and out-of-order deliveries, partial API failure, queue outage/restart, repeat customer job, booking reschedule, unavailable slot, existing opportunity, historical completion no review, opt-outs, invoice estimate updates, AI summaries.
- Tests must verify that **no outbound provider write** occurs when gate A is OFF, **no historical backfill** when B OFF, **no customer message** when C OFF; emergency booking OFF independently.
- Use staging/test accounts, mock fixtures and approved test records; **not random real customers**. Compare actual Jobber/GHL IDs, fields and workflow logs for authorized pilot tests.
- Ensure `npm test`, lint, typecheck, build and browser checks pass. Add meaningful tests; existing three small tests insufficient.
- Deploy tested code to existing `stmsyncbridge.vercel.app` via controlled preview→production promotion, with migrations/backups/rollback, ensure Jobber OAuth and public webhook paths work while dashboard remains private. Confirm monitoring, documented incident runbook and operator onboarding.
- Perform staged enablement, NEVER silently flip A/B/C. Approval A: limited verified writes, then monitored operational sync. Approval B: batch historical import with reconciliation and suppressed messages. Approval C: explicit approved customer-facing reviews/reminders with consent checks; send tests to authorized internal recipients first.

## Required evidence and delivery

Deliver the actual implementation plus:

1. `docs/API_CAPABILITY_REPORT.md` — verified endpoints, operations, account IDs, unsupported availability details.
2. `docs/ACCOUNT_MAPPING.md` — GHL pipeline/calendar/workflow IDs, Jobber catalog and source-of-truth map, redact secrets.
3. `docs/PRODUCTION_READINESS_REPORT.md` — completed features, deploy SHA/URL, test commands/results, migrations, verified operations, blockers and **truthful GO/NO-GO per feature**.
4. `docs/OPERATIONS_RUNBOOK.md` — reconnect OAuth, replay failed sync, conflicts, queue/DB outages, credential rotation, rollback, webhook setup.
5. `docs/HISTORICAL_IMPORT_REPORT.md` — dry-run counts/conflicts/checkpoints; production import evidence only after B approval.
6. `docs/PRODUCTION_APPROVALS.md` — separately record A, B, C approver, date, scope, what was tested, rollback plan; an empty approval means gate OFF.
7. Working dashboard and meaningful automated test suite, with no fake fixture data presented as live.

**Completion criterion:** Production code deployed, both external accounts remain connected beyond refresh cycle, all webhook traffic authenticated/durably processed, actual two-way business sync works in authorized pilot tests, admin screens are real, and every remaining business decision or blocked provider capability is explicitly described with safe fallback. Do not call the system 'fully live' if any required production gate is still off. Instead report production-ready code with per-feature activation status.

**Operational safety:** Changes to live customers/jobs, bulk backfill and outbound customer messaging are three distinct permissions. If explicit approvals are not present, build and test everything possible, deploy safe code if allowed, leave corresponding gates OFF, and provide exact activation instructions. This is not permission to bypass user safeguards simply to satisfy a 'finish everything' goal.

## Documentation references (verify current versions yourself)

- Jobber API: https://developer.getjobber.com/docs/
- Jobber refresh rotation: https://developer.getjobber.com/docs/building_your_app/refresh_token_rotation/
- Jobber webhook signing/delivery: https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/
- GHL webhook verification: https://marketplace.gohighlevel.com/docs/2021-07-28/webhook/WebhookIntegrationGuide/index.html
