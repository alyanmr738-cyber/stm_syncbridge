# Historical import dry-run (Gate B OFF — no writes)

Live Jobber GraphQL `totalCount` and GHL contacts list, 2026-11-10, account Septic Tank Man.

| Source | Count | Notes |
|--------|------:|-------|
| Jobber clients | 7140 | Matching needed vs GHL |
| Jobber jobs | 8068 | Reuse on reschedule; do not duplicate |
| Jobber quotes | 822 | Status → GHL reference table first |
| Jobber invoices | 2511 | Status → GHL reference table first |
| GHL contacts (API meta.total) | 1032 | Far fewer than Jobber clients |
| Linked `customer_links` in SyncBridge | 0 (unless added after this run) | Unmatched majority |
| Ambiguous | Unknown until email/phone pass | Expect hundreds of shared household phones |

**Unmatched customers:** ~Jobber 7140 vs GHL 1032 implies most Jobber clients have no GHL contact. Backfill would **create** GHL contacts unless matching-only mode is chosen. That would fire published New Lead workflows.

**Service dates / visits:** not bulk-exported in this dry-run (would require paginating `jobs`/`visits`). Plan: page Jobber jobs by `updatedAt`, attach visits, skip auto-schedule.

**Estimates/quotes/invoices:** store in `quote_links` / `invoice_links` first; GHL custom-field IDs are **not** mapped yet — no GHL field writes in backfill v1.

**Do not run Gate B** until: (1) matching rules approved, (2) New Lead workflows paused or scoped, (3) written Gate B approval, (4) batch size and pause switch.
