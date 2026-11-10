# Pilot dry-run preview — not activated

**Links in production DB:** `customer_links` = 0, `job_links` = 0. There are **no existing linked records** to use.

Rule: use existing linked records only unless separately authorized. Therefore **pilot writes cannot start** until an operator:

1. Names a real Jobber client GID and the **already-existing** GHL contact id to update (no `POST /contacts/`).
2. Optionally names a Jobber job GID + existing GHL opportunity id for completion-stage test.
3. Approves those IDs in writing.
4. Sets only:

```
PILOT_JOBBER_CLIENT_IDS=<jobber client gid>
PILOT_GHL_CONTACT_IDS=<existing ghl contact id>
PILOT_JOBBER_JOB_IDS=<optional job gid>
PILOT_GHL_OPPORTUNITY_IDS=<optional existing opp id>
```

Do **not** set `OUTBOUND_WRITES_ENABLED`, `HISTORICAL_IMPORT_ENABLED`, or `CUSTOMER_MESSAGING_ENABLED`.

## Allowlist behavior (tested)

- Approved Jobber client + **create** GHL contact: allowed by code, **forbidden by this pilot policy** because it is not an existing link and fires New Lead / I1.
- Approved Jobber client + **unlisted** GHL contact id: **blocked**.
- Approved pair update: allowed by code; **Z7 Contact Update to Zapier** may still fire.
- Unrelated Jobber client: **blocked**.
- New child opportunity: only if job id is on `PILOT_JOBBER_JOB_IDS`; still **Workflow 4** risk.

## Expected mutations once authorized (update-only)

| Step | Before | After |
|------|--------|--------|
| 1 Jobber CLIENT_UPDATE on listed client | Snapshot GHL contact name/email/phone | GHL PUT same contact id; Jobber remains source |
| 2 GHL ContactUpdate on listed contact | Snapshot Jobber client | Jobber clientEdit then GHL PUT from Jobber |
| 3 JOB_UPDATE on listed job | Snapshot job_links | Reuse job_link; no new Jobber job |
| 4 JOB_CLOSED | Snapshot opportunity stage | Stage → Job Completed **only if** `JOB_COMPLETION_SYNC_ENABLED=true` **and** opportunity id listed. Review row `suppressed` |
| 5 Duplicate webhook | Same provider_event_key | No second queue job |
| 6 Forced GraphQL error | Event retrying | Recover after fix; dead-letter after 8 |

## Rollback

Clear all `PILOT_*` env vars, redeploy. Manually revert the one GHL contact / opportunity in GHL UI if needed. Jobber clientEdit rollback via Jobber UI. Do not Gate A.

## Messaging risk (update-only pilot)

| Write | Customer SMS/email from SyncBridge | Native GHL |
|-------|-------------------------------------|------------|
| GHL contact PUT | No (Gate C off) | **Z7 Zapier** unknown payload — **UI required** |
| GHL contact POST | No | **Workflow 1 + I1** — **do not do this** |
| Opportunity Job Completed | No review send (Gate C) | **Workflow 4** — **UI required** |
| Booking | We do not confirm or create GHL appointments | n/a |
