# Decision register — authoritative user selections

| Topic | Locked decision |
|---|---|
| Business | Septic Tank Man; internal integration operated by All Access Digital |
| Systems | Jobber + HighLevel, two-way through Vercel integration server |
| Jobber authority | Customer information, addresses, jobs, technician schedule, quotes, invoices and job completion |
| GHL authority | Marketing lead source, AI, communications, pipeline and automation mechanics |
| Conflict precedence | Jobber wins verified customer information conflicts; GHL edits can be proposed to Jobber, then reconciled from Jobber |
| New GHL appointment | Create Jobber job for *new service request*, subject to validated Jobber availability and confirmed scheduling |
| Reschedule or additional visit | Reuse mapped Jobber job; create/update associated visit as appropriate |
| Unavailable appointment | Offer alternative time; never confirm original requested slot |
| Calendar | Jobber is authoritative; after it reaches Jobber, client handles field scheduling/invoicing |
| Completion trigger | Jobber job completed; not merely GHL appointment end or visit completion |
| GHL completion response | Linked per-job opportunity → agreed Completed Job stage; review workflow once per completed job, including repeats |
| Estimates/invoices | All creation and money handling in Jobber; statuses only synchronize to GHL |
| Communication | AI call/text summaries plus timestamp to Jobber internal note; full conversation remains in GHL |
| History | All accessible historical records and future changes; import must not issue notifications |
| Unknown customer | Create separate record if truly unmatched; never blindly merge; ambiguity to admins |
| Dashboard | Only authorized All Access Digital administrators |
| Deploy | Dedicated Vercel project + dedicated Supabase project for this client (no cross-client database) |

## Business notes captured earlier (not all are in core build)

Business desired phone attribution by website/LSA/Meta/GMB; after-hours Voice AI, AI call summaries, SMS notifications to staff; Jobber calendar link for technicians; quote reminder cadence (1 day, 7 days, one month); invoice reminder; annual service check-in; address autocomplete; service visit notes; e-sign estimates; pricing/service PDFs; 2-hour buffer for nonemergency services; special emergency scheduling; technician-specific notification rules; time sheets; commission reports; field checklists.

**Scope line:** This package delivers the *Jobber↔GHL sync backbone* and only enables workflows dependent on that integration after separate approval. It does NOT automatically build new AI agents, buy numbers, build Jobber pricing/estimate templates, implement Jobber clock-in/out, or change marketing pipelines. These may be future integration consumers.

## Do not confuse with earlier unrelated GHL project

Arizona Sign Company had a separate Trello→GHL Zap, with its own location/pipeline IDs. **Never reuse those IDs, tokens, contact records or stages for Septic Tank Man.** Discover Septic Tank Man identifiers under its GHL sub-account.
