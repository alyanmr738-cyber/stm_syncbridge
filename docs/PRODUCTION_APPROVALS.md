# Production approvals (A / B / C)

**Status:** all three gates remain **OFF**. Deployment is not authorization.

| Gate | Env | Approver | Date | Scope | Tests | Rollback |
|------|-----|----------|------|-------|-------|----------|
| A Production writes | `OUTBOUND_WRITES_ENABLED` | — | — | — | — | Set env false + redeploy |
| B Historical backfill | `HISTORICAL_IMPORT_ENABLED` | — | — | — | — | Set env false + stop importer |
| C Customer messaging | `CUSTOMER_MESSAGING_ENABLED` | — | — | — | — | Set env false; halt review dispatch |

To activate a **named-record pilot** (preferred): set `PILOT_ENTITY_IDS` to the approved Jobber/GHL ids only. Do not set `OUTBOUND_WRITES_ENABLED=true`.

To activate a **gate**: written owner approval, named test records, then set env on Vercel Production only, redeploy, watch queue/dead-letter for 24h.
