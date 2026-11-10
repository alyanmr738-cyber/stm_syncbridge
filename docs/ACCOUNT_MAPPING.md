# Account mapping — Septic Tank Man

Secrets are not stored in this file.

| Item | Value | Source | Verified |
|------|-------|--------|----------|
| Jobber account name | Septic Tank Man | OAuth `account { name }` | 2026-11-10 UI |
| Jobber account ID | Encoded GraphQL id in `sync_connections` | OAuth | 2026-11-10 |
| Jobber timezone | **Pending GraphQL field** (account query used `id name` only) | Live audit | Partial |
| GHL location ID | `p7HYMD0h2RScLKL68uj0` | Env + GET /locations/:id | 2026-11-10 |
| GHL location name | Septic Tank Man | Live | 2026-11-10 |
| GHL timezone | `America/New_York` | Live | 2026-11-10 |
| Sales pipeline ID | From Settings → Audit after deploy (live REST) | GHL pipelines API | Re-run Audit |
| Completed Job stage ID | Must match stage **name** in discovered pipelines | GHL | Do not copy other clients |
| Voice AI calendar IDs | From Audit calendars list | GHL | Re-run Audit |

## Field ownership

See `spec/field_mapping.csv`. Jobber wins customer/property; GHL wins lead source.

## Timezone decision

Propose Jobber timezone as authoritative **after** GraphQL returns it. Until then do **not** hardcode `America/New_York` for Jobber scheduling even though GHL reports it.
