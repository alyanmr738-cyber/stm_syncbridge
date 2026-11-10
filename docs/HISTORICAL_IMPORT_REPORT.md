# Historical import — dry-run

**Gate B:** OFF. No production backfill executed.

## Planned stages (code path)

1. Inventory Jobber clients/properties/jobs/visits/quotes/invoices (paginated GraphQL).
2. Inventory GHL contacts/opportunities (paginated REST).
3. Match via existing links → email/phone+property → ambiguous queue.
4. Report counts; no review/nurture/invoice reminders.

## Dry-run counts (this run)

Not executed against live pagination in this deploy. Run after Jobber token refresh is stable via an admin “preview import” action (not yet exposed as a write).

| Entity | Count | Notes |
|--------|-------|-------|
| Jobber clients | pending live page | |
| GHL contacts | pending live page | |
| Ambiguous | — | never auto-merge |

**NO-GO for B** until dry-run totals are accepted by All Access Digital + Septic Tank Man.
