# Admin dashboard: design and functionality

Only All Access Digital admins can access this internal tool. Never add client self-service screens in v1.

## Navigation

- Overview: connected account identity and auth health, queue age, sync successes, blocked writes, unsynced items, error count, last reconciliation, feature flags.
- Sync Activity: searchable events (source, entity, before/after summary, duration, state, retries), click-through into linked Jobber/GHL objects.
- Customer & Job Links: Jobber client/GHL contact and Jobber job/GHL opportunity, properties, visits and appointments; merge/conflict review; never disclose raw secrets.
- Booking Monitor: requested vs confirmed, pending/manual, rejected slots, reschedule chain, staff assignment read-only where possible.
- Automation Ledger: review eligibility/authorization/sent/failed state, quote/invoice reminder trigger state, safe retry.
- Field Mapping: source-of-truth matrix, editable only through validated/rule-reviewed changes; configuration versioning.
- Connections & Settings: status, reconnect, scope visibility, pause/resume individual sync types, manual reconciliation with confirmation, audit log.

## UI design

Quiet, efficient, low-density admin interface with clear next actions, plain labels, accessible color contrast, helpful timestamps and human-readable reasons. Desktop-first but usable on mobile. Avoid animation-heavy effects and ambiguous icon-only controls. Use separate destructive-action confirmations.

## Minimum views for v1

`/login`, `/overview`, `/activity`, `/links`, `/bookings`, `/reviews`, `/conflicts`, `/settings/connections`, `/settings/mappings`, `/audit`.

## Admin operations policy

- Read-only dashboard during Phase 0.
- Controlled pause/resume; no silently dropped events while paused.
- Retry selected failed job only if idempotency verified, and after a recent provider-state check.
- Explicit audit entry for all manually triggered operations.
- Human approval required for ambiguous matches, invalid addresses, unconfirmed bookings and payment-related anomalies.

See `reference/dashboard_wireframe.html` for static style/structure inspiration; Cursor should build a true Next.js interface, not embed this HTML as the application.
