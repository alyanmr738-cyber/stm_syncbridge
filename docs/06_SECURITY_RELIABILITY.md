# Security, idempotency and reliability requirements

## Credentials and account isolation

- Secrets only server side in Vercel and local ignored `.env.local`. Never embed in logs, screenshots, shared prompts or NEXT_PUBLIC variables.
- Store Jobber OAuth tokens encrypted at rest in DB. Rotate refresh token atomically; use DB advisory lock or transactional compare-and-swap to prevent parallel refresh invalidation.
- Verify connected Jobber account ID/name and GHL location ID match authorized Septic Tank Man business. Block writes on mismatch.
- No production credentials in preview deployments. Use separate staging project/accounts and env scopes.
- Dashboard accessible only to All Access Digital admins using authenticated RBAC with audit of manual retries/pause/unpause.
- Verify Jobber webhook signature over raw bytes with constant-time compare. Reject unsigned/invalid events before queueing. Similarly verify GHL signatures based on actual selected trigger and current provider documentation.

## Delivery architecture

- Webhook ingestion: authenticate -> validate schema -> persist raw-redacted metadata/envelope and dedupe key -> enqueue -> 2xx within Jobber's 1s requirement.
- Workers: fetch latest authoritative object; compare fingerprint/revision; rehydrate mapping; apply verified domain action with idempotency key; checkpoint outcome.
- At-least-once processing and events out of order are expected. Never treat webhook arrival order as record authority.
- Retries: jittered exponential backoff for 429/5xx/network; bounded retries; stop on 4xx validation/missing scope; dead-letter actionable alerts. Do not retry non-idempotent provider writes without reconciliation.
- Reconciliation: bounded per-resource scans daily and recent window frequent enough for business SLA, with cursors and rate-limit budgeting; monitor queue age and mismatch count.
- Record lock: uniqueness constraints on provider IDs/mappings and on job review ledger. Avoid duplicate creation in concurrent booking requests.

## Customer messaging gates

- Feature flags initial OFF; no automatic review, nurture, estimate, invoice, annual, AI texts until tested and authorized.
- Historical import has a hard technical messaging suppression, not just a UI toggle.
- Per-job review ledger key `(jobber_account_id, jobber_job_id, review_kind)`; reprocessing returns previous state.
- Eligibility: opt-out, consent/channel support, business rules, repeat review cadence, and record contact preferences. Sending workflow only after operation status is saved.
- Remote workflow accepted ≠ message delivered. Reconcile provider receipts/status as available. Unknown should not blindly resend.

## Acceptance security tests

Spoofed Jobber signature; replay with identical payload; valid Jobber update repeated seconds apart; two workers refreshing same token; wrong account token; stale revision; authorization code replay; GHL loop; contact ambiguous collision; worker crash after provider create before DB write; missing secrets; PII redaction; service role never shipped to client; runtime flag OFF.
