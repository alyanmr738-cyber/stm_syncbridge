# Account mapping — Septic Tank Man

Verified 2026-11-10 via live GHL REST (`GET /locations/:id`, pipelines, calendars) and Supabase `sync_connections`. No secrets in this file.

## Jobber

| Item | Value | Evidence |
|------|-------|----------|
| Account name | Septic Tank Man | `sync_connections.provider_account_name` |
| Status | connected | DB 2026-11-10 |
| Access token expiry (observed) | 2026-11-10T17:18:58Z | `token_expires_at` — refresh required before this |
| Timezone | **Not returned** on `account { id name }` | Do not assume NY until GraphQL field confirmed |

## GHL

| Item | Value |
|------|-------|
| Location ID | `p7HYMD0h2RScLKL68uj0` |
| Location name | Septic Tank Man |
| Timezone | `America/New_York` |
| Pipeline ID | `UMelQ0AisTqWdPl1XHK6` |
| Pipeline name | Sales Pipeline |

### Stages (Sales Pipeline)

| Stage ID | Name |
|----------|------|
| `24f673b2-2610-410b-a172-73f9352f6b29` | New Lead |
| `fe5e0c2f-2cfb-467c-bda6-4713f23b0cb3` | Engaged |
| `72393cb4-44d1-4a14-a52f-8993b95a6de0` | Auto Nurture |
| `69d1783b-7762-47c5-9c8d-56b8c6915e40` | Manual Nurture |
| `8cc60c2c-bc5e-433c-ad08-a27a369e9c29` | Qualified Lead |
| `6245f1f2-c37a-4841-b563-1ae93a56fb8f` | Lead Nurture |
| `c6fb20fd-a318-450c-97ce-d1a067f3d6c9` | Job Scheduled |
| `1724dc1d-02f1-422c-825f-bebb9d427e71` | **Job Completed** (target for job-complete sync; not "Completed Job") |
| `300f5ae1-0111-4a52-a1ae-3f6c227c44aa` | Long-term Nurture |
| `25c751f1-ac34-496b-9912-17b9fac95ab7` | Lost Lead |
| `4700f2a0-9ecb-4e9c-8698-d9f539e6b5de` | Review Requested |
| `fecfcba2-c740-4092-9265-db73d2ccfc05` | Review Received |

### Calendars

| Calendar ID | Name |
|-------------|------|
| `KLLmIE9Q1izWbnlJ2jpj` | Install and Inspection |
| `NAqpkOQVaas4XiteJRLb` | Pumping, Emergency & Maintenance |
| `TRRjJPhieuI7CHMUNIo2` | Install & Inspections |
| `Xys7KBfpx40InGkeACLX` | Pumping - RETIRED (do not use) |

**Voice AI calendar:** not labeled in API names. Confirm in GHL which of the first three Voice AI books. Do not use the RETIRED calendar.

**Automation risk:** stages Auto Nurture, Manual Nurture, Lead Nurture, Review Requested exist. Creating contacts/opportunities or moving into Review Requested can fire customer messages. Keep gate A/C off until those workflows are audited in the GHL UI (API does not export trigger bodies here).
