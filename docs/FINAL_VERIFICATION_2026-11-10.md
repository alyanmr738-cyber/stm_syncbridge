# Final verification and pilot preparation — 2026-11-10

Gates A/B/C remain **OFF**. No unrestricted writes.

## 1. Deployment and health

Live `GET https://stmsyncbridge.vercel.app/api/health`:

- `ok: true`
- `jobberApiVersion: "2026-11-03"`
- `queueScheduler: "webhook-drain+minute-cron"`
- All flags false; `gates.production_writes / historical_backfill / customer_messaging` **false**

That payload is **`1fde234` or successor** (`38fe6c4` did not include `jobberApiVersion`). Git after this fix is a new successor.

Vercel deployment **ID** is not returned by health. Confirm Ready + commit in Vercel dashboard.

## 2. Cron and webhook security

| Check | Result |
|-------|--------|
| Unsigned GHL POST | **401** `Unauthorized GHL webhook` |
| Signed Jobber HMAC POST | **200** `{received:true}`; duplicate same body **200** (deduped, no second pending job for same key except new probe ids) |
| Minute cron automatic | **Configured** `* * * * *` on Pro. This run did **not** capture Vercel invocation logs. Confirm Cron Jobs tab / function logs. Webhook `after()` drain **is** live (events processed without waiting for cron). |
| Queue | One **retrying** CLIENT_UPDATE probe (`final-verify-*`) failed GraphQL field shape; **dead_letter 0**. Fix below skips non-Jobber GIDs and corrects Client query. |

## 3. Four-workflow GHL audit

List API: names/status only. **v3 workflow definition/logs: 403 `WORKFLOW_API_NOT_ENABLED_FOR_LOCATION`** for `p7HYMD0h2RScLKL68uj0`. Triggers/actions **cannot** be read via API. **Do not invent them.** Operator must open GHL UI. Workflows were **not** edited.

| Workflow | Id | Status | Inferred from **name only** | Pilot writes that might fire it |
|----------|----|--------|------------------------------|---------------------------------|
| Workflow 1 — New Lead | `2af9bb2e-b769-4c60-9eae-194a74dd0778` | published | Contact/lead create | **GHL POST /contacts/** |
| STM – I1 – New Lead Notification | `7a70e54f-dae5-438a-8ce1-dfe6bab822f0` | published | Notify on new lead | **GHL POST /contacts/** |
| STM – Z7 – Contact Update to Zapier | `c9a9f5ab-cf0e-47b3-bb61-b5e20db431cd` | published | Contact update → Zapier | **GHL PUT /contacts/:id** (even update-only pilot) |
| Workflow 4 — Service Completed | `5bd94585-5540-440c-847c-cebce232b2dd` | published | Job/service complete | **Opportunity stage → Job Completed** or new opportunity |

Gate C does **not** stop these.

## 4. Handler matrix

See `docs/HANDLER_MATRIX_2026-11-10.md`. Quote/invoice **GHL sync is not complete** — only `quote_links` / `invoice_links` rows.

## 5. Pilot preparation

`customer_links` / `job_links` **empty**. No existing linked pair to name. Dry-run policy and env template: `docs/PILOT_DRY_RUN_PREVIEW.md`. **Not activated.**

## 6. Defects and fixes

| Defect | Fix |
|--------|-----|
| Client query used `emails { nodes }` invalid on 2026-11-03 | `emails { address }`, `phones { number }`, `clientProperties` |
| HMAC probes called GraphQL and retried | Skip unless id starts with `Z2lkOi8v` |
| Unsigned GHL on old deploy 200 | Already 401 on current health build |
| Minute cron unproven in logs | Operator confirms Vercel Cron Jobs |

## 7. Approvals still required

| Action | Needed |
|--------|--------|
| **Pilot** | Named **existing** Jobber client GID + existing GHL contact id (and optional job/opp). Written “update only, no POST contact”. UI confirmation of Z7. Then `PILOT_*` env only. |
| **Gate A** | After workflows paused/filtered + successful update-only pilot. Enables **all** record writes. |
| **Gate B** | Matching rules for 7140 vs 1032 + New Lead workflows contained. Separate approval. |
| **Gate C** | Consent/opt-out + review workflow + I1/W1/W4 review. |

**Not fully live.**
