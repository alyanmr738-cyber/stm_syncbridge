# Septic Tank Man — Architecture Decisions & Authorization Boundaries

Authoritative supplement to `docs/01_DECISIONS.md` (2026-11-10). Core SyncBridge design unchanged.

## Summary

- Booking: `pending_jobber_confirmation` when API cannot reserve/confirm; never confirm customers without Jobber proof; no duplicate jobs on reschedule.
- Timezone: discover from Jobber; compare GHL; Jobber proposed authoritative pending business sign-off.
- Scheduling buffers: independent env knobs; no auto scheduling until business confirms semantics.
- Services: Jobber catalog authoritative; admin mapping UI; unmapped → review.
- Emergency auto-book: OFF until separate approval.
- GHL: discover all IDs/workflows read-only; dedicated review trigger with job + opportunity IDs.
- Historical import: full inventory with dry-run; three separate approval gates.
- Reviews: one per completed Jobber job; ledger prevents duplicates; messaging gate OFF until approved.
- GHL customer edits: Jobber wins; no ping-pong loops.
- Queue: provider-agnostic interface; postgres or memory in dev.
- Jobber: private/custom app; live OAuth by Septic Tank Man admin.

## Production approval gates (independent)

A. Production writes  
B. Historical backfill  
C. Customer messaging  

Approval for one does not imply the others.
