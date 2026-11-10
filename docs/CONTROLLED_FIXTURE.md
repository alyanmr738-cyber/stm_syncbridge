# Controlled live fixture — awaiting operator approval

Alex pair `6fphEggI2IDws4TlmD6Q` / `Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==` is **out of scope** for identity sync (`verified=false`).

No complete All Access Digital-owned Jobber+GHL+job+opportunity pair exists today.

Closest GHL record: `wKTmlfLVnwvQmjZZwxNs` (`evan@allaccessdigital.net`, no phone, no opportunities, no Jobber client). **Do not use as-is.**

## Create this labeled fixture (do not run until approved)

Use one AAD-owned email and one AAD-owned US phone. Suggested email: `evan@allaccessdigital.net` if that mailbox is monitored. **Operator must supply the phone.**

| Step | System | Operation |
|------|--------|-----------|
| 1 | Jobber | Create client firstName `SyncBridge` lastName `Test` email `<AAD email>` phone `<AAD phone>` |
| 2 | GHL | Create or update **one** contact with the **same** email and phone, name `SyncBridge Test`, no extra tags |
| 3 | Jobber | Create one test job on that client (internal only; do not invoice the customer) |
| 4 | GHL | Create one opportunity on Sales Pipeline `UMelQ0AisTqWdPl1XHK6` stage Job Scheduled `c6fb20fd-a318-450c-97ce-d1a067f3d6c9` |
| 5 | Optional | One Jobber quote/invoice on that client, not sent to the customer |

After IDs exist, set only:

```
PILOT_JOBBER_CLIENT_IDS=<jobber client GID>
PILOT_GHL_CONTACT_IDS=<ghl contact id>
PILOT_JOBBER_JOB_IDS=<jobber job GID>
PILOT_GHL_OPPORTUNITY_IDS=<ghl opportunity id>
PILOT_GHL_ALLOWED_FIELDS=firstName,lastName,email,phone,jobberClientId
PILOT_EXISTING_RECORDS_ONLY=true
ALLOW_RECORD_CREATION=false
JOB_COMPLETION_SYNC_ENABLED=true
ESTIMATE_SYNC_ENABLED=true
AI_SUMMARY_SYNC_ENABLED=true
```

Gates A/B/C stay **false**. Workflow 1 stays. Pause **Z7** in GHL UI only if separately approved (rollback: republish).

## Tests after IDs are approved

1. Jobber `CLIENT_UPDATE` → GHL PUT listed contact (identity fields match, so overwrite is safe).
2. GHL ContactUpdate → Jobber `clientEdit` → GHL PUT from Jobber.
3. Jobber `JOB_UPDATE` → link existing opportunity, no new opp.
4. Jobber `JOB_CLOSED` → stage `1724dc1d-02f1-422c-825f-bebb9d427e71`. Review row `suppressed`.
5. Quote/invoice → GHL **note** on the contact, not a new GHL estimate.
6. Internal AI summary event → Jobber **internal** note.
7. Replay same provider_event_key → no second contact/job/opp.

No SMS. Booking stays `pending_jobber_confirmation`.
