# Priority 2 — Two-way sync and safe booking

## Authority & sync flow

| Event/source | Allowed behavior now | Future behind disabled gates |
|---|---|---|
| Jobber CLIENT_UPDATE on verified pair | Diff allowed identity fields; update same existing GHL contact; no-op if identical; audit provider result | None needed |
| GHL CONTACT_UPDATE on verified pair | Reconcile to Jobber-authoritative version; only approved narrowly scoped changes, verified signed ingress and loop prevention | Any broader writable field map requires explicit scope |
| Unverified CLIENT_CREATE/UPDATE | Conflict with reason; no new GHL contact | Gated creates after consent/identity controls |
| Jobber JOB_CLOSED | Live GraphQL status check; existing linked Sales Pipeline opp→Job Completed stage; idempotent | Create new opp separately gated |
| VISIT_CREATE/UPDATE/CLOSE | Maintain job/visit awareness and reconciliation; don't create booking by inference | Pending/manual booking logic if enabled |
| Jobber quote/invoice events | Suppress before GraphQL when flags OFF | Notes/metadata updates with explicit permission |
| GHL AI conversation | No Jobber note when flag OFF | One dated internal-only note after approval |
| Job completion review | Ledger may record suppressed only; no send | One per Jobber job, consent & Gate C |

### Queue behavior

Authentic webhook signature -> persisted event -> enqueue -> lock/lease -> fetch live authoritative record -> existing identity link -> idempotency/loop check -> provider write or correctly classified no-op/suppressed/conflict -> durable audit record. Retry transient/429/5xx with backoff. No false succeeded provider writes. No provider API calls for disabled types. Distinguish status `requires_invoicing` (service completed, **not invoice paid**).

### Bidirectional edits

Never allow ping-pong: version/last revision and source fingerprints; only compare approved, normalized fields; reject stale changes, conflicting concurrent edits and empty destructive values. GHL updates may be lead intake or staff edits; a customer identity conflict stays pending review. An update to verified Jobber should re-fetch Jobber then reconcile GHL. Do not manufacture provider reads/writes to mark tests passed.

## Booking — pending first, never false-confirm

Current rule: Jobber is authoritative for scheduling. Verify from live GraphQL capabilities whether availability and atomic booking are actually possible. If not, fail to a functional **manual booking confirmation** pathway, not a fake scheduled time.

Potential state machine:
`requested -> identity_review/service_review -> pending_jobber_confirmation -> confirmed` or `needs_reschedule / cancelled / declined`. Persist service, property, desired date/time window, Jobber job GID (if existing), visit GID (if confirmed), location timezone, source and operator audit.

- **New booking**: only creates job on authorization and only when a genuine service request; a contact update alone does not create a job.
- **Reschedule**: locate prior Jobber job/visit and update that link; do not create a replacement job.
- **Additional visit**: reuse existing job; separate visit identity, if Jobber supports it.
- **Emergency**: route manual; `EMERGENCY_AUTO_BOOK_ENABLED=false`.
- **Missing catalog duration**: no guessed length; must request a verified service mapping before possible confirmation.
- **Buffer rules**: independent lead time, between-visit spacing and travel requirements. `America/New_York` authoritative for GHL local service workflows. No assumed 2-hour buffer.
- **Notifications**: none while C OFF. If booking confirmed later, verify GHL native workflow side effects and customer opt-in before sending.

## Testing

Use mocks/staging and actual provider schemas; provide test evidence for: stale events, double webhooks, Jobber outage, manual confirm requiring real visit, bad service mapping, duplicate booking, schedule change without create, cancelled visit, timezone/DST and no customer sends.
