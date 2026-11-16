# Priority 1 — Existing customers and job↔opportunity coverage

## Source matching baseline — *re-audit against live*

- At 2026-11-13 read-only discovery: 1,061 GHL contacts and 7,151 live Jobber clients.
- 89 unique email+phone pairs initially; after the name and live-client checks, 78 inserted, 1 pending Jordan Dahl verified, 1 Evan Test existing link retargeted to live client; **80 verified** total.
- 8 identity mismatches/insufficient names excluded from inserts; Sherri Waldren vs Sherry Mason Waldron deliberately excluded; 4 remaining pending/unverified.
- Additional candidate buckets: 15 unique-email + aligned-name candidates (never approved for production linking), 211 unique phone-only needing manual review, 49 ambiguous email/phone collisions.
- Some job/opportunity matching discovery yielded **45 apparent 1:1 pairs**, **22 archived**, and only **3 near-operational** in that SAMPLE; no broad production job-link import was approved.

## Matching policy: proposed ≠ verified

A *proposal* may use normalized e-mail, E.164 phone, normalized name, property address, and existing link evidence. A *verified link* must be supported by direct provider identifiers, live existence, no duplicate/collision, no conflicting record, and named human confirmation when evidence is less than unique email+phone+aligned name. Never override a link via `ON CONFLICT DO UPDATE` without reviewing current ownership.

Refuse automatic verification for:
- email-only pair without independent approval;
- phone-only pair, shared household/family/business numbers;
- blank/initial-only/nickname-only names;
- Sherri/Sherry collision and the eight earlier name-misaligned candidates;
- missing Jobber live client, closed/deleted customer, different GHL location;
- >1 plausible GHL contact or Jobber client.

## Suggested admin UX

Admin tabs **Verified / Suggested / Needs Review / Conflicts / Archived/Rejected**; search by safely masked names, email/phone and provider ID; row explains *why* a match is proposed; links to inspect both records; side-by-side changes (no full PII in logs); accept/reject with audit; explicit preview of any downstream side effects; no action on ambiguous rows until manual case resolution.

For an accepted existing link, store `{jobber_client_id, ghl_contact_id, match_method, verification_evidence, verified_by, verified_at, last_checked_at}` using actual schema names; enforce uniqueness on each provider ID per tenant/location and reject conflicting matches. No job/customer mutate on DB-link creation; note that **future** Jobber events can perform allowed writes under Gate A.

## Job↔opportunity linking proposal

Only link if:
1. Existing verified customer mapping is live and belongs to the same account/location.
2. Jobber job is live and exists; read actual job status.
3. GHL opportunity exists in the correct Sales Pipeline `UMelQ0AisTqWdPl1XHK6` and belongs to verified GHL contact.
4. Exactly ONE plausible job↔opportunity relationship, grounded by known booking/service/date/notes identifiers; never rely solely on same customer name.
5. No other active link owns the job or opportunity and no link is archived/stale/deleted.

Archived and completed historical pairs are reported, not automatically advanced. Link creation is DB metadata only, but because Gate A is ON, linkage can enable future GHL stage writes; require a reviewed allowlisted batch/approval. No implicit backfill or replay.

## Required evidence

- Reconciliation report: GHL and Jobber counts, candidates by confidence class, collisions and missing data, redacted sample reason codes.
- Exact proposed customer changes (if any) as SQL/JSON **not executed** pending approval.
- Exact proposed job-link changes (if any) as SQL/JSON **not executed** pending approval.
- Tests: wrong pipeline, multiple opportunities, stale customer link, deleted client, same phone two people, one opportunity two jobs, archived opportunity, same Jobber job duplicate hook, owner mismatch and Jobber account mismatch.
- Admin evidence with screenshots or routes, count parity and audit trail.
