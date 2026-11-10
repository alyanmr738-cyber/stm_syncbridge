# API Capability Report — SyncBridge

**Generated:** 2026-11-10 (code deploy with live discovery hooks)  
**Mode:** `live_readonly` when OAuth + `JOBBER_GRAPHQL_VERSION` + PIT are set.

## Account identity (from production Connections UI)

| System | Status | Notes |
|--------|--------|-------|
| Jobber | Connected | Business name Septic Tank Man; encoded account ID stored in `sync_connections` (not printed here) |
| GHL | Connected | Location `p7HYMD0h2RScLKL68uj0`, name Septic Tank Man, timezone **America/New_York** |
| Supabase | Connected | Schema `0001` applied; `0002` hardening pending apply if not yet run |

## Scheduling / availability (critical)

**Slot reservation:** treated as **unsupported until live introspection lists availability-like fields**. Fallback **`pending_jobber_confirmation`** + conflict queue for staff. **Do not auto-confirm GHL appointments.**

Re-run **Settings → Audit** after this deploy; live GraphQL query/mutation name hits are merged into the matrix when Jobber token is valid.

## Jobber operations

| Operation | Status | Fallback |
|-----------|--------|----------|
| OAuth + refresh rotation | Implemented in app | Reconnect |
| Webhooks HMAC | Implemented fail-closed | 401 |
| Clients / jobs / visits / quotes / invoices | Read via GraphQL when token valid; writes **gated A** | Manual / pending |
| Availability reserve | **Unproven** | pending_jobber_confirmation |
| Internal notes | Mutation names discovered live; writes gated | Admin alert |

## GHL operations

| Operation | Status | Fallback |
|-----------|--------|----------|
| Location profile | Verified live | — |
| Pipelines/stages | Discovered via REST when PIT scopes allow | Map Completed Job in ACCOUNT_MAPPING |
| Calendars | Discovered when scopes allow | Pending bookings |
| Review inbound workflow | **Not verified** | Gate C OFF |
| Webhook Ed25519 | Implemented if `GHL_WEBHOOK_PUBLIC_KEY` set | 401 in prod when key present |

## Gates

A/B/C **OFF**. Code is production-ready; activation is a separate approval (`docs/PRODUCTION_APPROVALS.md`).
