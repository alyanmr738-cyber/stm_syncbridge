# SyncBridge — Septic Tank Man × Jobber × GoHighLevel

Internal integration control center for **All Access Digital** administrators.

**Status:** Discovery / Phase 0 foundation. Production writes, historical backfill, and customer messaging are **disabled by default**.

## Deploy on Vercel

1. Import this repo in Vercel (root directory = repository root).
2. Add environment variables from `.env.example` in **Project Settings → Environment Variables** (use production/staging scopes; never commit secrets).
3. After first deploy, set:
   - `APP_BASE_URL=https://YOUR-VERCEL-DOMAIN.vercel.app`
   - `JOBBER_OAUTH_CALLBACK_URL=https://YOUR-VERCEL-DOMAIN.vercel.app/api/oauth/jobber/callback`
4. Register the **same** callback URL in Jobber Developer Center → your app → OAuth redirect URIs.
5. Apply Supabase migration if the DB is new (`supabase/migrations/0001_initial.sql`).
6. Keep `OUTBOUND_WRITES_ENABLED=false` until Phase 0 sign-off.

**Jobber webhook URL (when ready):** `https://YOUR-VERCEL-DOMAIN.vercel.app/api/webhooks/jobber`

## Quick start

```bash
cd syncbridge
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — sign in with an allowlisted email (see `ADMIN_EMAIL_ALLOWLIST`; dev allows any email if allowlist empty and `ADMIN_BOOTSTRAP_PASSWORD` unset).

## Key paths

| Path | Purpose |
|------|---------|
| `/overview` | Flags, scheduling policy, audit summary |
| `/settings/audit` | Capability matrix (Phase 0 deliverable) |
| `/settings/mappings` | Field ownership spec |
| `docs/API_CAPABILITY_REPORT.md` | Human-readable audit status |
| `supabase/migrations/0001_initial.sql` | Proposed schema |

## Feature gates (independent)

- `OUTBOUND_WRITES_ENABLED` — Gate A  
- `HISTORICAL_IMPORT_ENABLED` — Gate B  
- `CUSTOMER_MESSAGING_ENABLED` — Gate C  

## Scripts

```bash
npm run dev
npm run build
npm run test
npm run lint
```

## Specification

Original handoff package: `../Septic_Tank_Man_Cursor_Package/`  
Architecture decisions: `docs/ARCHITECTURE_DECISIONS_2026-11-10.md`
