# Production approvals (A / B / C)

**Status:** all three gates remain **OFF**. Deployment is not authorization.

| Gate | Env | Approver | Date | Scope | Tests | Rollback |
|------|-----|----------|------|-------|-------|----------|
| A Production writes | `OUTBOUND_WRITES_ENABLED` | — | — | — | — | Set env false + redeploy |
| B Historical backfill | `HISTORICAL_IMPORT_ENABLED` | — | — | — | — | Set env false + stop importer |
| C Customer messaging | `CUSTOMER_MESSAGING_ENABLED` | — | — | — | — | Set env false; halt review dispatch |

To activate a **named-record pilot** (preferred): set typed lists only (`PILOT_JOBBER_CLIENT_IDS`, `PILOT_GHL_CONTACT_IDS`, plus job/opportunity lists if needed). Do not set `OUTBOUND_WRITES_ENABLED=true`. Proposed pair is in `docs/PILOT_DRY_RUN_PREVIEW.md` — not live until written approval.

To activate a **gate**: written owner approval, named test records, then set env on Vercel Production only, redeploy, watch queue/dead-letter for 24h.
