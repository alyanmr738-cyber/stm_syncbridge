# Priority 3 — Code complete behind flags, not production activated

## Historical Gate B — dry-run only

- Fresh read-only inventory for existing Jobber clients, jobs, visits, quotes, invoices vs GHL contacts/opportunities, with pagination and timestamps. The last read-only counts (7,151 clients, 1,061 contacts) are **historical snapshots**.
- Match existing by provider IDs then high-confidence identity; create proposed actions by bucket: existing verified update; candidate manual review; potential new creation; deleted/archived skip; unresolved collision; job/opportunity unmatched. Provide expected volume and **per-action suppress-side-effects** risk.
- Dry-run report includes proposed new contacts, unmatched jobs, duplicated owners, questionable PII, and counters for each batch; never write due to dry run.
- Implementation should support small batch, idempotent natural keys, checkpoint resume, rate limits, pause/resume, validate-after-write, rollback *plan* (not pretend DB rollback undoes provider writes) and zero customer messages.
- No actual backfill without exact approved batch, reviewer, side-effect control, schedule, proof and release decision.

## Record creation

`ALLOW_RECORD_CREATION=false` remains. Design for real creates only once approved: dedup global email/phone + account/location, live GHL/Jobber lookup, conflict/manual validation, provider create, linkage persisted and compensation on ambiguous failures; never create new job for a mere lead/contact record. Ensure workflow side effects considered before any live creation.

## Quote / invoice / AI

- Respect switches at the **top of handler**, before fetching Jobber. Disabled means suppressed, not repeated auth or API calls.
- Jobber invoice state is source of truth. Do not label `requires_invoicing` as paid.
- Quote follow-up schedule only after approval, stops on status change, preserves consent. No promises of native GHL financial objects unless provider confirms API.
- AI conversation summary internal Jobber note once; no transcript leakage in public/customer-visible notes, no full sensitive transcript payload in logs.

## Reviews / Gate C

- Review ledger keyed by `(Jobber account, Jobber job)` and recipient consent; block duplicates after reopen/reclose; different real jobs may each qualify independently if approved frequency/consent permits.
- Historical import never triggers reviews. Completion from `requires_invoicing` may move GHL stage but **does not** authorize review send.
- GHL Workflow 4 Service Completed stays DRAFT; do not publish. Check for other native workflows that might message after a contact/opp PUT; coordinate review trigger only under separate C launch review.

## Admin UX expectation

Admin sees genuine sync health, verified vs pending customer and job links, reason-coded conflicts, requests awaiting Jobber confirmation, historical dry-run counts, suppressed vs delivered reviews, and explicit gates. No fake example counters masquerading as live. Clear empty and error states. Protected admin actions, CSRF/role enforcement and audit.
