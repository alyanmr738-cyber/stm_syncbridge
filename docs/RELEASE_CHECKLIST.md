# Release checklist — SyncBridge STM

## Pilot closed (2026-11-10)

Authorization path: typed `PILOT_*` allowlists + `PILOT_GHL_ALLOWED_FIELDS=jobberClientId`. Gate A/B/C were **off**. Worker `GET /api/internal/process-queue` processed Jobber `CLIENT_UPDATE` `297eeb07-…` then idempotent `a12c5609-…`.

Write: `PUT /contacts/6fphEggI2IDws4TlmD6Q` custom field `saS3lqgdYaw8RPz95NZd` = Jobber GID `Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==`. GHL `dateUpdated` `2026-11-10T17:25:00.492Z`.

Unchanged: GHL last TETIYEVSKY / `+12012595233` / tags; Jobber last TETIYEVKI / `(201) 259-0233`.

Identity: unique email only. Surname and phone **conflict**. Link `49edf0ca-…` is **`verified=false`**, `email_only_unverified_identity`. Not authoritative.

Zapier/Z7: **unverified**. A contact PUT can still fire Z7. No GHL conversation was created by us; we cannot prove Zapier did not run.

`PILOT_*` production env vars **removed**. Redeploy required so they are gone from lambdas.

## Live write tests vs mock

| Capability | Live write | Mock payload |
|------------|------------|--------------|
| GHL Jobber Client ID custom field (existing contact) | **Passed** | yes |
| Identity name/phone/email overwrite | **Not done** (conflicts) | mapping tests |
| GHL → Jobber clientEdit + reconcile | **Not live** | passed |
| Job → existing opportunity | **Not live** | passed |
| Job closed → Job Completed | **Not live** | passed |
| Quote/invoice GHL note | **Not live** | Jobber quote fetch tested |
| AI summary → Jobber note | **Not live** | passed |
| Duplicate queue key / dead-letter | **Not live write** | passed |
| Cron worker auth + drain | GET worker 200 with secret; unsigned 401 | passed |
| Historical execute | off | Gate B still closed with Gate A on |

## Gate A

**NO-GO** until: (1) Z7 paused or accepted, (2) identity policy for mismatches, (3) named bidirectional live tests, (4) `HISTORICAL_IMPORT_ENABLED` remains false. Gate A does **not** enable Gate B.

## Remaining live tests (approval required)

Use **new** typed PILOT lists; do not reuse unverified Alex identity overwrite.

1. Reverse: GHL ContactUpdate on a **verified same-identity** pair → Jobber `clientEdit` then GHL PUT from Jobber. Exact IDs TBD after operator names a pair with matching email **and** phone.
2. Job: `PILOT_JOBBER_JOB_IDS` + `PILOT_GHL_OPPORTUNITY_IDS` for one existing job/opp → `JOB_UPDATE` no create; `JOB_CLOSED` → stage `1724dc1d-02f1-422c-825f-bebb9d427e71` with `JOB_COMPLETION_SYNC_ENABLED=true`.
3. Quote note: `ESTIMATE_SYNC_ENABLED=true` + listed client/contact only.
4. AI note: `AI_SUMMARY_SYNC_ENABLED=true` + listed Jobber client/job.

Alex pair: **custom-field only** already done. Do not PUT name/phone.

## Z7

Safe to **pause** only after you approve in GHL UI. SyncBridge does not need Z7. Workflow 1 stays. Rollback: republish Z7.

## Activation monitor

Activity statuses, `customer_links.verified`, GHL identity fields vs custom field, queue dead-letter, `/api/health` flags, no new GHL contacts, no review_deliveries `sent`.

## Rollback

1. Vercel → previous Ready.  
2. Keep `OUTBOUND_WRITES_ENABLED`, `HISTORICAL_IMPORT_ENABLED`, `CUSTOMER_MESSAGING_ENABLED` false.  
3. Clear any `PILOT_*`.  
4. Optionally empty `saS3lqgdYaw8RPz95NZd` on `6fphEggI2IDws4TlmD6Q`.  
5. Republish Z7 if paused.
