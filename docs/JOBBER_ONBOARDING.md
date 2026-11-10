# Jobber app credentials — beginner walkthrough (current as of 2026-11-10)

## Important: there is no Jobber API key to paste

Jobber uses **OAuth 2.0**, not a single permanent API key. The developer creates an app and gets:

- `JOBBER_CLIENT_ID` — identifies your integration app.
- `JOBBER_CLIENT_SECRET` — sensitive server-only application secret.
- `JOBBER_OAUTH_CALLBACK_URL` — a URL implemented in our Vercel app that Jobber redirects to after an admin clicks Allow Access.
- **Access and refresh tokens come later**, *after an authorized Septic Tank Man admin connects the app*. They should be encrypted in Supabase, never manually saved in .env or sent in chat.

## Step 1 — Make a Jobber Developer Center account

1. Visit https://developer.getjobber.com/ and select sign up/sign in to Developer Center.
2. This login is distinct from the Septic Tank Man business's operational Jobber account. You need a developer account to manage the integration, and a Jobber account to test/authorize it.
3. If you don't already have a safe test Jobber account, follow https://developer.getjobber.com/docs/getting_started/ to register a developer testing account (official docs describe a 90-day testing window). **Do not use real customer data for first experiments.**

## Step 2 — Create your private/custom app

1. In Developer Center, open **Apps → New** (the UI also references Manage Apps).
2. Suggested app name: `Septic Tank Man — Jobber GHL SyncBridge`.
3. Suggested developer name: `All Access Digital` (use the actual account owner/company label if different).
4. Suggested description: `Private integration to synchronize clients, properties, scheduling, jobs, estimate/invoice statuses and selected notes with the Septic Tank Man GoHighLevel sub-account. Internal use only.`
5. Select the **least-privilege scopes** required for clients, properties, jobs, visits/scheduled items, quotes, invoices, notes and relevant account/user/scheduling reads. The *exact scope labels in your Developer Center* must be copied to `docs/API_CAPABILITY_REPORT.md` after you see the UI; do not guess names from this guide. For Phase 0, start with READ scopes only, then add write scopes in Draft state after auditing.
6. Leave the app in **Draft** state; do not request a marketplace listing. A single-client private/custom integration is supported subject to documented eligibility/limits. If the portal restricts your app, contact Jobber support before proceeding.
7. Save/Create the app.

## Step 3 — Find your Client ID and Client Secret

1. In Developer Center select **Manage Apps** (or Apps), open your new app's settings/details.
2. Find the displayed **Client ID** and **Client Secret**. They belong to *the app*, not a particular Jobber customer.
3. Copy these **locally** into `.env.local` (created from `.env.example`):

   ```dotenv
   JOBBER_CLIENT_ID=your_actual_client_id
   JOBBER_CLIENT_SECRET=your_actual_client_secret
   ```

4. Do **not** send the Client Secret in this chat, Cursor prompts, screenshots, emails, or Git commits. Do not regenerate it casually—doing so revokes refresh tokens.

## Step 4 — Decide the callback URL

The app needs a public HTTPS callback before a real customer can authorize it. Have Cursor first implement the OAuth callback route with state + PKCE and secure token exchange, for example:

`https://YOUR-PRIVATE-STAGING-DOMAIN/api/oauth/jobber/callback`

This is an **example route designed by us**, not an automatically provisioned Jobber URL. Register the *exact* deployed callback URL in the Jobber app's OAuth Callback URL field, then set the matching local/Vercel env value `JOBBER_OAUTH_CALLBACK_URL`. If localhost is unsupported or unreachable in your flow, use a secured HTTPS staging deployment. Don't redirect Jobber auth codes to a route that isn't built yet.

## Step 5 — Quick read-only schema test (optional)

Jobber's Developer Center provides **Manage Apps → ⋯ → Test in GraphiQL**. With a dedicated testing account, authorize the app and query:

```graphql
query GetAccount {
  account { id name }
}
```

This verifies Jobber auth and the account identity. **Important:** GraphiQL gives a temporary access token (about 60 minutes), *not production credentials*. Each new Test in GraphiQL can invalidate an existing refresh token for the same app+admin. Use a dedicated test connection and do NOT repeatedly open GraphiQL against a live integration.

## Step 6 — Connect the REAL Septic Tank Man Jobber account (later)

1. Have Cursor implement the OAuth connect button and callback first.
2. Open the secure admin dashboard in a browser, choose **Connect Jobber**.
3. Have a Septic Tank Man **Jobber administrator** log in, inspect requested permissions, and click **Allow Access**.
4. OAuth redirects to the callback; the server exchanges one-time code for access+refresh tokens, encrypts/saves both, fetches `account { id name }` and verifies it's Septic Tank Man.
5. In dashboard, show **Connected — [Jobber account name]** only after verifying account identity and a read-only query. Do not display raw tokens.
6. Read-only sync capability audit first; production writes remain disabled.

## Step 7 — Configure webhooks (only after route works)

Within Jobber app settings, subscribe to only the verified event topics identified in Phase 0 and use your deployed URL, e.g. `https://YOUR-DOMAIN/api/webhooks/jobber`. Each Jobber webhook includes `X-Jobber-Hmac-SHA256` based on your app Client Secret. Verify raw bytes and return 2xx within one second after durable enqueue.

## Step 8 — Vercel secrets

In Vercel Project Settings → Environment Variables, set app credentials in the appropriate environment scope. Keep staging and production isolated. Update the OAuth Callback URL only when final domain and callback route exist. Never put the Client Secret into `NEXT_PUBLIC_*` env vars.

## Troubleshooting

- Can't see Developer Center app details? Confirm you created a developer account at **developer.getjobber.com**, not just a regular Jobber account.
- No API key shown? Expected—Jobber uses app ID/Secret + admin OAuth authorization.
- OAuth redirect error? Check callback URI exact match and route accessibility; verify state/PKCE.
- Auth 401 after 60 minutes? Implement refresh; store rotated refresh token atomically.
- Wrong business account connected? Disconnect and reauthorize the correct authorized business admin.
- Live Jobber mutations? Use an isolated test business and owner approval.
- Need private integration help? Jobber API support: `api-support@getjobber.com` (check latest official docs).

## Official reading

- https://developer.getjobber.com/docs/getting_started/
- https://developer.getjobber.com/docs/custom_integrations/
- https://developer.getjobber.com/docs/building_your_app/app_authorization/
- https://developer.getjobber.com/docs/building_your_app/refresh_token_rotation/
- https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/
