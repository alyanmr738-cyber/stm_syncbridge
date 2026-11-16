# Current state, scope and gates

## Trusted as reported; Cursor to live-recheck

| Item | State reported by operator |
|---|---|
| Last known production SHA | `29edb43` |
| Project | Existing `allaccessdigital/stm_syncbridge` at `https://stmsyncbridge.vercel.app` |
| Repo | `https://github.com/alyanmr738-cyber/stm_syncbridge` |
| Supabase | `bevweuqllbvpombsqqzu` |
| GHL Septic Tank Man location | `p7HYMD0h2RScLKL68uj0` |
| GHL Sales Pipeline | `UMelQ0AisTqWdPl1XHK6` |
| GHL Job Completed stage | `1724dc1d-02f1-422c-825f-bebb9d427e71` |
| Jobber account GID | `Z2lkOi8vSm9iYmVyL0FjY291bnQvMjQ1MDQ1` |
| Verified existing customer links | 80 |
| Unverified existing links | 4 |
| Known quarantined incident dead letters | 40; DO NOT REPLAY |
| Production Gate A | ON, limited to verified existing records and existing opportunities |
| Gates B/C | OFF |
| Creation flag | OFF |
| Booking, financial, AI, reviews, customer messaging | OFF |
| Z7 | Draft (NOT to be restored) |
| GHL Workflow 1 | Published (preserve) |
| GHL Workflow 4 | Draft (preserve) |
| Real E2E sync proof | Evan Test lastName changed via Jobber→GHL and restored to Test |

## Hard production prohibitions, absent specific new approval

- Do not turn on `ALLOW_RECORD_CREATION`, `HISTORICAL_IMPORT_ENABLED`, `CUSTOMER_MESSAGING_ENABLED`, `REVIEW_TRIGGER_ENABLED`, `BOOKING_SYNC_ENABLED`, `EMERGENCY_AUTO_BOOK_ENABLED`, `ESTIMATE_SYNC_ENABLED`, `INVOICE_SYNC_ENABLED`, `AI_SUMMARY_SYNC_ENABLED` or other latent side-effect flags.
- Do not make bulk identity-verification changes, link archived jobs or auto-close opportunities, replay 40 dead letters, start mass migrations, create customers/jobs/opportunities, send SMS/reviews/follow-ups, edit GHL workflows or unpublish Workflow 1.
- Do not reconnect or rotate Jobber OAuth through GraphiQL as a test; current OAuth is proven.
- Do not alter other Supabase projects, GHL locations, Jobber accounts, or domains.
- Code implementing disabled features and staging fixtures can be worked on if a provable fail-closed gate is preserved and production is not accidentally activated.

## Queue and OAuth incident protection

- Token refresh must use distributed lock and CAS; failed revoked vs transient statuses handled separately.
- Bounded quarantine known window: `2026-11-13T20:09:00.000Z <= received_at < 2026-11-15T13:06:08.000Z`, plus eligible failure statuses. **Check actual code semantics**. Quarantine must not capture newer incident events.
- `JOBBER_AUTO_RELEASE_AUTH_BACKOFF=false`, old DLs remain untouched. Admin replay returns `409 quarantined` absent explicit separate override approval.
- Never infer that no pending queue jobs means all historical data synchronized.

## Approval matrix

| Operation | Can implement/test behind OFF flag? | Can activate production now? |
|---|---|---|
| Existing verified customer update | Already implemented + approved | YES, within current Gate A scope only |
| Unique existing job→opportunity *candidate search* | YES, read-only | YES read-only; apply DB link changes requires reviewed scope |
| Batch B email-only verification | YES, propose/manual review | NO (specific approval needed) |
| Phone-only and ambiguous matches | YES, review queue | NO auto-link |
| Creating GHL/Jobber contacts/jobs/opportunities | YES, mocks/staging | NO |
| Historical backfill | YES, dry-run | NO |
| Booking confirmation | YES, pending/manual workflow code | NO live writes |
| Quotes/invoices/AI internal notes | YES, mock/staging | NO live |
| Reviews/SMS/follow-ups | YES, consent + ledger tests | NO |
| Publish Workflow 4 / restore Z7 | NOT part of this sprint | NO |

## Definition of 'finished tonight'

A successful night can mean complete safe code paths, real dashboard/reconciliation, verified test suite and explicit release-ready approvals. It **cannot truthfully mean** full real-world auto-booking, backfill and customer messaging were live if no one approved their activation or if provider APIs cannot perform a promised reservation.
