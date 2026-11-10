# SyncBridge Production Completion — Cursor Handoff

**Use this package with the existing repo. Do NOT create a new Next.js project.**

## Goal

Finish the Jobber ↔ HighLevel integration for Septic Tank Man using existing Next.js/Vercel + Supabase assets, test it end-to-end, deploy safe production code, and separately authorize operational writes, historical import, and customer messaging. Do not confuse production deployment with all production actions being activated.

## Current state from Cursor's November 10 handoff

- Existing production URL: https://stmsyncbridge.vercel.app
- Repository: https://github.com/alyanmr738-cyber/stm_syncbridge
- Supabase project: `bevweuqllbvpombsqqzu`
- GHL location: `p7HYMD0h2RScLKL68uj0` (Septic Tank Man; confirm live)
- Jobber OAuth, GHL PIT and Supabase reported connected.
- Missing Jobber refresh-token rotation, persistent webhooks, GHL signature verification, durable queue, live API capability audit, real sync logic, historical reconciler, service mapping and real admin pages.
- Existing migration: `supabase/migrations/0001_initial.sql`.
- Existing three production gates A=outbound writes, B=historical import, C=customer messaging (OFF).

## How to use

1. Open the existing SyncBridge repo in Cursor.
2. Add this handoff folder to the workspace or attach these files to Cursor.
3. Paste all of `CURSOR_MASTER_EXECUTION_PROMPT.md` into Cursor's Agent/Plan mode and give it access to the existing repo.
4. Keep `CURRENT_CURSOR_HANDOFF_SOURCE.md` as the authoritative current-code handoff and the original project spec in the repo as reference.
5. Let Cursor complete every unblocked phase; ask it for actual commits, verification, test logs and truthful go/no-go. It should not end at a planning-only response.
6. No secrets belong in chat or Git. Fill Vercel secrets / `.env.local` directly.

## Files

- `CURSOR_MASTER_EXECUTION_PROMPT.md`: paste into Cursor; full ordered execution.
- `CURRENT_CURSOR_HANDOFF_SOURCE.md`: original user-provided current implementation report (copied, text escaped exactly as received).
- `RELEASE_GATES_AND_DECISIONS.md`: what can be built/deployed without business permission, and what cannot be activated.
- `ACCEPTANCE_TEST_MATRIX.md`: minimum automated/manual checks.
- `ENVIRONMENT_AUDIT.md`: env inventory and account boundaries.

## Explicitly unresolved business matters

- The exact meaning of "2-hour buffer" (minimum lead-time versus between-visit spacing versus travel).
- Authoritative Jobber service catalog and durations, needs live audit/business validation.
- Whether live Jobber GraphQL supports atomic availability/slot reservation. If not, use pending/manual Jobber confirmation, not false booking success.
- Human approval for production A writes, B backfill and C messaging; Jobber authorized account operator.
- Emergency auto-book remains OFF by design.

## Not in scope

- Building a new CRM, taking over Jobber invoicing, rewriting AI prompts for sales, custom phone number procurement, unrelated Arizona Sign Company integrations, unapproved mass messaging.
