# Release runbook / approvals

## Before coding or deploying

1. Confirm production SHA, deployment team/project, branch/repo, target Supabase/GHL/Jobber IDs. No cross-tenant queries.
2. Record Gate A/B/C, `ALLOW_RECORD_CREATION`, booking, financial, AI, review flags, Z7/W1/W4 status, incident dead-letter count and event throughput.
3. Identify whether migration is additive/reversible and whether background workers could see new tables or partial code.
4. Read-only first; no production data write for exploratory analysis. Use a clone/staging/fixture for schema-changing tests where possible.

## Deploy code only, keep unauthorized behavior OFF

- Review changed files/diff; no secrets, no unexpected data mutation code.
- Unit, queue, auth, identity, booking, review, dry-run, browser E2E pass; build and lint/typecheck pass.
- Apply additive schema migrations with explicit scope; record migration version and backout/forward-fix plan.
- Push to linked `main`, confirm exact Vercel team/project and deployment SHA; old SHA must not be silently redeployed.
- Live `/api/health` with correct code and gates; check signed webhook ingestion, cron and no retry storm.
- No automatic import, backfill, finance sync, AI notes, booking writes, customer messages or reviews.

## Operational release approvals — distinct

**Approval request needed per type:**
- Additional `customer_links` Batch B verification: exact IDs + evidence + impact.
- Existing `job_links` applying proposed opportunities: exact IDs, current state + owner, archivals, effects.
- Record creation: `ALLOW_RECORD_CREATION` scope, dedup and native automation plan.
- Gate B: import start/end, included record types, quantity caps, messaging suppression, rollback plan.
- Booking: confirmed Jobber capability or manual operator step, permitted services and buffers.
- Financial/AI fields: permitted content recipients and test criteria.
- Gate C: message templates, consent/opt-out, review rate, recipient pilot and GHL workflow cutover.

Never bundle approvals by saying simply 'finish tonight'.

## Rollback if new code misbehaves

- Disable only **affected new flag(s)** first, not incident protection.
- For an unintended existing-record write storm, follow approved rollback to set `OUTBOUND_WRITES_ENABLED=false` (and `SYNC_ENABLED=false` if necessary) and redeploy. **Do not unpublish/re-publish Z7 without a separately verified continuity plan.**
- Restore last verified known-good deployment if needed, considering DB schema compatibility. Do NOT blindly roll back to SHA `3dbfff7` / pre-OAuth-repair code.
- Preserve queues, 40 quarantined dead letters and audit logs. No automatic reprocessing on rollback.
- Provider writes are not undone by SQL rollback; list affected IDs for manual reconciliation.

## Do not let quality gates erase the business reality

An application can be code complete and production deployed while new creates, bulk migration, booking and messaging remain disabled. The final handoff must explicitly distinguish these states.
