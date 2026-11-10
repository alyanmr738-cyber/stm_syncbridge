# Workflow contracts (draft, API-gated)

## A. GHL → Jobber new booking

**Inputs:** `ghlLocationId`, `ghlContactId`, `ghlAppointmentId`, service type, property/service address, requested start/end, contact consent and booking source.

1. Authenticate/validate event and sub-account; deduplicate on provider event identity and appointment ID + change version.
2. Link or create customer **only after confident match check**. Jobber verified values win and update the GHL contact.
3. Normalize and validate service address/property. Never interpret billing address as service address without evidence.
4. Determine whether the appointment has a linked Jobber visit; if so, treat it as reschedule/update, not new service.
5. If truly new service, create a Jobber job **only when permitted by validated API**; use a stable intent key so retry doesn't duplicate it.
6. Check availability, service duration, buffer, tech capacity, service area, emergency rules under Jobber authority; validate and create/reschedule the visit.
7. Confirm in GHL only when Jobber scheduling record exists at same slot and has been verified.
8. If unavailable, mark GHL appointment *unconfirmed/pending* and offer validated alternatives. Never send a final booking confirmation prematurely.

**Compensation:** If client created but job/visit failed, record partial state. Retry from persisted step; do not re-create client; alert admins. Avoid destructive rollback of real Jobber records.

## B. Jobber → GHL completion/reviews

- Fetch Jobber job after signed completion webhook; require actual `jobStatus` / completion evidence, not `visit.isComplete` or appointment end alone.
- Resolve mapped per-job GHL opportunity. If missing and approved, create directly in designated target pipeline/stage with suppression of unintended workflows; never pass through New Lead.
- Update to `Completed Job`; no update if already there. Trigger review via explicitly documented/dedicated inbound workflow, **not only** a pipeline-stage transition.
- Write unique review authorization keyed by `(jobber_account_id, jobber_job_id, review_type)`; one per completed job, even if customer has multiple jobs.
- Respect contact preferences/consent/suppression and HighLevel communication limits; store accepted/unknown/sent/failed/confirmed statuses distinctly.
- Reversal or duplicate webhook does not reauthorize review. Historical completion events do not send messages.

## C. Jobber → GHL estimate/invoice

- Jobber quote/estimate status drives GHL fields/pipeline and optional follow-up automation: 1 day, 7 days, 1 month after sent when unresolved (final messaging rules need approval).
- Jobber invoice status drives GHL reminders/task/state; Jobber remains system of record for amounts, issuance, payment/refund and estimates.
- Do not originate invoice or estimate from GHL. Stop reminders when quote accepted/declined or invoice paid/voided where supported.

## D. GHL AI → Jobber notes

- Capture completed AI call/SMS-thread summary, source ID, event timestamp, author/source, contact and optional job link.
- Match a verified Jobber client/job; append a distinct internal note only through approved mutation; never overwrite technician notes.
- Dedup by GHL call/conversation ID + summary revision/hash. Full transcript stays in GHL. User opted for summaries, not all SMS.

## E. Jobber authoritative customer updates

- On Jobber customer/property update, refresh actual object; map corresponding GHL contact; update only authoritative fields and preserve GHL marketing fields.
- If GHL modifies master contact data, apply a validated update to Jobber if allowed; re-fetch Jobber's actual saved values then reconcile to GHL. If rejected/conflicting, keep source state and alert; never clobber verified Jobber values.

## F. Historical import

- Snapshot/inventory both systems; dry-run report counts, missing fields, suspected duplicates and cross-links.
- Import customers, service properties, jobs/visits, quotes, invoices, contact links and GHL opportunities in staged pagination.
- Disable automations and outbound communications; do not retroactively send review, invoice or annual reminders.
- Carry historical completed service date and source history so future annual follow-ups can be computed after separate authorization.
- Record checkpoints and reconciliation count by type; resumable and idempotent.
