# Legacy STM workflow cutover

SyncBridge replaces GHL↔Jobber Zapier sync. **Do not disable GHL workflows until the owner authorizes each pause.**

| Workflow | Action |
|----------|--------|
| STM – Z7 – Contact Update to Zapier | Pause in GHL UI when authorized. Rollback: republish Z7. Do not edit other workflows. |
| STM – I1 – New Lead Notification | Retire after SyncBridge new-contact path is live. Keep off SyncBridge contact **creates**. Rollback: republish I1. |
| Workflow 4 – Service Completed | Retire after SyncBridge job-complete + review is proven. Rollback: republish Workflow 4. |
| Workflow 1 – New Lead | **Keep.** Not part of the integration replacement. |

Gates A/B/C stay off until separately approved. Duplicate prevention: do not run Z7 and unrestricted Gate A at the same time.

Pilot result (`0ed14fa`): Jobber Client ID custom field written on existing contact `6fphEggI2IDws4TlmD6Q`; identity fields unchanged; `customer_links` row `49edf0ca-dee7-4c0b-8d24-9debf47feb3a`.
