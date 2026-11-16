# SyncBridge — Next Execution Package

**Date:** 2026-11-16  
**Client:** Septic Tank Man  
**Owner:** All Access Digital  
**Purpose:** Move from a proven *limited Gate A* pilot to a comprehensive, safely releasable integration **without** switching on unauthorized production data operations.

## What is genuinely complete (as last reported by the operator)

- Production: `https://stmsyncbridge.vercel.app`, SHA **`29edb43`**. Cursor must verify fresh production SHA before editing/deploying; the SHA is a starting checkpoint, not a claim of current state.
- Proven limited Gate A: one actual Evan Test `CLIENT_UPDATE` changed an authorized `lastName` in Jobber, was observed in the existing GHL contact, and was restored to `Test`; no unexpected messages or duplicates reported.
- Jobber OAuth / serialized refresh recovered; distributed lock RPC installed; token rotation had succeeded.
- 80 verified active `customer_links`; 4 remain unverified; eight name-misaligned and Sherri/Sherry identity mismatch excluded from Batch A.
- 40 outage dead letters preserved behind **bounded** quarantine; **do not replay**. Config may use the default `OAUTH_RECOVERY_QUARANTINE_UNTIL=2026-11-15T13:06:08.000Z`.
- Gate A operational existing-record writes ON; Gates B (historical) and C (customer messaging) OFF; `ALLOW_RECORD_CREATION=false`, `BOOKING_SYNC_ENABLED=false`, estimates/invoices/AI/reviews OFF.
- Legacy GHL Z7 contact update automation **draft**; Workflow 1 New Lead **published**; Workflow 4 Service Completed **draft**.

## Important limits

**This ZIP is an executable instruction/specification package for Cursor in the existing repository; it is not a source-code patch.** No newer source repository was included with this request, so Cursor must inspect the actual code and database and treat them as authoritative for implementation details. The attached Nov 10 handoff was read for architecture but is **outdated** as to deployment readiness.

**Do not read 'finish tonight' as authorization to turn on any unapproved production gate, historical import, mass linking, automatic record creation, booking confirmation, review/SMS or other customer messaging.** Implement and test disabled paths, then ask only for concrete, indispensable launch approvals.

## Use in Cursor

1. Open the **existing** `stm_syncbridge` repository (do not scaffold a new project).
2. Extract this ZIP into a temporary `docs/next-execution-2026-11-16/` directory or attach the files to Cursor.
3. Give Cursor **all files** and paste `CURSOR_RUN_THIS_NOW.md` as the Agent instruction.
4. Ask Cursor to **write code, tests and migrations**, verify locally and on safe staging/test fixtures, then deploy only the non-activating reviewed improvements via existing Git/Vercel path. Production DB changes to link real identities require a specific approved, reviewed write set.
5. Demand a short evidence-based final report with completed tasks, tests, commit, deploy SHA and approval boundaries. Avoid open-ended analysis loops.

## Target tonight

**Target result:** Safe existing-record coverage workflow, job↔opportunity matching pipeline, two-way sync safeguards, pending/manual booking handling, historical import dry-run readiness, and customer messaging/review code paths implemented/tested behind disabled switches. Only ship what is actually proven. Remaining gates stay OFF.

See `01_CURSOR_RUN_THIS_NOW.md` for precise sequence and stop conditions.
