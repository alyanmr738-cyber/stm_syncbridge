# Jobber creation schema probe (read-only)

**Date:** 2026-11-17  
**Source:** `scripts/jobber-creation-schema-probe.mjs` + live introspection via production OAuth token (no GraphiQL, no mutations).  
**API version:** `2026-11-03` (preferred; app default in `src/lib/jobber/version.ts`).

## Mutations

| Mutation | Present | Input type | Payload |
|----------|---------|------------|---------|
| `clientCreate` | Yes | `ClientCreateInput` | `client`, `userErrors` |
| `jobCreate` | Yes | **`JobCreateAttributes`** (not `JobCreateInput`) | `job`, `userErrors` |

## `ClientCreateInput` (subset)

Matches `createJobberClient` in `ops.ts`: `firstName`, `lastName`, `emails`, `phones`, …

## `JobCreateAttributes` (introspected fields)

`propertyId`, `quoteId`, `requestId`, `title`, `lineItems`, `scheduling`, `timeframe`, `notes`, …

**There is no `clientId` on job create.** Client association is via **`propertyId`** on an existing client property.

## Implementation alignment

- `createJobberJob` uses `JobCreateAttributes` with `propertyId` + `title`.
- Handler loads the first `clientProperties.nodes[0].id` for the Jobber client; without a property, job create is blocked and flagged for admin (`job_create_blocked_no_property`).

## Limitations

- No automatic visit / availability reservation from this mutation input.
- `trackingOrigin` value `"GHL_SYNC"` should be validated on first live canary; remove or replace if `userErrors` reject it.
- If client has zero properties, supported alternative is **staff creates a Jobber property** or a future `propertyCreate` path — not automated in this milestone.

Full JSON: `docs/JOBBER_CREATION_SCHEMA_PROBE.json`.