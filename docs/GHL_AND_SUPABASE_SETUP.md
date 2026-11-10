# HighLevel + Supabase setup (one-client project)

## GHL

1. Sign into **Septic Tank Man's** HighLevel sub-account (NOT Arizona Sign Company).
2. Settings → Private Integrations → create `Septic Tank Man — Jobber SyncBridge`.
3. Start with minimum read scopes for contacts, opportunities, calendars/appointments, custom fields/notes as needed; later add write scopes after audit. Exact names should be verified in current HighLevel UI/docs.
4. Keep the token securely in `GHL_PRIVATE_INTEGRATION_TOKEN` server env; set `GHL_LOCATION_ID` from **this** sub-account only.
5. Version header per actual endpoint, not globally assumed (document which operations use v3 vs date-based versions).
6. Inventory existing GHL pipelines, stages, calendar, Voice AI, review workflow, lead/contact/opportunity-created triggers, and opt-out settings. Store real mapping IDs in server-managed configuration (not public frontend).
7. **Do not** enable review sending until event trigger, consent and dedupe path are proven in staging.

## Supabase

1. Create a **new dedicated** Supabase project for Septic Tank Man (no shared client data).
2. Save URL and publishable/anon key for browser authentication if used; secret/service key *server only*.
3. Require strong admin auth, allowlist All Access Digital admin IDs, and audit all privileged operations.
4. Review `database/0001_schema_proposal.sql` before applying; verify desired RLS, extensions, roles and encryption strategy in Cursor.
5. Use separate staging and production Supabase projects and credentials.
6. Provider OAuth tokens encrypted at rest with `TOKEN_ENCRYPTION_KEY_BASE64` held in server env, not in browser or plaintext DB rows.

## Helpful official docs

- https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/
- https://marketplace.gohighlevel.com/docs/
- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/guides/auth
- https://vercel.com/docs/environment-variables
