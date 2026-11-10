# Handler-by-handler matrix (Gates A/B/C OFF)

Jobber GraphQL **2026-11-03**. GHL REST PIT location `p7HYMD0h2RScLKL68uj0`.

| Event | Source object | Destination | Match | Intended write | API status | Idempotency | Recovery | Workflow risk |
|-------|---------------|-------------|-------|----------------|------------|-------------|----------|---------------|
| Jobber `CLIENT_CREATE` / `CLIENT_UPDATE` | Jobber client GID | GHL contact | Link by Jobber id, else email search; ambiguous → conflict | PUT existing GHL contact **or POST new** | **Query fixed** to `emails[]`, `phones[]`, `clientProperties` (not `.nodes` on Email). Writes gated | Event key `topic:id:occurredAt`; contact upsert by id | Retry queue; skip non-GID probes | **POST contact** → Workflow 1, I1. **PUT contact** → Z7 Zapier |
| GHL ContactCreate/Update | GHL contact | Jobber client then Jobber-authoritative GHL PUT | Link by GHL id / email / phone | `clientEdit` or `clientCreate` then GHL PUT | Mutations exist on schema; **not live-tested** | Event key `ghl:type:id` | Retry; GateClosed → suppressed | Jobber create is internal. GHL PUT → **Z7**. Jobber `CLIENT_UPDATE` webhook may loop; second pass should no-op if fields match |
| Jobber PROPERTY_* | Property | `property_links` + GHL address fields on contact | Via client | Address on GHL contact | Implemented as part of client sync, first property only | property_links upsert `jobber_property_id` | Retry with client event | Address workflows (Directions) if GHL address changes |
| GHL Appointment* / Jobber VISIT_CREATE | Appointment / visit | `appointment_links` | Booking key / job_link | **No Jobber schedule write** | `pending_jobber_confirmation` by design (no availability API) | Upsert by `ghl_appointment_id` | Conflict row | Native GHL appointment workflows already fire in GHL; we do not create GHL appointments |
| Jobber JOB_CREATE/UPDATE / VISIT_UPDATE | Job GID | `job_links` | Existing `jobber_job_id` | Reuse row; no second Jobber job | `job { id jobStatus client }` | Unique jobber_job_id | Retry | Low unless completion path |
| Jobber JOB_CLOSED | Job | GHL opportunity stage Job Completed | Existing job_link.ghl_opportunity_id | PUT opportunity stage **or POST opportunity** if missing | GHL PUT implemented; **requires** `JOB_COMPLETION_SYNC_ENABLED` **and** pilot/Gate A | job_links upsert; review_deliveries unique per job | Retry | **Workflow 4 — Service Completed**. Review send only if Gate C (currently suppressed row) |
| QUOTE_* / ESTIMATE | Jobber quote | `quote_links` only | quote id | **DB status only** — **not** GHL custom fields | **Incomplete vs GHL** | upsert `jobber_quote_id` | Retry | None until GHL field mapped |
| INVOICE_* | Jobber invoice | `invoice_links` only | invoice id | **DB status only** — **not** GHL | **Incomplete vs GHL** | upsert `jobber_invoice_id` | Retry | None until GHL field mapped |
| AI summary | GHL summary payload | Jobber note | hash of body | `clientCreateNote` / `jobCreateNote` | Mutations exist; gated `AI_SUMMARY_SYNC_ENABLED` | `note_deliveries.summary_hash` | Skip duplicate hash | Internal Jobber note, not customer SMS |

Booking stays pending. Emergency auto-book off.
