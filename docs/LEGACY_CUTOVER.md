# Legacy STM workflow cutover

SyncBridge replaces GHL↔Jobber Zapier sync. **Do not pause or republish workflows until the owner authorizes each step.**

Completion proof (`c923dc0`, 2026-11-13): genuine Jobber `JOB_CLOSED` → GHL Job Completed on existing Evan opportunity `WzfYXayDHWd48HFEQYR9`. Replay produced no second PUT. Do not repeat that fixture.

| Workflow | Id | Current | Activation | Rollback |
|----------|----|---------|------------|----------|
| STM – Z7 – Contact Update to Zapier | `c9a9f5ab-cf0e-47b3-bb61-b5e20db431cd` | **published** | Pause in GHL UI **after** limited Gate A customer updates are proven, in the same window as SyncBridge customer writes. Do not pause until approved. | Republish Z7. Do not edit other workflows. |
| Workflow 1 — New Lead | `2af9bb2e-b769-4c60-9eae-194a74dd0778` | **published** | **Keep unchanged.** | n/a |
| Workflow 4 — Service Completed | `5bd94585-5540-440c-847c-cebce232b2dd` | **draft / unpublished** | Stay unpublished while review messaging is off (Gate C). | Republish only with separate approval. |
| STM – I1 – New Lead Notification | `7a70e54f-dae5-438a-8ce1-dfe6bab822f0` | published | Leave on. SyncBridge must not `POST /contacts/`. | Republish if paused later. |

Do not run Z7 and SyncBridge unrestricted contact updates on the same records without a pause plan—duplicate Jobber edits.

Gates A/B/C stay off until separately approved.
