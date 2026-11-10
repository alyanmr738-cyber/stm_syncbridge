# API Capability Report — SyncBridge

**Status:** Phase 0 — initial scaffold (mock / pre-live)  
**Last generated:** _(run audit from admin or `npm run audit:capability`)_  
**Mode:** `mock` until Jobber OAuth and GHL PIT are configured in `.env.local`

## Executive summary

| Area | Status | Notes |
|------|--------|-------|
| Jobber GraphQL scheduling | **Unverified** | Default path: `pending_jobber_confirmation` |
| Jobber OAuth + webhooks | **Not connected** | Draft app + callback route scaffolded |
| GHL pipelines / review workflow | **Unverified** | Discover in authorized sub-account |
| Business timezone | **Discover on connect** | Compare Jobber vs GHL profile |
| Service catalog mapping | **Pending inventory** | Jobber authoritative |
| Production writes | **Disabled** | `OUTBOUND_WRITES_ENABLED=false` |
| Customer messaging | **Disabled** | `CUSTOMER_MESSAGING_ENABLED=false` |
| Historical backfill | **Disabled** | `HISTORICAL_IMPORT_ENABLED=false` |

## Capability matrix

_Regenerate via **Settings → Capability audit** or `GET /api/admin/audit/capability`._

| Operation | Provider | Verified? | Evidence | Fallback | Recommended path |
|-----------|----------|-----------|----------|----------|------------------|
| client CRUD | Jobber | No | Awaiting GraphiQL + OAuth | Manual client workflow | Phase 0 live audit |
| visit schedule/reschedule | Jobber | No | Awaiting schema proof | `pending_jobber_confirmation` | Phase 3 pilot |
| availability reserve | Jobber | No | Not assumed | Pending + scheduler | Decision §1 |
| job completion | Jobber | No | Webhook topics TBD | Reconciliation poll | Phase 4 |
| contacts/opportunities | GHL | No | PIT scopes TBD | Dry-run | Phase 0 |
| Completed Job stage | GHL | No | ID discovery | Admin mapping | Phase 0 |
| review workflow | GHL | No | Dedicated inbound trigger | Disabled | Phase 4 + gate C |

Integration behaviors (pending path, review ledger, import suppression) are **verified by architecture decision**, not provider API.

## Unsupported or unverified (live audit required)

- Jobber slot reservation and automatic GHL confirmation
- Exact GraphQL mutation names for visits, notes, clients
- GHL calendar IDs used by Voice AI
- Review workflow entry that does not rely solely on Pipeline Stage Changed
- Jobber online booking as fallback (investigate; do not assume GraphQL parity)

## Business approvals still required

1. Production writes  
2. Historical backfill execution  
3. Customer messaging (reviews, reminders, notifications)  
4. Two-hour buffer semantics (lead time vs between-visit vs travel)  
5. Customer-facing manual-confirmation booking (if auto-confirm unavailable)

## Recommended production implementation path

1. Connect Jobber (OAuth) and GHL (PIT) in staging; re-run capability audit in `live_readonly` mode.  
2. Document timezone, pipelines, stages, calendars in `ACCOUNT_MAPPING.md`.  
3. Map GHL services → Jobber catalog; resolve `review_required` rows.  
4. Sandbox booking tests T05–T10 with flags still OFF for production.  
5. Enable **gate A** for pilot writes only after signed capability matrix.  
6. Dry-run historical import; enable **gate B** only after reconciliation report.  
7. Enable **gate C** only after review + consent audit.

## Official references

- https://developer.getjobber.com/
- https://marketplace.gohighlevel.com/docs/
