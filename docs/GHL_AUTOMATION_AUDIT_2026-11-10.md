# GHL workflow audit — Septic Tank Man (`p7HYMD0h2RScLKL68uj0`)

Pulled live `GET /workflows/?locationId=…` 2026-11-10. The list API returns **name/status only**, not trigger graphs.

`GET /workflows/{id}/definition?locationId=…` (Version `v3`) returns **403** `WORKFLOW_API_NOT_ENABLED_FOR_LOCATION` for Septic Tank Man. Triggers, filters, and action steps **cannot** be exported via API. Do not treat name-based inference as a substitute for GHL UI inspection. Workflows were not disabled or edited.

## Published workflows that can affect messaging or downstream systems

| Name | Risk if SyncBridge writes |
|------|---------------------------|
| Workflow 1 — New Lead | High — likely contact create |
| STM – I1 – New Lead Notification | High — staff/customer notify on new lead |
| AI Lead Notification | High — AI/notify on lead |
| Urgent Lead Alert | Medium — notify |
| Service Tag Assignment | Medium — tags on contact |
| Address to Standard Field + Directions Link | Medium — contact/address write |
| STM – Directions link | Medium — address |
| STM – Z7 – Contact Update to Zapier | **High** — **any GHL contact update** may call Zapier |
| New Appointment - Notify Septic Team | High if we create GHL appointments (we do not; bookings stay pending) |
| STM – Z1/Z2/Z9 Appointment → Zapier | High if appointments written in GHL |
| STM – Nurture 6 – Booking Stops Nurture | Booking-related |
| STM – R3b – Cancel Stops Reminders | Appointment cancel |
| STM – Cancel tag cleanup | Tags |
| STM – Summary – Text/Voice AI to Note | Notes; inbound to us, not outbound SMS by us |
| STM – Z8 – AI Summary to Zapier | Zapier |
| Workflow 4 — Service Completed | **High** if opportunity moves to completed / job complete |
| Qualified Lead > End Workflow | Stage change |
| Set Assigned Technician on Booking | Booking |
| Human Requested Alert | Conversations |
| Workflow 2 — Incoming Call | Calls |

Nurture 1–5 and several reminder workflows are **draft** (lower immediate risk, still do not assume forever).

## Gate C does not protect you

Native GHL/Zapier workflows fire on **GHL record mutations**, independent of `CUSTOMER_MESSAGING_ENABLED`. A Jobber→GHL contact **create** can run “Workflow 1 — New Lead” and “STM – I1”. A contact **update** can run “STM – Z7 – Contact Update to Zapier”.

**Pilot cannot be proven safe for customer messaging until those published workflows are paused, filtered to a test tag, or shown in the UI not to SMS/email the customer.**

Recommended pilot constraint: **update an existing linked GHL contact that already exists**, do **not** `POST /contacts/` for a brand-new contact, until I1 / Workflow 1 / Z7 are reviewed in UI.
