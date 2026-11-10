# Environment inventory and audit instructions

**Do not paste secrets into Cursor chat, this file, GitHub or screenshots.** In Cursor, inspect only variable *presence*, environment scopes, formatting and access control; redact values. Maintain `.env.example` with names and descriptions only.

## Existing required domains

| Group | Expected variable families (adapt to actual project code; inspect names first) | Notes |
|---|---|---|
| App | `APP_ENV`, `APP_BASE_URL`, `USE_PROVIDER_MOCKS` | Vercel production domain and public OAuth/webhook URL |
| Jobber | `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, OAuth callback URI, GraphQL version, allowed account IDs | Refresh tokens stored encrypted DB, NOT in plain env |
| GHL | location ID, private integration token, API Version, optional workflow trigger endpoint | Septic Tank Man only; prefer env/secrets |
| Supabase | project URL, publishable key, server-side service role key | Server key never client-exposed |
| Admin | allowlist, `ADMIN_SESSION_SECRET`, bootstrap/login secret if existing | Upgrade auth hardening; no shared secret rendered |
| Crypto | `TOKEN_ENCRYPTION_KEY_BASE64` | Must remain stable across deployments; rotate via documented re-encryption procedure |
| Queue/worker | `QUEUE_PROVIDER`, internal worker authentication, cron schedule config | Verify Postgres adapter actually used; secure worker route |
| Feature flags | `SYNC_ENABLED`, `OUTBOUND_WRITES_ENABLED`, `HISTORICAL_IMPORT_ENABLED`, `CUSTOMER_MESSAGING_ENABLED`, booking/review/AI/emergency feature switches | All false by default until allowed |
| Monitoring | error tracker DSN, alert webhook, operational email recipients | Optional provider but essential error visibility |

## Current handoff warnings

- Report shows local `.env.local` duplicate `APP_BASE_URL`; fix local/production separation.
- Repo root is Next.js application; avoid setting an incorrect Vercel Root Directory.
- `stmsyncbridge.vercel.app` should be public for OAuth callbacks and webhook ingress, but the dashboard is private through application auth.
- Early 404 resulted from Deployment Protection and domain routing, not a missing repo tree.
- `QUEUE_PROVIDER=postgres` currently may still use in-memory queue in code; do not mistake environment setting for functioning queue.
- Jobber token refresh is not yet implemented despite refresh rotation enabled.
- GHL webhook route currently does not verify signature.
- Current admin allowlist in source report is `info@allaccessdigital.net`; don't publish password or session secret.
- Jobber tokens in DB `sync_connections.encrypted_credentials` are AES-256-GCM encrypted; ensure `TOKEN_ENCRYPTION_KEY_BASE64` present and correct in all relevant environments.

## Credential and deployment controls

- Confirm the exact Jobber account ID and GHL location ID on every operation; reject mismatches.
- Restrict any Supabase operations to project `bevweuqllbvpombsqqzu`.
- Build/test staging with separate credentials or provider-approved sandbox before enabling production writes.
- Production environment variables must be assigned to **Production** scope; preview/dev scopes must not silently point to live customer operations.
- Never send access/refresh tokens in observability logs, API errors or UI.
- `GITHUB_TOKEN` must not be put into Vercel runtime env merely for deploy.
