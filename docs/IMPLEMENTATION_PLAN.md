# Implementation plan — SyncBridge

Aligned with package phases P0–P6 and architecture decisions 2026-11-10.

## Current sprint (foundation + P0 tooling)

| Work item | Status |
|-----------|--------|
| Next.js admin shell + auth allowlist | Done (bootstrap) |
| Supabase migration proposal in repo | Done |
| Feature flags + three approval gates | Done |
| Provider-agnostic queue interface | Done (memory default) |
| Jobber/GHL read-only adapters + mocks | Done |
| Webhook ingestion scaffold | Done |
| Capability audit API + report doc | Done |
| Service mapping UI (read CSV + DB-ready) | Done |
| Acceptance tests (flags, booking pending, gates) | Done (subset) |

## Next (still P0 / early P1)

- Apply Supabase migration to staging project; wire `QUEUE_PROVIDER=postgres`
- Jobber OAuth PKCE callback + encrypted token storage
- Live capability audit with real tokens (read-only)
- RLS / service-role hardening review
- Expand fixture tests for `docs/08_ROLLOUT_AND_TESTS.md` T01–T30

## Phase gates (no skip)

- **P0 sign-off:** `API_CAPABILITY_REPORT.md` live matrix + owner review
- **P1:** encrypted credentials, webhook HMAC, worker leases
- **P2:** historical inventory preview only
- **P3:** booking pilot behind flags
- **P4–P6:** per original package; each needs explicit approval category A/B/C as applicable
