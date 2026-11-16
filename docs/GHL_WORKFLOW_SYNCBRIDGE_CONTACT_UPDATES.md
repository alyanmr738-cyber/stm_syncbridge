# STM — SyncBridge Contact Updates (DRAFT workflow)

**Do not publish** until operator approval. Keep Z7 and Workflow 4 **draft**.

## Contact Changed trigger filters (STM account, Private Integration)

Verified via GHL list API + [HighLevel support](https://help.gohighlevel.com/support/solutions/articles/155000002477-workflow-trigger-contact-changed): standard-field filters commonly include **Email**, **Phone**, **Tags**, **DND**, **Assigned User**, and address fields. **First Name / Last Name are not reliable as trigger-only filters** on all accounts.

**Smallest reliable options:**

| Goal | Trigger approach |
|------|------------------|
| Production identity sync | Contact Changed filtered on **Email** and/or **Phone** has changed |
| Evan `lastName` proof | Contact Changed **without** field filter + **If/Else** branch where **Last Name** (or **Full Name**) **has changed** — confirm this condition exists in your Workflow Builder before Evan test; if absent, Evan test cannot be claimed on lastName-only UI edits |

## Workflow (draft)

1. **Automation → Workflows → Create** → name `STM — SyncBridge Contact Updates`.
2. **Trigger:** Contact Changed — add filters per table above (Email/Phone for production; for name-only pilot use unfiltered trigger + If/Else on Last Name).
3. **If/Else (optional):** only for name-based pilot — Last Name / First Name has changed. Do **not** permanently exclude contacts where Last Synced By = syncbridge.
4. **Action:** Custom Webhook — Event **CUSTOM**, Method **POST**, URL `https://stmsyncbridge.vercel.app/api/webhooks/ghl`.
5. **Headers:** `Content-Type: application/json`, `X-GHL-Webhook-Secret: [paste from Vercel env — do not share]`
6. **Raw JSON body:**

```json
{
  "type": "ContactUpdate",
  "locationId": "p7HYMD0h2RScLKL68uj0",
  "contactId": "{{contact.id}}",
  "syncEventKey": "{{contact.id}}",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}"
}
```

Use the variable picker to append a **workflow-unique** suffix to `syncEventKey` if your builder exposes **workflow id**, **execution id**, or **date/time** merge tokens (names vary by UI version). Duplicate POSTs with the same `syncEventKey` are deduplicated in SyncBridge.

7. **No other steps** (no SMS, email, tags, opportunities, Zapier).
8. Save as **Draft**. Publish only after receiver deploy + authenticated delivery test pass.

## Receiver auth mode

Workflow shared secret → `workflow_secret` (not Marketplace Ed25519).