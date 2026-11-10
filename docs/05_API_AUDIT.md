# Phase 0: mandatory provider capability audit

**This document deliberately separates official confirmed APIs from account-specific/unverified operations.** No writes until audit is accepted.

## Jobber — verified general platform behavior

- Developer portal: https://developer.getjobber.com/
- OAuth 2.0 authorization-code flow with optional/recommended PKCE S256 and state; a business admin must authorize the app.
- Client ID and Client Secret obtained in Developer Center; no permanent Jobber API key.
- GraphQL endpoint: `https://api.getjobber.com/api/graphql` (POST); require Bearer access token, `X-JOBBER-GRAPHQL-VERSION`, JSON body.
- Access token lives ~60 minutes. Refresh token rotation enabled by default; persist newly returned access/refresh tokens atomically with serialized refresh. Avoid repeated Test in GraphiQL against the production connected admin because it invalidates previous refresh tokens.
- Jobber webhook topics are configured in Developer Center, signatures use `X-Jobber-Hmac-SHA256` HMAC over raw body with app Client Secret. Acknowledge within one second. At-least-once deliveries; duplicate events possible.
- Draft custom integration for a single paying Jobber account is permitted under documented limits, with potential specific-customer approval checks. Validate account eligibility before rollout.

## Jobber — must be confirmed via GraphiQL schema/account

- Exact active API version selected from developer portal (DO NOT copy example old versions).
- Exact scopes displayed for clients, properties, jobs, visits, quotes, invoices, notes, services, users/assignments, webhooks.
- GraphQL mutations for client/property/job/visit create and update, any note append; required input fields and `userErrors`.
- Available calendar, technician capacity, recurring visits, booking hold/confirmation and available time slot queries/mutations; whether active job creation automatically schedules a visit.
- Supported webhook topics for job complete, visit changes, quote sent/accepted/declined, invoice state, client changes, and disconnect; some may require polling.
- Whether job completion can be observed as explicit event or requires fetching a job on UPDATE and comparing status.
- Account timezone, service types, emergency handling, duration, scheduling buffer and historical data limits.
- Confirm private/custom integration eligibility with Jobber if Developer Center blocks connection.

## HighLevel — verify

- Septic Tank Man location and authorized PIT/OAuth; scopes at minimum contacts read/write, opportunities read/write, relevant calendars/appointments read/write, custom fields read/write if used, conversation notes and workflows webhooks as needed.
- API Version header per endpoint; `v3` exists but **not every endpoint is necessarily v3**. Verify docs for each operation.
- Exact contact/calendar/opportunity IDs, pipeline and `Completed Job` stage, workflow duplicate checks and existing automations.
- Supported inbound webhook trigger, contact/appointment retrieval and modifications, workflow dispatch and review consent.
- Webhook authenticity and payload schema for whichever HighLevel trigger channel is chosen.

## Capability matrix to fill in before writing mutations

| Operation | Account-specific verified? | Discovery evidence | Fallback if not possible |
|---|---|---|---|
| Jobber client search/read/create/update | NO | GraphiQL schema & test data | Manual new-client workflow |
| Jobber property match/create/update | NO | GraphiQL schema | Admin review |
| Jobber job create with metadata | NO | GraphiQL + safe test | Pending job review |
| Jobber visit create/reschedule/cancel | NO | GraphiQL + safe test | Staff scheduling |
| Availability check and slot reservation | NO | Account UI/API + race test | Unconfirmed pending + alternatives |
| Jobber job completion detection | NO | Webhook event + job fetch | Periodic reconciliation |
| Jobber quote/invoice read statuses | NO | GraphiQL + field mapping | Read-only manual reporting |
| Jobber internal note append | NO | GraphiQL + safe test | GHL-only summary / admin alert |
| GHL contact/opportunity sync | NO for THIS client | Authorized Septic Tank Man account | Dry-run report |
| GHL review workflow entry/status | NO | Test workflow + delivery callbacks | Disabled, admin review |

## Required Phase 0 output from Cursor

`docs/API_CAPABILITY_REPORT.md` with links to specific docs/schema operation names, auth scopes, request/response fixtures with PII redacted, observed limitations, timestamps, rate limits and final go/no-go per capability. `docs/ACCOUNT_MAPPING.md` with explicit IDs and whether sourced from staging or production, stored locally, never inside prompt/chat secrets.
