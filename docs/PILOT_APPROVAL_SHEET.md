# Pilot approval sheet — do not execute until signed

**Search:** 400 Jobber clients × GHL email lookup. **Exact email+phone matches: 0.** Only unique-email pair below.

**Recommended pair (existing records only)**

| | ID |
|--|----|
| Jobber client | `Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==` |
| GHL contact | `6fphEggI2IDws4TlmD6Q` |
| Location | `p7HYMD0h2RScLKL68uj0` |

Identity evidence (read-only): unique email `alext@usa.net` in the 400-client sample. First name ALEX on both. **Do not change** surname (TETIYEVKI vs TETIYEVSKY) or phone (`+12012590233` vs `+12012595233`). GHL tags `inbound call`, `missed-call lead`. Source `Request a Free Quote`. One opportunity `zRuJCeDarYP2tzPTy63X` (untouched). Custom field Jobber Client ID `saS3lqgdYaw8RPz95NZd`: **empty**. Unrelated custom field `w9DPysJBXfsDJhBKTXcq` = `Septic Tank pumping` (untouched).

## Authorized write (after approval)

Env (Gate A/B/C remain **false**):

```
PILOT_JOBBER_CLIENT_IDS=Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA==
PILOT_GHL_CONTACT_IDS=6fphEggI2IDws4TlmD6Q
PILOT_GHL_ALLOWED_FIELDS=jobberClientId
PILOT_EXISTING_RECORDS_ONLY=true
```

HTTP: `PUT /contacts/6fphEggI2IDws4TlmD6Q`

```json
{
  "customFields": [
    {
      "id": "saS3lqgdYaw8RPz95NZd",
      "field_value": "Z2lkOi8vSm9iYmVyL0NsaWVudC8zMTQxNDUwMA=="
    }
  ]
}
```

**Not written:** name, phone, email, address, tags, opportunities, other custom fields, Jobber client fields, new GHL contact, new Jobber job.

| Field | Before | After |
|-------|--------|--------|
| Jobber Client ID `saS3lqgdYaw8RPz95NZd` | empty | Jobber GID above |
| firstName / lastName / email / phone | ALEX / TETIYEVSKY / alext@usa.net / +12012595233 | **unchanged** |
| Jobber name / phone | ALEX TETIYEVKI / (201) 259-0233 | **unchanged** |

DB after success: one `customer_links` row (jobber GID ↔ `6fphEggI2IDws4TlmD6Q`, method `jobber_authoritative_update`). Repeat PUT is the same payload (idempotent).

## Side-effect blocker (live write)

GHL workflow **STM – Z7 – Contact Update to Zapier** is published. Workflow definitions are **403** via API. A custom-field PUT is still a contact update. **Customer messaging cannot be ruled out.** Live write stays **blocked** until you confirm in the GHL UI that Z7 does not SMS/email this contact (pause, filter, or Zapier no-op).

## Rollback

Clear `PILOT_*` on Vercel. In GHL, empty custom field `saS3lqgdYaw8RPz95NZd` on contact `6fphEggI2IDws4TlmD6Q`. Delete the `customer_links` row if present. Do not enable Gate A.

## Pass / fail

Pass: GHL re-read shows only that custom field changed; Jobber re-read unchanged; one link row; queue succeeded; no second contact/job/opp; Gate B/C still off.

Fail: any identity field change, new contact, Zapier/customer message, or write to an unlisted id.

## Controls

Unrelated ids: `pilotAllows` false. Creates: false while Gate A off. Field filter: `jobberClientId` only. Failures: `GateClosedError` → event `suppressed` or queue retry/dead-letter + Activity Retry.
