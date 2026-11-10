# Sync engine status — 2026-11-10

Gates A/B/C remain **OFF**. No production writes executed.

## Handler-by-handler

| Area | Status | Notes |
|------|--------|-------|
| Jobber client → GHL contact | **Implemented, live query verified, writes gated** | 2026-11-03 `emails[]`/`phones[]`/`clientProperties`. PUT/POST GHL + custom field Jobber Client ID `saS3lqgdYaw8RPz95NZd`. |
| Properties → GHL address | **Implemented, gated** | First property street/city/zip on contact; `property_links` upsert. |
| GHL contact → Jobber → Jobber-authoritative GHL | **Implemented, not live-write verified** | `clientEdit(clientId, input)` with `emailsToAdd`/`phonesToAdd` (schema has no `input.id`). Then GHL PUT from Jobber. |
| Identity with empty link tables | **Implemented + unit tested** | DB link, then GHL search, then Jobber `clients(searchTerm)`. Ambiguous → conflict, no merge. |
| Jobs → GHL opportunities | **Implemented, not live-write verified** | Search pipeline opps by contact; reuse one; conflict if many; create only when write allowed. |
| Reschedule / visits | **Implemented as pending** | `pending_jobber_confirmation`; reuse `job_links` by jobber job id / booking key. No fake slots. |
| Job closed → Job Completed | **Implemented, gated** | Stage `1724dc1d-…`. Review row suppressed unless Gate C. |
| Quote/invoice → GHL | **Partial** | Jobber quote/invoice **queries** implemented. GHL: contact **note** when `ESTIMATE_SYNC_ENABLED` / `INVOICE_SYNC_ENABLED` **and** write allowed. No dedicated GHL quote/invoice custom fields (only Jobber Client ID). Dashboard shows DB vs GHL note. |
| AI summary → Jobber notes | **Implemented, gated** | `jobCreateNote(jobId, input)` / `clientCreateNote(clientId, input)` per 2026-11-03. Hash de-dupe. |
| Queue / cron / HMAC / GHL 401 | **Verified live** | Minute cron on Pro; webhook drain; unsigned GHL 401. |
| Token refresh | **Verified earlier** | Rotated refresh persisted. |

## Fixed this pass

- `clientEdit` / note mutations match 2026-11-03 argument shape.
- Matching without `customer_links`.
- Job → opportunity search/reuse (no duplicate jobs).
- Quote/invoice live Jobber fetch + optional GHL note.
- Webhooks registered: JOB_CREATE/UPDATE/CLOSED, QUOTE_UPDATE, INVOICE_UPDATE, VISIT_CREATE (plus existing CLIENT_*).
- Links dashboard shows quotes/invoices GHL vs DB-only.

## Read-only e2e candidate (no writes)

- Jobber: `Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDQ4Ng==` ABEL & PRISCILLA VIAMONTES, phone `(941) 275-4761`. Search hits exactly one Jobber client.
- GHL search for that phone/name: **no contact**. A write would **POST a new GHL contact** — not an existing-link update. **Do not approve** until a GHL contact is chosen or created in GHL UI.
- Sample GHL contact `M5ot6TBqtG6k8cVN4DWY` (brian grochowalski / `bwmegroch@comcast.net`) has **no** Jobber `searchTerm` hit.

## Remaining for controlled live test

Named **existing** Jobber GID + **existing** GHL contact id with matching phone/email, typed `PILOT_*`, update-only. Then `ESTIMATE_SYNC_ENABLED`/`INVOICE_SYNC_ENABLED`/`JOB_COMPLETION_SYNC_ENABLED` only if those ops are in scope. Still no Gate A/B/C.
