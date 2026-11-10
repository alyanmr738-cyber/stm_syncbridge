# Build phases, release gates and acceptance tests

## Phased execution

**P0: Capability audit / no provider writes**: credentials, OAuth on TEST account, account identity, schema, API scopes, mapping, sample read-only objects. Create `API_CAPABILITY_REPORT.md` and update open decisions.

**P1: Foundation**: Next.js app, Supabase migrations, auth, encrypted credential store, Jobber OAuth PKCE/refresh locks, GHL connection health, signed event inbox, queue/worker, admin overview, CI tests.

**P2: Historical inventory/backfill preview**: run read-only counters, inspect missing/duplicate clients, properties, jobs, visits, quotes, invoices and GHL contacts/opportunities. Stage mappings; review before any import/upsert.

**P3: Booking pilot**: one nonemergency service type on sandbox/test; verify Jobber availability/reservation/confirm before GHL confirmation; rescheduling and cancellation, technician assignment; no duplicate jobs.

**P4: Completion/estimate/invoice**: Jobber job complete → GHL per-job opportunity stage → review ledger; Jobber quote and invoice status sync with no financial writes.

**P5: AI notes and advanced ops**: summarized AI call/text notes appended to correct Jobber record; audit, retry, reconciliation, visibility.

**P6: Controlled production rollout**: staging/production environment separation, consent/automation QA, limited pilot, then historical migration and phased activation only after written approval.

## Critical acceptance scenarios

| ID | Scenario | Expected result |
|---|---|---|
| T01 | Jobber record updated | GHL mirrors only Jobber-owned fields |
| T02 | GHL customer edit conflicts with verified Jobber value | Jobber wins after reconciliation |
| T03 | Unmatched clean customer | New linked record created once (only if writes enabled) |
| T04 | Two customers share phone | Manual conflict; no merge and no third duplicate |
| T05 | Same booking event received twice | One Jobber job/visit |
| T06 | Two concurrent workers process same booking | One logical result |
| T07 | Rescheduled GHL appointment | Existing Jobber job retained, mapped visit updated |
| T08 | Additional visit in current job | No second job created |
| T09 | Unavailable Jobber slot | GHL remains unconfirmed; safe alternatives provided |
| T10 | Jobber API cannot reserve slots | Fail closed to manual/pending booking path |
| T11 | Jobber visit completed but job open | No review request |
| T12 | Jobber job completed | Per-job GHL opportunity moves Completed Job and one review authorization |
| T13 | Jobber completion webhook delivered twice | Only one review authorization |
| T14 | Repeat customer completes new job | New per-job review authorization allowed, subject to consent |
| T15 | Historical completed job backfilled | No review request/message |
| T16 | New opportunity directly in Completed Job | Review path doesn't rely solely on Pipeline Stage Changed |
| T17 | Quote sent then accepted before reminder | Cancel scheduled unanswered-quote nudges |
| T18 | Invoice marked paid | Stop overdue invoice reminder/status |
| T19 | AI summary retried | One Jobber note, preserving original notes |
| T20 | Jobber account disconnected | Integration halts and alerts admins; no token leaks |
| T21 | Refresh token used concurrently | One serialized refresh; other worker reloads current token |
| T22 | Invalid webhook signature | Reject before state mutation |
| T23 | GHL webhook caused by own update | No infinite ping-pong loop |
| T24 | Queue crash after provider write | Reconcile by native ID/idempotency before reattempt |
| T25 | Preview build with production env missing | No live writes and no production connections |
| T26 | All Access Digital admin only | Unauthorized user cannot access any dashboard/API data |
| T27 | Backfill interrupted halfway | Resume from checkpoint with no duplicate links |
| T28 | Wrong GHL location ID configured | Reject connections/writes immediately |
| T29 | Wrong Jobber account connected | Reject connections/writes immediately |
| T30 | Attempt to send review without consent | No message, logged reason |

## Production release criteria

- API operation capability matrix signed off.
- Test and production account identities validated.
- Business timezone, durations, emergency policy, 2h buffer interpretation and review cadence confirmed.
- Automated test suite + realistic sandbox browser tests pass.
- Backfill dry-run reconciliation discrepancy report accepted.
- Review and other automations inspected for unintended triggers.
- Error monitoring, queue age alarms, rollback and credential rotation tested.
- Owner explicitly approves production writes, migration batch and customer messaging separately.
