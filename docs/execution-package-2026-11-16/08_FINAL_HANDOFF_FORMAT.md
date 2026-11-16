# Required final handoff (Cursor must fill, not just repeat this template)

## Executive result (max 12 lines)
- Production baseline SHA / new SHA / actual deployment status
- Completed functional areas (code + tests + verified behavior)
- All production gates and GHL workflows still as authorized
- OAuth/queue health and 40 quarantine count
- Customer-link count / job-link count, source timestamps
- Test suite summary: passed/failed/skipped, build/lint/browser
- Unexpected provider writes/messages: yes/no, precise evidence
- Remaining blockers (external approvals or API limits only)
- Operational GO / PARTIAL GO / NO-GO

## Implementation evidence

For each task use a compact row with:
`Task ID | change/commit | files | tests | prod/staging evidence | enabled? | approval needed?`

## Release-ready explicit approval requests (only if needed)

Each request must have: exact proposed scope and count, record list/matching evidence, effect if approved, regression/undo plan and approval phrase. Examples:
- "Approve existing job links: exact N listed pairs, no provider writes now (but later events can update opportunities)."
- "Approve Batch B: exact N vetted pairs; no phone-only or ambiguities."
- "Approve a controlled creation pilot: <= N named records, workflow sends separately suppressed."
- "Approve Gate B dry-run -> real bounded batch for exact types/count/time window."
- "Approve customer-facing review pilot: template, consent, test recipient(s), Workflow 4 release coordination."

Do not request blanket production authorization, passwords, tokens, or irrelevant account access. No empty status-only output: finish all safe implementation first.
