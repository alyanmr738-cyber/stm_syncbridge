# Production readiness report — 2026-11-10

## Verdict

**Production-ready code with gates OFF.** Not “fully live” operational sync.

| Feature | GO/NO-GO | Why |
|---------|----------|-----|
| Admin dashboard | GO | Real Supabase-backed lists |
| Jobber OAuth connect | GO | Live Septic Tank Man |
| Jobber token refresh | GO (code) | Needs 0002 lock table + valid refresh token |
| GHL PIT | GO | Location verified |
| Webhook HMAC Jobber | GO | Fail closed; durable persist or 503 |
| Durable postgres queue | GO (code) | Cron `/api/internal/process-queue` — set `CRON_SECRET` on Vercel |
| Auto booking confirm | **NO-GO** | Availability unproven; pending path |
| Jobber writes | **NO-GO** | Gate A OFF |
| Historical import execute | **NO-GO** | Gate B OFF |
| Reviews / SMS | **NO-GO** | Gate C OFF |
| Emergency auto-book | **NO-GO** | Flag OFF |

## Implemented this completion pass

- Encrypted Jobber refresh with lock table
- Postgres `queue_jobs` worker + persist-before-ack inbox
- Fail-closed Jobber webhooks; GHL signature support
- Login rate limit + origin check
- Gated sync engine (booking pending, job closed review suppressed)
- Identity helpers (ambiguous / create)
- Live discovery (GraphQL names, GHL pipelines/calendars)
- Admin screens read from DB
- RLS revoke anon in migration 0002
- Vercel cron every minute
- Tests: identity, HMAC, pending booking, flags, audit

## Deploy

Push `main` → existing Vercel project. Apply `supabase/migrations/0002_production_hardening.sql` on project `bevweuqllbvpombsqqzu`.

Set `CRON_SECRET` and keep `OUTBOUND_WRITES_ENABLED=false`.

## Tests

```
npm test
npm run build
```
