# Release gates, approvals and operational decisions

## Definitions

**Production-deployed:** Vercel hosts the fully implemented secured application. This can occur with outbound writes/messages disabled.

**Production-ready:** End-to-end behavior is evidenced against real authorized API schemas, security tests and a monitored controlled pilot; unresolved provider features have a clearly functional safe fallback.

**Fully activated:** Authorized production operations switched on independently after explicit business approval; historical import and customer messaging remain separately gated.

| Gate | Existing flag | Authorizes | Does not authorize |
|---|---|---|---|
| A | `OUTBOUND_WRITES_ENABLED` | Operational create/update writes to Jobber and GHL for an approved scope | Historical bulk import or customer-facing messaging |
| B | `HISTORICAL_IMPORT_ENABLED` | Approved dated batch import/reconciliation with audited counts and rollback | Customer messages, routine unrestricted writes |
| C | `CUSTOMER_MESSAGING_ENABLED` | Specifically reviewed customer-facing workflows after opt-out/consent checks | New or bulk customer/job writes |

**All gates default false and fail closed.** Production deployment never implies permission to enable them.

## Staged activation

0. Connect/read-only audit. Verify exact account identity and actual permissions.
1. Deploy durable secured infrastructure and real dashboard with A/B/C OFF.
2. Run approved synthetic/test-record pilot for A writes with no customer messaging; verify records in both systems, no surprise workflows; turn A on only for agreed business scope.
3. Run historical dry-run, create match/conflict report. B requires separate approved import scope and suppress-all-messaging proof.
4. Test review event only to internal authorized test recipients, verify opt-outs and deduplication. C requires explicit approval of content, recipients, triggers and frequency.
5. Monitor live queue/errors, retain rollback and disable switches.

## Mandatory blockers not to bypass

- Unknown Jobber availability API: do not invent slots; `pending_jobber_confirmation` must work as real admin action queue.
- Missing 2-hour buffer meaning: no guessed time padding; editable independent settings.
- No canonical service durations: no default durations; mapping UI must flag missing values.
- Emergency: route to manual callback/dispatch, no auto-confirm.
- GHL workflow trigger uncertain: verify create-in-completed behavior and use dedicated idempotent completion event if needed.
- Repeated customer: review once per *Jobber job*, no resend after reopen; consent rules always apply.
- Historical records: no nurture, invoice reminders, review messages, booking confirmations from backfill.
- No concurrent duplicate jobs/opportunities/notes; stable ID links and queue idempotency.
- New contact is not a new Jobber job; only actual service booking needs job creation.
- Ambiguous match is admin conflict, not guessed merge or separate duplicate.

## Audit trail requirements

Approval record fields: operation gate, approver, authority, date/time, environment, change scope, preflight tests, allowed record types/recipients, rollback switch, review or consent conditions, approval artifact, operator who enabled the gate.

Require explicit confirmation for any bulk backfill and any first live non-test customer message. Do not treat a general statement like "finish production" as authorization for an unlimited send or mass import.
