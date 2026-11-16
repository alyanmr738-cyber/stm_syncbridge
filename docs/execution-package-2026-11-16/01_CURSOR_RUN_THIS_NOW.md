# Cursor: execute the next SyncBridge completion sprint now

You are editing the **EXISTING** repository `alyanmr738-cyber/stm_syncbridge`, deployed to `allaccessdigital / stm_syncbridge`; Supabase `bevweuqllbvpombsqqzu`; GHL **Septic Tank Man location** `p7HYMD0h2RScLKL68uj0`; Jobber account `Z2lkOi8vSm9iYmVyL0FjY291bnQvMjQ1MDQ1` (base64 account GID). Do not touch other clients, projects, accounts, sites or Vercel deployments.

The user wants us to **finish useful implementation tonight** and is tired of recurring discovery/status reports. Build and test actual functionality, not just produce another proposal. Use the supplied docs as a prioritized work order, inspect current source first, and preserve the working Gate A baseline.

## Non-negotiable starting checkpoint

- Last reported production SHA `29edb43`. **Verify live** before deploying. Preserve proven Evan Test real GHL update and restore behavior.
- Jobber OAuth locking/reconnect, 40-event bounded quarantine, webhook/queue and 80 verified links are working. Do not rewrite working auth or replay incident events.
- Existing operational Gate A scope authorized; `SYNC_ENABLED=true`, `OUTBOUND_WRITES_ENABLED=true`, `JOB_COMPLETION_SYNC_ENABLED=true`, `ALLOW_RECORD_CREATION=false`. Creation, historic import, booking sync, financial sync, AI note sync, messaging and reviews remain disabled.
- Z7 draft, Workflow 1 published, Workflow 4 draft. Do not republish or change workflows.
- **No customer-facing sends**, **no historical bulk data writes**, **no automatic identity merges**, **no unapproved creation**, **no claim of real booking without Jobber-confirmed schedule**.

## Execution sequence — do the work, maintain a simple checklist

### Phase 0 — fast safety baseline (no more than a short preflight)
1. `git status`, current branch, origin, latest commit, current deployment SHA and real flags.
2. Read existing schema, queue, identity matcher, handler dispatch, service mappings, booking and review modules, admin UI. Locate tests; identify truly missing behavior vs features already present.
3. Snapshot counts: verified vs pending customer links, existing `job_links` with opportunity IDs, unresolved conflicts, queue state, quarantined 40 DLs.
4. Run unit tests/typecheck/build before edits and document existing failures. If production differs from repository, stop deploy rather than overwriting unseen changes.
5. Before work, ensure outbound writes for any exploratory tests use **fixtures/staging** only. A production read is not permission to mutate.

### Phase 1 — make existing customer/job coverage practical (highest ROI)
1. Implement/finish admin **Customer Matching & Conflict Review**: live existing-record candidate list with evidence, identity methods, pending/verified/rejected states, resolve/reject actions with explicit confirmations, change history and audit. No silent `verified=true` from email-only or phone-only matching.
2. Add safe deterministic matcher/scorer for **candidate proposal** (not auto-link). Display normalized email+phone, exact IDs, names, location/address, duplicate/collision checks; preserve Jobber authority; never infer identity based solely on phone. Protect 8 rejected name discrepancies and 49 ambiguous collisions.
3. Build a read-only fresh reconciliation report for the 15 earlier *email-only + name-aligned* candidates (Batch B proposal), 211 phone-only and 49 ambiguous. Recalculate live, **do not apply Batch B**. Surface unmatched GHL/Jobber counts and reasons.
4. Finish existing **job↔GHL Sales Pipeline opportunity** candidate mapping. For each match require Jobber live status + owner verified `customer_link` + **one-to-one** existing opportunity in Sales Pipeline `UMelQ0AisTqWdPl1XHK6` + evidence of matching job/service/context. Sample had 45 pairs, 22 archived, only ~3 operational: **refresh all counts**. Propose exact link rows; do not mass-link automatically. Archived/historical opportunities do not become active workflows.
5. Make matching results actionable and auditable through admin. Unit/integration test ambiguity, duplicates, archived jobs, wrong pipelines, deleted Jobber clients, false positives, time zones, stale revisions. Retain Evan mapping.

### Phase 2 — complete existing-record bidirectional synchronization
1. Trace Jobber CLIENT_UPDATE -> existing verified GHL contact and ensure normalized allowed-fields diff, idempotent PUT, no contact creation, webhook dedup, drift/conflict handling.
2. Trace GHL CONTACT_UPDATE -> verified existing Jobber client with correct event verification. Jobber is authoritative: use GHL edit as an input, validate and write only permitted fields, re-read Jobber, then reconcile to GHL; suppress loops with source fingerprints/revisions. Unknown/ambiguous users remain in conflict queue. **Do not push a real update to a customer without approved test authorization.**
3. Trace Jobber JOB_CLOSED (`requires_invoicing` counts as work complete, NOT paid) -> existing linked GHL Sales Pipeline opportunity stage `1724dc1d-02f1-422c-825f-bebb9d427e71`. Live Jobber status required; no self-created opportunity unless separate creation gate.
4. Ensure delivery status distinctions: ingested/queued/suppressed/no-op/provider PUT succeeded/failed/quarantined. Fix misleading UI counts and add diagnostics for why verified customers did not write.
5. Run adversarial tests including concurrent workers, stale updates, replay, GHL rate limit, Jobber auth transient/revoked, duplicate webhooks; verify no customer messaging from GHL native workflow side effects on authorized test records.

### Phase 3 — booking & service readiness while BOOKING SYNC OFF
1. Verify live Jobber GraphQL availability and mutation capabilities; document actual schema/constraints, not guesses. Do not invent atomic slot reservation.
2. Implement GHL request -> `pending_jobber_confirmation` task with complete identity/service/address/desired date and conflict reasons. Admin can map service, request changes, verify a Jobber-confirmed visit, and then update permitted GHL booking state only behind BOOKING gate. New request vs reschedule vs repeat visit must not duplicate a Jobber job.
3. Manual confirmation is the fallback if Jobber does not provide reliable create/reserve/availability. Never send a confirmed time before Jobber confirms actual visit.
4. Independent scheduling knobs (lead time, between visits, travel buffer, timezone); no hard-coded two-hour rule. Missing duration or service catalog mapping blocks confirmation.
5. Keep `EMERGENCY_AUTO_BOOK_ENABLED=false` even if other gates turn on later.
6. Implement tests and UI on fixtures/staging. **No real booking creation or confirmation.**

### Phase 4 — finish disabled financial / AI / review code paths
1. Quote/invoice: no Jobber GraphQL fetch if respective flag OFF. When enabled in future, Jobber status is authority; GHL should receive permitted notes/structured metadata only if the actual provider supports it; never invent GHL invoice or a paid event.
2. AI summaries: inbound GHL transcript can yield a short internal Jobber note once (with source/time), under `AI_SUMMARY_SYNC_ENABLED`; no public/customer-facing note; dedup.
3. Review ledger: per **Jobber job**, one eligible review action max; completion not visit-only; proper opt-in/opt-out, suppress imported/historical completion, no duplicate on reopen. Workflow 4 stays draft and Gate C stays OFF.
4. Do not send quote follow-ups, invoice reminders, AI notes or review requests. Use mocks/internal fixtures, then approval-specific pilot only.

### Phase 5 — historical import/creation readiness (not execution)
1. Build a current **read-only** paginated inventory with resume checkpoints and dry-run match buckets across Jobber and GHL, not the stale October counts. Record correct deletion/archival distinctions.
2. Implement import dry-run simulation and exact proposed write set, throttling, stable IDs, resumability, rollback/reporting. No changes unless `HISTORICAL_IMPORT_ENABLED` separately authorized for an explicit bounded scope.
3. Implement record creation logic behind `ALLOW_RECORD_CREATION`, but keep flag FALSE; require duplicate search, customer identity quality, no fire-and-forget job creation, and no native GHL messaging side effects.
4. Historical imports must NEVER send review/SMS, booking confirmation or nurture automatically.

### Phase 6 — completion and release evidence
1. Run focused tests after each phase, then full unit, integration, typecheck/lint, build and browser smoke tests.
2. Preserve production release gates, quarantine and existing auth. Deploy only if no production data operation is implicitly activated and explicit project access exists. If required permissions are missing, give one exact operator action rather than looping.
3. Produce an **actual** checkable report per `08_FINAL_HANDOFF_FORMAT.md`, not a generic progress essay.
4. Mark unverified or provider-unsupported features BLOCKED, not PASS. Explain precisely the missing business approval or API limit. Leave all unauthorized production features disabled.

## Prioritize under deadline

**Must finish first:** safe customer/opportunity matching UX + source-of-truth sync evidence + missing conflict fixes + test/runbook. Then booking pending queue and full disabled-path tests. Financial/reviews/import readiness as time allows. Do not trade correct, safely bounded behavior for a premature 'all features live' headline.

**Approval stops**: Before Batch B verification writes, bulk job links, live create, bulk import, real bookings, customer-facing messages, Workflow 4 publish, or any new production gate. General instruction to finish tonight does **not** approve these.
